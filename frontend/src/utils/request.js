const API_BASE = '/api';

export async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });
  
  const data = await response.json();
  
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('登录已失效，请重新登录');
  }
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

export function get(url, options = {}) {
  return request(url, { method: 'GET', ...options });
}

export function post(url, body, options = {}) {
  return request(url, { method: 'POST', body: JSON.stringify(body), ...options });
}

export function patch(url, body, options = {}) {
  return request(url, { method: 'PATCH', body: JSON.stringify(body), ...options });
}

export function del(url, options = {}) {
  return request(url, { method: 'DELETE', ...options });
}

export async function download(url, filename) {
  const token = localStorage.getItem('token');
  
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${url}`, {
    method: 'GET',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Download failed');
  }
  
  const blob = await response.blob();
  const urlObj = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlObj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(urlObj);
}
