export const API_URL = '/api';

let isRedirecting = false;

export async function fetchJson(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error(`ارتباط با سرور برقرار نشد: ${err.message}`);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
        // Handle token expiration / logout
        if (typeof window !== 'undefined' && !endpoint.includes('/login')) {
            if (!isRedirecting) {
                isRedirecting = true;
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }
        }
    }
    throw new Error(data.error || `Network error or server unavailable (${res.status})`);
  }
  return res.json().catch(() => ({}));
}
