import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_auth';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const authUserId = await authenticateRequest(req, res);
  if (!authUserId) return;

  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured on server' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  // Use the authenticated user's ID — prevents spoofing
  const userId = authUserId;

  try {
    // Use Stripe API directly with inline price_data (₹33/mo INR)
    const params = new URLSearchParams();
    params.append('customer_email', email);
    params.append('mode', 'subscription');
    params.append('line_items[0][price_data][currency]', 'inr');
    params.append('line_items[0][price_data][unit_amount]', '3300');
    params.append('line_items[0][price_data][recurring][interval]', 'month');
    params.append('line_items[0][price_data][product_data][name]', 'TrendSense Pro');
    params.append('line_items[0][price_data][product_data][description]', 'Unlimited AI scripts, narrations, uploads & analytics');
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${APP_URL}/?checkout=success`);
    params.append('cancel_url', `${APP_URL}/?checkout=canceled`);
    params.append('metadata[user_id]', userId);
    params.append('client_reference_id', userId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Stripe error: ${err}` });
    }

    const session = await response.json() as any;
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
