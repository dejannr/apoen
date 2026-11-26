import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import { sameOrigin } from '@/server/http';
import { clientIp, rateLimit } from '@/server/rate-limit';
import { claimGuestProgress, openGuestSession } from '@/server/guest-play';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const session = await getServerSession(authOptions);
  const parsed = z.object({ token: z.string().max(100).nullable().optional() }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  if (session?.user) {
    let claim = null;
    if (parsed.data.token) {
      try { claim = await claimGuestProgress(parsed.data.token, (session.user as { id: string }).id); }
      catch { claim = { status: 'FAILED', transferred: 0 }; }
    }
    return NextResponse.json({ authenticated: true, claim }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const ip = clientIp(request);
  const limit = await rateLimit('GUEST_SESSION_IP', ip, 60, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  const guest = await openGuestSession(parsed.data.token);
  return NextResponse.json({ authenticated: false, ...guest }, { headers: { 'Cache-Control': 'private, no-store' } });
}
