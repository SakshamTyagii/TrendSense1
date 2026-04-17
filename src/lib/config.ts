// ─── Client-side configuration ─────────────────────────────────────────
// API keys are NO LONGER stored client-side. All API calls go through /api/* proxy.
// Only Supabase public keys remain here (they are designed to be public).

export const config = {
  // Supabase (public anon key — safe for client-side)
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // OAuth client IDs (public — used in browser redirect)
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  twitterClientId: import.meta.env.VITE_TWITTER_CLIENT_ID || '',

  // Stripe publishable key (public — for Stripe.js)
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',

  get hasSupabase() { return this.supabaseUrl.length > 0 && this.supabaseAnonKey.length > 0; },
  get hasGoogleAuth() { return this.googleClientId.length > 0; },
  get hasStripe() { return this.stripePublishableKey.length > 0; },
};
