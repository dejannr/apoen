import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/server/auth';
import { applyGameAction } from '@/server/game';
import { rateLimit } from '@/server/rate-limit';
import { safeError, sameOrigin } from '@/server/http';

const schema = z.object({
  requestId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  kind: z.enum(['CASH_OUT', 'ABANDON']),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const limit = await rateLimit('ACTION_USER', userId, 120, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    const result = await applyGameAction(userId, (await params).id, parsed.data,);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = safeError(error);
    return NextResponse.json({ error: code }, { status: code === 'NOT_FOUND' ? 404 : code === 'ACCOUNT_INACTIVE' ? 403 : code.includes('CONFLICT') ? 409 : 422 });
  }
}
