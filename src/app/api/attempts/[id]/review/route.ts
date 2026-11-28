import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/server/auth';
import { belgradeDate } from '@/server/calendar';
import { db } from '@/server/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const attempt = await db.attempt.findFirst({
    where: { id: (await params).id, userId },
    include: { challenge: { include: { dailySet: { select: { playDate: true } }, options: { orderBy: { sortOrder: 'asc' } } } } },
  });
  if (!attempt) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const playDate = attempt.challenge.dailySet.playDate.toISOString().slice(0, 10);
  if (playDate >= belgradeDate()) return NextResponse.json({ error: 'REVIEW_NOT_AVAILABLE' }, { status: 409 });
  const challenge = attempt.challenge;
  return NextResponse.json({
    attemptId: attempt.id,
    playDate,
    status: attempt.status,
    reward: attempt.finalReward,
    payout: (attempt.finalReward ?? 0) * (attempt.jokerUsed ? 2 : 1),
    jokerUsed: attempt.jokerUsed,
    mode: challenge.mode,
    title: challenge.title,
    prompt: challenge.prompt,
    explanation: challenge.explanation,
    options: challenge.options.map((option) => ({ id: option.id, label: option.label, numericValue: option.numericValue?.toString() ?? null, correct: option.correctFlag, orderRank: option.orderRank, explanation: option.explanation })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
