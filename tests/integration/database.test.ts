import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });

describe('PostgreSQL integrity', () => {
  it('has all 17 MVP tables', async () => {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    const names = new Set(rows.map((row) => row.table_name));
    for (const name of [
      'users', 'password_reset_tokens', 'rate_limits', 'seasons', 'media_assets',
      'collectible_tiers', 'daily_sets', 'categories', 'challenges', 'challenge_options',
      'attempts', 'attempt_actions', 'banknotes', 'season_totals', 'user_collectibles',
      'admin_audit', 'job_runs',
    ]) expect(names.has(name), name).toBe(true);
  });

  it('loads a complete published demo set', async () => {
    const count = await db.challenge.count({ where: { dailySet: { status: 'PUBLISHED' } } });
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it('database trigger freezes published challenge rows', async () => {
    const row = await db.challenge.findFirst({ where: { dailySet: { status: 'PUBLISHED' } } });
    expect(row).toBeTruthy();
    await expect(db.challenge.update({ where: { id: row!.id }, data: { prompt: 'unauthorized edit' } })).rejects.toThrow();
  });

  it('database trigger rejects direct publication of incomplete sets', async () => {
    const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
    const season = await db.season.findFirst({ where: { status: 'PUBLISHED' } });
    expect(admin && season).toBeTruthy();

    // Find an unused play_date so this integrity test remains repeatable against a persistent local DB.
    const existing = new Set((await db.dailySet.findMany({ select: { playDate: true } }))
      .map(({ playDate }) => playDate.toISOString().slice(0, 10)));
    let date = new Date(Date.UTC(2100, 0, 1));
    while (existing.has(date.toISOString().slice(0, 10))) date = new Date(date.getTime() + 86_400_000);

    const draft = await db.dailySet.create({ data: { seasonId: season!.id, playDate: date, createdBy: admin!.id } });
    await expect(db.dailySet.update({ where: { id: draft.id }, data: { status: 'PUBLISHED' } })).rejects.toThrow();
  });
});

afterAll(async () => db.$disconnect());
afterAll(async()=>db.$disconnect());
