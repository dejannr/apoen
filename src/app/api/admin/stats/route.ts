import { NextResponse } from 'next/server';
import { adminIdentity } from '@/server/admin';
import { db } from '@/server/db';

export async function GET() {
  const admin = await adminIdentity();
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.error === 'UNAUTHENTICATED' ? 401 : 403 });

  const [users, activeAttempts, totalAttempts, publishedSets, draftSets, byMode, denominations] = await Promise.all([
    db.user.count(),
    db.attempt.count({ where: { status: 'ACTIVE' } }),
    db.attempt.count(),
    db.dailySet.count({ where: { status: 'PUBLISHED' } }),
    db.dailySet.count({ where: { status: 'DRAFT' } }),
    db.$queryRaw<{ mode: string; attempts: number; completed: number; timeouts: number; average_reward: number | null }[]>`
      SELECT c.mode, COUNT(*)::int AS attempts,
        COUNT(*) FILTER (WHERE a.status IN ('COMPLETED','FAILED','EXPIRED','ABANDONED'))::int AS completed,
        COUNT(*) FILTER (WHERE a.end_reason='TIMEOUT')::int AS timeouts,
        AVG(a.final_reward)::float AS average_reward
      FROM attempts a JOIN challenges c ON c.id=a.challenge_id GROUP BY c.mode ORDER BY c.mode`,
    db.$queryRaw<{ denomination: number; count: number }[]>`
      SELECT denomination, COUNT(*)::int AS count FROM banknotes GROUP BY denomination ORDER BY denomination`,
  ]);

  return NextResponse.json({ users, activeAttempts, totalAttempts, publishedSets, draftSets, byMode, denominations }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
