import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/server/auth';
import { db } from '@/server/db';

const denominations = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const seasons = await db.season.findMany({
    where: { status: 'CLOSED', OR: [{ totals: { some: { userId } } }, { banknotes: { some: { userId } } }] },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: {
      totals: { where: { userId }, select: { totalAmount: true, finalRank: true } },
      banknotes: {
        where: { userId },
        select: {
          denomination: true,
          attempt: { select: { challenge: { select: { dailySet: { select: { playDate: true } } } } } },
          puzzleGuess: { select: { dailySet: { select: { playDate: true } } } },
        },
      },
    },
  });
  const history = seasons.map((season) => {
    const notesByValue = new Map<number, number>();
    const byDate = new Map<string, { totalAmount: number; noteCount: number }>();
    for (const note of season.banknotes) {
      notesByValue.set(note.denomination, (notesByValue.get(note.denomination) ?? 0) + 1);
      const date = (note.attempt?.challenge.dailySet.playDate ?? note.puzzleGuess?.dailySet.playDate)?.toISOString().slice(0, 10);
      if (!date) continue;
      const summary = byDate.get(date) ?? { totalAmount: 0, noteCount: 0 };
      summary.totalAmount += note.denomination;
      summary.noteCount++;
      byDate.set(date, summary);
    }
    return {
      season: { id: season.id, year: season.year, month: season.month, theme: season.collectibleTheme },
      totalAmount: season.totals[0]?.totalAmount ?? 0,
      finalRank: season.totals[0]?.finalRank ?? null,
      totalNotes: season.banknotes.length,
      denominations: denominations.map((value) => ({ denomination: value, count: notesByValue.get(value) ?? 0 })),
      days: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, summary]) => ({ date, ...summary })),
    };
  });
  return NextResponse.json({ history }, { headers: { 'Cache-Control': 'private, no-store' } });
}
