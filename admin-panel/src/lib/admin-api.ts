/**
 * Admin API helper for direct database queries via Supabase PostgREST
 * This is used for institutional verification and other direct database operations
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function adminAPI(endpoint: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login on unauthorized
      if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_refresh_token');
        window.location.href = '/auth/login';
      }
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
