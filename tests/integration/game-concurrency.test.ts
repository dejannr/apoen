import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { applyGameAction, attemptSnapshot, startAttempt } from '../../src/server/game';
import { closeDueSeasons } from '../../src/server/jobs';
import { belgradeDate } from '../../src/server/calendar';

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
const today = new Date(`${belgradeDate()}T00:00:00.000Z`);

async function player() {
  const id = randomUUID();
  return db.user.create({ data: { email: `concurrency-${id}@example.test`, nickname: `u${id.slice(0, 12)}`, nicknameKey: `u${id.slice(0, 12)}`, passwordHash: 'test-only', status: 'ACTIVE' } });
}

async function todayEdge() {
  return db.challenge.findFirstOrThrow({ where: { mode: 'EDGE', dailySet: { status: 'PUBLISHED', playDate: today, season: { status: 'PUBLISHED' } } }, include: { options: { orderBy: { sortOrder: 'asc' } } } });
}

describe('game transaction concurrency', () => {
  it('returns one stable attempt for concurrent starts', async () => {
    const user = await player();
    const challenge = await todayEdge();
    const results = await Promise.all(Array.from({ length: 20 }, () => startAttempt(user.id, challenge.id, db)));
    expect(new Set(results.map((result) => result.attempt.id)).size).toBe(1);
    await applyGameAction(user.id, results[0].attempt.id, { requestId: randomUUID(), expectedRevision: 0, kind: 'ABANDON', payload: {} }, db);
  });

  it('never sends hidden scoring values and lazily commits a timeout on snapshot', async () => {
    const user = await player();
    const challenge = await todayEdge();
    const started = await startAttempt(user.id, challenge.id, db);
    const before = await attemptSnapshot(user.id, started.attempt.id, db);
    expect(before.options.length).toBeGreaterThan(0);
    expect(JSON.stringify(before)).not.toContain('numericValue');
    expect(JSON.stringify(before)).not.toContain('correctFlag');
    expect(JSON.stringify(before)).not.toContain('orderRank');
    expect(JSON.stringify(before)).not.toContain('rewardRules');
    expect(before.rewardLadder.some((step) => step.reward === 5000)).toBe(true);
    await db.attempt.update({ where: { id: started.attempt.id }, data: { startedAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() - 1000) } });
    const after = await attemptSnapshot(user.id, started.attempt.id, db);
    expect(after.status).toBe('EXPIRED');
    expect(await db.banknote.count({ where: { attemptId: started.attempt.id } })).toBe(0);
    expect(await db.attemptAction.count({ where: { attemptId: started.attempt.id } })).toBe(1);
    expect(await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: challenge.seasonId } } })).toMatchObject({ totalAmount: 0, completedCount: 1 });
  });

  it('replays one finish request without duplicating ledger entries', async () => {
    const user = await player();
    const challenge = await todayEdge();
    const started = await startAttempt(user.id, challenge.id, db);
    const config = challenge.publicConfig as { pickCount: number; target: string };
    const values = challenge.options.map((option) => ({ id: option.id, value: option.numericValue! }));
    let selection: string[] | undefined;
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (config.pickCount === 2 && values[i].value + values[j].value === BigInt(config.target)) selection = [values[i].id, values[j].id];
      }
    }
    expect(selection).toBeDefined();
    const input = { requestId: randomUUID(), expectedRevision: 0, kind: 'SUBMIT_SELECTION' as const, payload: { optionIds: selection! } };
    const first = await applyGameAction(user.id, started.attempt.id, input, db);
    const replay = await applyGameAction(user.id, started.attempt.id, input, db);
    expect(replay).toEqual(first);
    expect(await db.banknote.count({ where: { attemptId: started.attempt.id } })).toBe(1);
    expect(await db.attemptAction.count({ where: { attemptId: started.attempt.id } })).toBe(1);
    expect(await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: challenge.seasonId } } })).toMatchObject({ totalAmount: 5000, completedCount: 1 });
  });

  it('awards at most one banknote under competing finishes', async () => {
    const user = await player();
    const challenge = await todayEdge();
    const started = await startAttempt(user.id, challenge.id, db);
    const values = challenge.options.map((option) => ({ id: option.id, value: option.numericValue! }));
    let selection: string[] | undefined;
    for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) if (values[i].value + values[j].value === 100n) selection = [values[i].id, values[j].id];
    expect(selection).toBeDefined();
    await Promise.allSettled(Array.from({ length: 20 }, () => applyGameAction(user.id, started.attempt.id, { requestId: randomUUID(), expectedRevision: 0, kind: 'SUBMIT_SELECTION', payload: { optionIds: selection! } }, db)));
    expect(await db.banknote.count({ where: { attemptId: started.attempt.id } })).toBe(1);
    expect(await db.attemptAction.count({ where: { attemptId: started.attempt.id } })).toBe(1);
    expect(await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: challenge.seasonId } } })).toMatchObject({ totalAmount: 5000, completedCount: 1 });
  });

  it('closes an ended season once and snapshots RANK ties into collectibles', async () => {
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const asset = await db.mediaAsset.findFirstOrThrow();
    const year = 1800 + Math.floor(Math.random() * 226);
    const month = 1 + Math.floor(Math.random() * 12);
    const season = await db.season.create({ data: { year, month, startsAt: new Date(Date.UTC(year, month - 1, 1)), endsAt: new Date(Date.UTC(year, month, 1)), collectibleTheme: 'Test season', createdBy: admin.id } });
    const tier = await db.collectibleTier.create({ data: { seasonId: season.id, tierNo: 1, thresholdAmount: 0, tierName: 'Test tier', description: '', assetId: asset.id, assetAlt: 'test' } });
    await db.season.update({ where: { id: season.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const category = await db.category.findFirstOrThrow();
    const set = await db.dailySet.create({ data: { seasonId: season.id, playDate: new Date(Date.UTC(year, month - 1, 1)), createdBy: admin.id } });
    const challenge = await db.challenge.create({ data: { dailySetId: set.id, seasonId: season.id, position: 1, half: 1, mode: 'EDGE', categoryId: category.id, title: 'Test', prompt: 'Test', publicConfig: { pickCount: 1, target: '10', unit: 'test', scale: 1, direction: 'ABSOLUTE' }, rewardRules: { metric: 'PERCENT_BPS', bands: [[0, 5000]], fallback: 0 }, timeLimitSec: 60, explanation: '', sourceRefs: [], options: { create: [{ label: 'A', sortOrder: 1, numericValue: 10n }, { label: 'B', sortOrder: 2, numericValue: 20n }] } } });
    const players = await Promise.all([player(), player(), player()]);
    for (let i = 0; i < players.length; i++) {
      const now = new Date(Date.UTC(year, month - 1, 2));
      const attempt = await db.attempt.create({ data: { userId: players[i].id, challengeId: challenge.id, seasonId: season.id, status: 'COMPLETED', startedAt: now, expiresAt: new Date(now.getTime() + 60_000), finishedAt: new Date(now.getTime() + 10_000), endReason: 'SUBMITTED', correctCount: 1, stateJson: {}, revision: 1, finalReward: i < 2 ? 5000 : 0 } });
      if (i < 2) await db.banknote.create({ data: { attemptId: attempt.id, userId: players[i].id, seasonId: season.id, denomination: 5000, earnedAt: attempt.finishedAt! } });
      await db.seasonTotal.create({ data: { userId: players[i].id, seasonId: season.id, totalAmount: i < 2 ? 5000 : 0, completedCount: 1 } });
    }
    expect(await closeDueSeasons(db)).toBeGreaterThanOrEqual(1);
    const totals = await db.seasonTotal.findMany({ where: { seasonId: season.id }, orderBy: { totalAmount: 'desc' } });
    expect(totals.map((total) => total.finalRank)).toEqual([1, 1, 3]);
    expect(await db.userCollectible.count({ where: { seasonId: season.id, tierId: tier.id } })).toBe(3);
    expect((await db.season.findUniqueOrThrow({ where: { id: season.id } })).status).toBe('CLOSED');
  });
});

afterAll(async () => db.$disconnect());
