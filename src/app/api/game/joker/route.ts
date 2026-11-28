import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { resolvePlayIdentity } from '@/server/guest-play';
import { belgradeDate } from '@/server/calendar';
import { sameOrigin } from '@/server/http';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  let identity;
  try { identity = await resolvePlayIdentity(request); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 401 }); }
  const body = z.object({ position: z.number().int().min(1).max(8) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    const day = belgradeDate();
    const set = await db.dailySet.findFirst({ where: { playDate: new Date(`${day}T00:00:00Z`), status: 'PUBLISHED', season: { status: 'PUBLISHED' } }, select: { id: true } });
    if (!set) return NextResponse.json({ error: 'NOT_AVAILABLE' }, { status: 404 });
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM daily_sets WHERE id=${set.id}::uuid FOR UPDATE`;
      const active = await tx.attempt.count({ where: { userId: identity.userId, status: 'ACTIVE', challenge: { dailySetId: set.id } } });
      if (active) throw new Error('QUESTION_ACTIVE');
      const prior = await tx.attempt.count({ where: { userId: identity.userId, status: { not: 'ACTIVE' }, challenge: { dailySetId: set.id, position: { lt: body.data.position } } } });
      if (prior !== body.data.position - 1) throw new Error('NOT_NEXT_QUESTION');
      const current = await tx.dailyPlayerState.findUnique({ where: { userId_dailySetId: { userId: identity.userId, dailySetId: set.id } } });
      if (current?.jokerPosition) throw new Error('JOKER_ALREADY_USED');
      return tx.dailyPlayerState.upsert({ where: { userId_dailySetId: { userId: identity.userId, dailySetId: set.id } }, create: { userId: identity.userId, dailySetId: set.id, jokerPosition: body.data.position }, update: { jokerPosition: body.data.position } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ position: result.jokerPosition, used: Boolean(result.jokerUsedAt) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = (error as Error).message;
    return NextResponse.json({ error: code }, { status: code === 'JOKER_ALREADY_USED' ? 409 : code === 'QUESTION_ACTIVE' || code === 'NOT_NEXT_QUESTION' ? 409 : 422 });
  }
}
