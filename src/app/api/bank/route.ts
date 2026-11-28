import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/server/auth';
import { monthBounds } from '@/server/calendar';
import { db } from '@/server/db';

const denominations = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const requestedId = new URL(request.url).searchParams.get('season');
  let season;
  if (requestedId) {
    if (!z.string().uuid().safeParse(requestedId).success) return NextResponse.json({ error: 'INVALID_SEASON' }, { status: 400 });
    season = await db.season.findFirst({ where: { id: requestedId, status: { in: ['PUBLISHED', 'CLOSED'] } }, select: { id: true, year: true, month: true, collectibleTheme: true } });
  } else {
    const { year, month } = monthBounds();
    season = await db.season.findFirst({ where: { year, month, status: 'PUBLISHED' }, select: { id: true, year: true, month: true, collectibleTheme: true } });
  }
  if (!season) return NextResponse.json({ season: null, totalAmount: 0, totalNotes: 0, denominations: denominations.map((denomination) => ({ denomination, count: 0 })), days: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  const notes = await db.banknote.findMany({
    where: { userId, seasonId: season.id },
    orderBy: { earnedAt: 'asc' },
    select: {
      denomination: true,
      earnedAt: true,
      attempt: { select: { challenge: { select: { dailySet: { select: { playDate: true } } } } } },
      puzzleGuess: { select: { dailySet: { select: { playDate: true } } } },
    },
  });
  const counts = new Map<number, number>();
  const days = new Map<string, { totalAmount: number; noteCount: number }>();
  for (const note of notes) {
    counts.set(note.denomination, (counts.get(note.denomination) ?? 0) + 1);
    const date = (note.attempt?.challenge.dailySet.playDate ?? note.puzzleGuess?.dailySet.playDate)?.toISOString().slice(0, 10);
    if (!date) continue;
    const summary = days.get(date) ?? { totalAmount: 0, noteCount: 0 };
    summary.totalAmount += note.denomination;
    summary.noteCount++;
    days.set(date, summary);
  }
  return NextResponse.json({
    season: { id: season.id, year: season.year, month: season.month, theme: season.collectibleTheme },
    totalAmount: notes.reduce((total, note) => total + note.denomination, 0),
    totalNotes: notes.length,
    denominations: denominations.map((denomination) => ({ denomination, count: counts.get(denomination) ?? 0 })),
    days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
