import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Service role — full access

// Disable body parsing for raw webhook body
export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function verifyStripeSignature(rawBody: string, signature: string): Promise<any> {
  // Verify webhook signature using Stripe's algorithm
  // In production, use stripe SDK. For now, parse and trust if secret matches.
  // This is a simplified version — for production, install 'stripe' npm package on server.
  const crypto = await import('crypto');
  const parts = signature.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [key, val] = part.split('=');
    acc[key] = val;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  const payload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(payload).digest('hex');

  if (computed !== expectedSig) {
    throw new Error('Invalid webhook signature');
  }

  return JSON.parse(rawBody);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server not fully configured' });
  }

  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const rawBody = await readRawBody(req);
    const event = await verifyStripeSignature(rawBody, signature);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id || session.client_reference_id;
        const stripeCustomerId = session.customer;
        const stripeSubscriptionId = session.subscription;

        if (userId) {
          await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            tier: 'pro',
            status: session.subscription ? 'active' : 'active',
            current_period_end: null, // Will be set by invoice.paid
          }, { onConflict: 'user_id' });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (sub) {
          await supabase.from('subscriptions').update({
            status: subscription.status === 'active' ? 'active'
              : subscription.status === 'trialing' ? 'trialing'
              : subscription.status === 'past_due' ? 'past_due'
              : 'canceled',
            tier: subscription.status === 'canceled' ? 'free' : 'pro',
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
          }).eq('user_id', sub.user_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (sub) {
          await supabase.from('subscriptions').update({
            tier: 'free',
            status: 'canceled',
          }).eq('user_id', sub.user_id);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (subscriptionId) {
          const periodEnd = invoice.lines?.data?.[0]?.period?.end;
          if (periodEnd) {
            await supabase.from('subscriptions').update({
              current_period_end: new Date(periodEnd * 1000).toISOString(),
              status: 'active',
              tier: 'pro',
            }).eq('stripe_subscription_id', subscriptionId);
          }
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return res.status(400).json({ error: err.message });
  }
}
