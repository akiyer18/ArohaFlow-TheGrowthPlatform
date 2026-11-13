/**
 * Thin fetch helper for the Agent Service localhost HTTP bridge (#13).
 * When VITE_AGENT_HTTP_URL is unset, callers should keep using fixtures.
 */

export function agentHttpBaseUrl() {
  const raw = import.meta.env.VITE_AGENT_HTTP_URL;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed || null;
}

export function isAgentHttpConfigured() {
  return Boolean(agentHttpBaseUrl());
}

/**
 * @param {string} path
 * @param {RequestInit & { body?: object }} [init]
 */
export async function agentFetch(path, init = {}) {
  const base = agentHttpBaseUrl();
  if (!base) {
    throw new Error('VITE_AGENT_HTTP_URL is not set');
  }

  const headers = new Headers(init.headers || {});
  let body = init.body;
  if (body != null && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(body);
  }

  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
    body,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const message = data?.error || `Agent HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}
