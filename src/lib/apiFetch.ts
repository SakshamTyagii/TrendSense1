import { supabase } from './supabase';

/**
 * Authenticated fetch wrapper for /api/* endpoints.
 * Automatically attaches the Supabase session JWT as a Bearer token.
 * In dev mode (import.meta.env.DEV), skips auth for direct API calls.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Attach auth token for server API calls
  if (url.startsWith('/api/')) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.set('Authorization', `Bearer ${data.session.access_token}`);
      }
    } catch {
      // Continue without token — server will return 401 if required
    }
  }

  return fetch(url, { ...options, headers });
}
