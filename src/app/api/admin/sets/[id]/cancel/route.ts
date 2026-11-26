import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminIdentity } from '@/server/admin';
import { db } from '@/server/db';
import { sameOrigin } from '@/server/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const admin = await adminIdentity();
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.error === 'UNAUTHENTICATED' ? 401 : 403 });
  const { id } = await params;
  try {
    const cancelled = await db.$transaction(async (tx) => {
      const set = await tx.dailySet.findUnique({ where: { id }, select: { id: true, status: true, playDate: true } });
      if (!set || set.status !== 'PUBLISHED') throw new Error('SET_NOT_CANCELLABLE');
      const attempts = await tx.attempt.count({ where: { challenge: { dailySetId: id } } });
      if (attempts) throw new Error('SET_HAS_ATTEMPTS');
      const updated = await tx.dailySet.update({ where: { id }, data: { status: 'CANCELLED' } });
      await tx.adminAudit.create({ data: { actorId: admin.user.id, action: 'CANCEL', entityType: 'DAILY_SET', entityId: id, details: { playDate: set.playDate.toISOString().slice(0, 10) } } });
      return updated;
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json(cancelled);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'SET_NOT_CANCELLABLE') return NextResponse.json({ error: message }, { status: 409 });
    if (message === 'SET_HAS_ATTEMPTS' || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2004')) {
      return NextResponse.json({ error: 'SET_NOT_CANCELLABLE' }, { status: 409 });
    }
    throw error;
  }
}
