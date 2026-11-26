import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/server/auth';
import { db } from '@/server/db';
import { monthBounds } from '@/server/calendar';

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const page = Math.max(1, Math.min(10_000, Number(request.nextUrl.searchParams.get('page') ?? 1) || 1));
  const offset = (page - 1) * PAGE_SIZE;
  const { year, month } = monthBounds();
  const season = await db.season.findFirst({ where: { year, month, status: 'PUBLISHED' }, select: { id: true, year: true, month: true } });
  if (!season) return NextResponse.json({ season: null, rows: [], me: null, gap: null, asOf: new Date().toISOString(), totalRows: 0, page, pageSize: PAGE_SIZE }, { headers: { 'Cache-Control': 'private, no-store' } });

  const userId = (session.user as typeof session.user & { id: string }).id;
  const result = await db.$transaction(async (tx) => {
    const [rows, countRows, ownRows, timeRows] = await Promise.all([
      tx.$queryRaw<{ user_id: string; nickname: string; total_amount: number; rank: number }[]>`
        SELECT t.user_id, u.nickname, t.total_amount,
          RANK() OVER (ORDER BY t.total_amount DESC)::int AS rank
        FROM season_totals t JOIN users u ON u.id = t.user_id
        WHERE t.season_id = ${season.id}::uuid AND u.status = 'ACTIVE'
        ORDER BY t.total_amount DESC, u.nickname_key ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      tx.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM season_totals t JOIN users u ON u.id=t.user_id
        WHERE t.season_id=${season.id}::uuid AND u.status='ACTIVE'`,
      tx.$queryRaw<{ nickname: string; total_amount: number; rank: number; next_amount: number | null }[]>`
        SELECT u.nickname, t.total_amount,
          (SELECT COUNT(*)::int + 1 FROM season_totals higher JOIN users hu ON hu.id=higher.user_id
            WHERE higher.season_id=t.season_id AND hu.status='ACTIVE' AND higher.total_amount>t.total_amount) AS rank,
          (SELECT MIN(higher.total_amount)::int FROM season_totals higher JOIN users hu ON hu.id=higher.user_id
            WHERE higher.season_id=t.season_id AND hu.status='ACTIVE' AND higher.total_amount>t.total_amount) AS next_amount
        FROM season_totals t JOIN users u ON u.id=t.user_id
        WHERE t.season_id=${season.id}::uuid AND t.user_id=${userId}::uuid AND u.status='ACTIVE'`,
      tx.$queryRaw<{ as_of: Date }[]>`SELECT transaction_timestamp() AS as_of`,
    ]);
    const own = ownRows[0] ?? null;
    return {
      rows: rows.map(({ user_id, ...row }) => ({ ...row, isMe: user_id === userId })),
      totalRows: countRows[0]?.total ?? 0,
      me: own ? { nickname: own.nickname, totalAmount: own.total_amount, rank: own.rank } : null,
      gap: own?.next_amount == null ? null : own.next_amount - own.total_amount,
      asOf: timeRows[0]?.as_of.toISOString() ?? new Date().toISOString(),
    };
  }, { isolationLevel: 'RepeatableRead' });

  return NextResponse.json({ season, ...result, page, pageSize: PAGE_SIZE }, { headers: { 'Cache-Control': 'private, no-store' } });
}
