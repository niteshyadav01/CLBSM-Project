const base = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = sessionStorage.getItem('clbsm_token');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    sessionStorage.removeItem('clbsm_token');
    window.dispatchEvent(new Event('clbsm:unauthorized'));
  }
  if (!response.ok) throw new ApiError(data.message || 'Request failed.', response.status, data.details);
  return data;
}

export async function download(path, fallbackName) {
  const token = sessionStorage.getItem('clbsm_token');
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || 'Export failed.', response.status);
  }
  const blob = await response.blob();
  const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
