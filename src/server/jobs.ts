import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { db } from './db';
import { applyGameAction } from './game';

export async function expireDueAttempts(client: PrismaClient = db) {
  const due = await client.$queryRaw<{ id: string; user_id: string; revision: number }[]>`
    SELECT id, user_id, revision
    FROM attempts
    WHERE status = 'ACTIVE' AND expires_at <= clock_timestamp()
    ORDER BY expires_at
    LIMIT 100
  `;
  let count = 0;
  for (const attempt of due) {
    try {
      await applyGameAction(attempt.user_id, attempt.id, { requestId: randomUUID(), expectedRevision: attempt.revision, kind: 'TIMEOUT', payload: {} }, client);
      count++;
    } catch (error) {
      console.error('expire failed', attempt.id, error);
    }
  }
  return count;
}

async function assertSeasonLedger(client: PrismaClient | Prisma.TransactionClient, seasonId: string) {
  const mismatches = await client.$queryRaw<{ user_id: string; completed_attempts: number; active_attempts: number; attempt_amount: bigint; note_amount: bigint; total_amount: number | null; completed_count: number | null }[]>`
    WITH attempts_by_user AS (
      SELECT user_id,
             COUNT(*) FILTER (WHERE status <> 'ACTIVE')::int AS completed_attempts,
             COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_attempts,
             COALESCE(SUM(final_reward) FILTER (WHERE status <> 'ACTIVE'), 0)::bigint AS attempt_amount
      FROM attempts
      WHERE season_id = ${seasonId}::uuid
      GROUP BY user_id
    ), users AS (
      SELECT user_id FROM attempts_by_user
      UNION
      SELECT user_id FROM season_totals WHERE season_id = ${seasonId}::uuid
    )
    SELECT users.user_id,
           COALESCE(a.completed_attempts, 0)::int AS completed_attempts,
           COALESCE(a.active_attempts, 0)::int AS active_attempts,
           COALESCE(a.attempt_amount, 0)::bigint AS attempt_amount,
           COALESCE((SELECT SUM(b.denomination)::bigint FROM banknotes b WHERE b.user_id = users.user_id AND b.season_id = ${seasonId}::uuid), 0)::bigint AS note_amount,
           t.total_amount,
           t.completed_count
    FROM users
    LEFT JOIN attempts_by_user a ON a.user_id = users.user_id
    LEFT JOIN season_totals t ON t.user_id = users.user_id AND t.season_id = ${seasonId}::uuid
    WHERE COALESCE(a.active_attempts, 0) <> 0
       OR COALESCE(a.completed_attempts, 0) <> COALESCE(t.completed_count, 0)
       OR COALESCE(a.attempt_amount, 0) <> COALESCE(t.total_amount, 0)
       OR COALESCE(a.attempt_amount, 0) <> COALESCE((SELECT SUM(b.denomination)::bigint FROM banknotes b WHERE b.user_id = users.user_id AND b.season_id = ${seasonId}::uuid), 0)
       OR EXISTS (
         SELECT 1 FROM attempts attempt
         LEFT JOIN banknotes note ON note.attempt_id = attempt.id
         WHERE attempt.user_id = users.user_id AND attempt.season_id = ${seasonId}::uuid
           AND ((attempt.final_reward = 0 AND note.id IS NOT NULL)
             OR (attempt.final_reward > 0 AND (note.id IS NULL OR note.denomination <> attempt.final_reward OR note.user_id <> attempt.user_id OR note.season_id <> attempt.season_id)))
       )
  `;
  if (mismatches.length) throw new Error(`LEDGER_RECONCILIATION_FAILED:${mismatches.map((row) => row.user_id).join(',')}`);
}

export async function reconcileSeasonLedgers(client: PrismaClient = db) {
  const rows = await client.$queryRaw<{ id: string }[]>`SELECT id FROM seasons WHERE status IN ('PUBLISHED','CLOSED') ORDER BY year, month`;
  for (const season of rows) await assertSeasonLedger(client, season.id);
  return rows.length;
}

export async function closeDueSeasons(client: PrismaClient = db) {
  await expireDueAttempts(client);
  let count = 0;
  for (;;) {
    let currentSeasonId: string | undefined;
    try {
      const closed = await client.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM seasons
          WHERE status = 'PUBLISHED' AND ends_at <= clock_timestamp()
          ORDER BY ends_at FOR UPDATE SKIP LOCKED LIMIT 1
        `;
        if (!rows.length) return false;
        const seasonId = rows[0].id;
        currentSeasonId = seasonId;
        await assertSeasonLedger(tx, seasonId);
        await tx.$executeRaw`
          UPDATE season_totals t
          SET final_rank = r.rank
          FROM (
            SELECT user_id, RANK() OVER (ORDER BY total_amount DESC)::int AS rank
            FROM season_totals WHERE season_id = ${seasonId}::uuid
          ) r
          WHERE t.season_id = ${seasonId}::uuid AND t.user_id = r.user_id
        `;
        await tx.$executeRaw`
          INSERT INTO user_collectibles(user_id, season_id, tier_id, awarded_at, final_amount, final_rank)
          SELECT t.user_id, t.season_id, tier.id, clock_timestamp(), t.total_amount, t.final_rank
          FROM season_totals t
          CROSS JOIN LATERAL (
            SELECT id FROM collectible_tiers
            WHERE season_id = t.season_id AND threshold_amount <= t.total_amount
            ORDER BY threshold_amount DESC LIMIT 1
          ) tier
          WHERE t.season_id = ${seasonId}::uuid AND t.completed_count > 0
          ON CONFLICT(user_id, season_id) DO NOTHING
        `;
        await tx.season.update({ where: { id: seasonId }, data: { status: 'CLOSED', closedAt: new Date() } });
        await tx.jobRun.upsert({
          where: { jobType_jobKey: { jobType: 'CLOSE_SEASON', jobKey: seasonId } },
          create: { jobType: 'CLOSE_SEASON', jobKey: seasonId, status: 'SUCCEEDED', startedAt: new Date(), finishedAt: new Date(), details: { seasonId } },
          update: { status: 'SUCCEEDED', finishedAt: new Date(), details: { seasonId } },
        });
        return true;
      }, { isolationLevel: 'Serializable' });
      if (!closed) return count;
      count++;
    } catch (error) {
      if (currentSeasonId) {
        await client.jobRun.upsert({
          where: { jobType_jobKey: { jobType: 'CLOSE_SEASON', jobKey: currentSeasonId } },
          create: { jobType: 'CLOSE_SEASON', jobKey: currentSeasonId, status: 'FAILED', startedAt: new Date(), finishedAt: new Date(), details: { message: error instanceof Error ? error.message : 'Unknown failure' } },
          update: { status: 'FAILED', finishedAt: new Date(), details: { message: error instanceof Error ? error.message : 'Unknown failure' } },
        });
      }
      throw error;
    }
  }
}
