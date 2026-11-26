import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sameOrigin, safeError } from '@/server/http';
import { clientIp, rateLimit } from '@/server/rate-limit';
import { applyGameAction } from '@/server/game';
import { resolvePlayIdentity } from '@/server/guest-play';

const schema = z.object({ requestId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), kind: z.enum(['SUBMIT_SELECTION', 'PICK_NEXT', 'COMPARE', 'CASH_OUT', 'ABANDON']), payload: z.record(z.string(), z.unknown()).default({}) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  let identity;
  try { identity = await resolvePlayIdentity(request); }
  catch (error) { const code = (error as Error).message; return NextResponse.json({ error: code }, { status: code === 'UNAUTHENTICATED' ? 401 : 410 }); }
  const limit = await rateLimit(identity.isGuest ? 'ACTION_GUEST' : 'ACTION_USER', identity.isGuest ? clientIp(request) : identity.userId, 120, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    return NextResponse.json(await applyGameAction(identity.userId, (await params).id, parsed.data as never), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = safeError(error);
    return NextResponse.json({ error: code }, { status: code === 'NOT_FOUND' ? 404 : code === 'ACCOUNT_INACTIVE' ? 403 : code.includes('CONFLICT') || code === 'REVISION_CONFLICT' ? 409 : 422 });
  }
}
