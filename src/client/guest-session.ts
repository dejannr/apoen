'use client';

const STORAGE_KEY = 'apoen.guest-session.v1';
type GuestSession = { token: string; playDate: string };
let sessionRequest: Promise<{ authenticated: boolean; token?: string; playDate?: string }> | null = null;

export function currentGuestToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as GuestSession;
    return typeof value.token === 'string' ? value.token : null;
  } catch { return null; }
}

export function ensurePlaySession(): Promise<{ authenticated: boolean; token?: string; playDate?: string }> {
  if (sessionRequest) return sessionRequest;
  sessionRequest = (async () => {
    const response = await fetch('/api/guest/session', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: currentGuestToken() }), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Dnevni kviz trenutno nije dostupan.');
    const data = await response.json() as { authenticated: boolean; token?: string; playDate?: string; claim?: { status?: string } | null };
    if (data.authenticated && currentGuestToken() && data.claim?.status !== 'FAILED') localStorage.removeItem(STORAGE_KEY);
    if (!data.authenticated && data.token && data.playDate) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, playDate: data.playDate } satisfies GuestSession));
    return data;
  })().finally(() => { sessionRequest = null; });
  return sessionRequest;
}

export function guestHeaders(): HeadersInit {
  const token = currentGuestToken();
  return token ? { 'x-apoen-guest-token': token } : {};
}

export async function claimGuestSession() {
  const token = currentGuestToken();
  if (!token) return null;
  try {
    const response = await fetch('/api/guest/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }), cache: 'no-store' });
    const result = await response.json() as { status?: string; transferred?: number };
    if (response.ok) localStorage.removeItem(STORAGE_KEY);
    return result;
  } catch { return null; }
}
