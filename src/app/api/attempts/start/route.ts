import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sameOrigin, safeError } from '@/server/http';
import { clientIp, rateLimit } from '@/server/rate-limit';
import { startAttempt, attemptSnapshot } from '@/server/game';
import { resolvePlayIdentity } from '@/server/guest-play';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  let identity;
  try { identity = await resolvePlayIdentity(request); }
  catch (error) { const code = (error as Error).message; return NextResponse.json({ error: code }, { status: code === 'UNAUTHENTICATED' ? 401 : 410 }); }
  const limit = await rateLimit(identity.isGuest ? 'START_GUEST' : 'START_USER', identity.isGuest ? clientIp(request) : identity.userId, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  const parsed = z.object({ challengeId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    const result = await startAttempt(identity.userId, parsed.data.challengeId);
    return NextResponse.json(await attemptSnapshot(identity.userId, result.attempt.id), { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = safeError(error);
    return NextResponse.json({ error: code }, { status: code === 'NOT_FOUND' ? 404 : code === 'ACCOUNT_INACTIVE' ? 403 : code === 'OUT_OF_ORDER' || code === 'HALF_LOCKED' ? 409 : 422 });
  }
}
