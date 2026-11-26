import { NextResponse } from 'next/server';
import { resolvePlayIdentity } from '@/server/guest-play';
import { belgradeDate, monthBounds } from '@/server/calendar';
import { db } from '@/server/db';
import { attemptSnapshot } from '@/server/game';

export const dynamic = 'force-dynamic';

async function loadToday(userId: string, day: string, year: number, month: number) {
  return db.season.findFirst({
    where: { year, month, status: 'PUBLISHED' },
    include: {
      sets: {
        where: { playDate: new Date(`${day}T00:00:00.000Z`), status: 'PUBLISHED' },
        include: {
          challenges: {
            orderBy: { position: 'asc' },
            select: {
              id: true, position: true, half: true, mode: true,
              category: { select: { name: true } },
              attempts: { where: { userId }, select: { id: true, status: true, finalReward: true, finishedAt: true } },
            },
          },
        },
      },
    },
  });
}

export async function GET(request: Request) {
  return getTodayResponse(request);
}

async function getTodayResponse(request?: Request) {
  let identity;
  try { identity = await resolvePlayIdentity(request ?? new Request('http://localhost')); }
  catch (error) { const code = (error as Error).message; return NextResponse.json({ error: code }, { status: code === 'UNAUTHENTICATED' ? 401 : 410 }); }
  const userId = identity.userId;
  const day = belgradeDate();
  const { year, month } = monthBounds();
  let season = await loadToday(userId, day, year, month);
  let active = season?.sets[0]?.challenges.flatMap((challenge) => challenge.attempts).find((attempt) => attempt.status === 'ACTIVE');
  if (active) {
    const snapshot = await attemptSnapshot(userId, active.id);
    if (snapshot.status !== 'ACTIVE') {
      season = await loadToday(userId, day, year, month);
      active = season?.sets[0]?.challenges.flatMap((challenge) => challenge.attempts).find((attempt) => attempt.status === 'ACTIVE');
    }
  }
  const set = season?.sets[0];
  const challenges = set?.challenges ?? [];
  const terminal = (position: number) => {
    const attempt = challenges.find((challenge) => challenge.position === position)?.attempts[0];
    return Boolean(attempt && attempt.status !== 'ACTIVE');
  };
  let state = 'UNAVAILABLE';
  if (set && challenges.length === 8) {
    if ([1, 2, 3, 4, 5, 6, 7, 8].every(terminal)) state = 'COMPLETED';
    else if (active && challenges.find((challenge) => challenge.attempts.some((attempt) => attempt.id === active!.id))?.half === 2) state = 'IN_H2';
    else if (active) state = 'IN_H1';
    else if ([1, 2, 3, 4].every(terminal)) state = 'BREAK';
    else state = 'READY_H1';
  }
  return NextResponse.json({
    playDate: day,
    season: season ? { id: season.id, year: season.year, month: season.month, theme: season.collectibleTheme } : null,
    state,
    activeAttemptId: active?.id ?? null,
    halves: [1, 2].map((half) => ({
      half,
      challenges: challenges.filter((challenge) => challenge.half === half).map((challenge) => ({
        id: challenge.id,
        position: challenge.position,
        mode: challenge.mode,
        category: challenge.category.name,
        status: challenge.attempts[0]?.status ?? 'NOT_STARTED',
        attemptId: challenge.attempts[0]?.id ?? null,
        reward: challenge.attempts[0]?.finalReward ?? null,
      })),
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
