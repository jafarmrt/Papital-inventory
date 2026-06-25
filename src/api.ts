export const API_URL = '/api';

export async function fetchJson(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
        // Handle token expiration / logout
        if (typeof window !== 'undefined' && !endpoint.includes('/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    }
    throw new Error(data.error || 'Network response was not ok');
  }
  return res.json();
}
