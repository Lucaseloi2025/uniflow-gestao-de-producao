import { supabase } from './supabase';

/**
 * Centralized authenticated fetch utility for frontend requests.
 * Automatically attaches the Supabase Bearer JWT token from the active session.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});

  // Explicitly remove legacy/insecure x-user-* headers to enforce token-based identity
  headers.delete('x-user-role');
  headers.delete('x-user-id');
  headers.delete('x-user-name');
  headers.delete('x-user-email');

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn('[apiFetch] Could not retrieve session access token:', err);
  }

  // Set default JSON Content-Type if body is a stringified object and not already specified
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

export default apiFetch;
