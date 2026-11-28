import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { applyGameAction, startAttempt } from '../../src/server/game';
import { claimGuestProgress, openGuestSession, resolveGuestIdentity } from '../../src/server/guest-play';
import { belgradeDate } from '../../src/server/calendar';

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL });
const today = new Date(`${belgradeDate()}T00:00:00.000Z`);

async function player() {
  const id = randomUUID();
  return db.user.create({ data: { email: `guest-claim-${id}@example.test`, nickname: `p${id.slice(0, 12)}`, nicknameKey: `p${id.slice(0, 12)}`, passwordHash: 'test-only' } });
}

async function todayChallenge() {
  return db.challenge.findFirstOrThrow({ where: { position: 1, mode: 'EDGE', dailySet: { status: 'PUBLISHED', playDate: today, season: { status: 'PUBLISHED' } } }, include: { options: { orderBy: { sortOrder: 'asc' } } } });
}

async function correctSelection(challenge: Awaited<ReturnType<typeof todayChallenge>>) {
  const config = challenge.publicConfig as { pickCount: number; target: string };
  const values = challenge.options.map((option) => ({ id: option.id, value: option.numericValue! }));
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    if (config.pickCount === 2 && values[i].value + values[j].value === BigInt(config.target)) return [values[i].id, values[j].id];
  }
  throw new Error('Published today EDGE challenge has no correct pair');
}

describe('guest daily play', () => {
  it('keeps answers server-scored and transfers a completed guest result to a new account', async () => {
    const account = await player();
    const session = await openGuestSession(null, db);
    const identity = await resolveGuestIdentity(session.token, db);
    expect(identity.isGuest).toBe(true);
    const challenge = await todayChallenge();
    const attempt = await startAttempt(identity.userId, challenge.id, db);
    const reward = await applyGameAction(identity.userId, attempt.attempt.id, { requestId: randomUUID(), expectedRevision: 0, kind: 'SUBMIT_SELECTION', payload: { optionIds: await correctSelection(challenge) } }, db);
    expect((reward as { result: { reward: number } }).result.reward).toBe(5000);

    const claim = await claimGuestProgress(session.token, account.id, db);
    expect(claim).toEqual({ status: 'TRANSFERRED', transferred: 1 });
    const transferred = await db.attempt.findUniqueOrThrow({ where: { id: attempt.attempt.id }, include: { banknotes: true } });
    expect(transferred.userId).toBe(account.id);
    expect(transferred.banknotes[0]?.userId).toBe(account.id);
    expect(await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId: account.id, seasonId: challenge.seasonId } } })).toMatchObject({ totalAmount: 5000, completedCount: 1 });
  });

  it('discards guest attempts if the account already played today', async () => {
    const account = await player();
    const session = await openGuestSession(null, db);
    const guest = await resolveGuestIdentity(session.token, db);
    const challenge = await todayChallenge();
    const guestAttempt = await startAttempt(guest.userId, challenge.id, db);
    const accountAttempt = await startAttempt(account.id, challenge.id, db);

    expect(await claimGuestProgress(session.token, account.id, db)).toEqual({ status: 'ALREADY_PLAYED', transferred: 0 });
    expect((await db.attempt.findUniqueOrThrow({ where: { id: guestAttempt.attempt.id } })).userId).toBe(guest.userId);
    expect((await db.user.findUniqueOrThrow({ where: { id: guest.userId } })).status).toBe('DISABLED');
    await expect(resolveGuestIdentity(session.token, db)).rejects.toThrow('GUEST_EXPIRED');
    expect((await db.attempt.findUniqueOrThrow({ where: { id: accountAttempt.attempt.id } })).userId).toBe(account.id);
    await db.attempt.delete({ where: { id: accountAttempt.attempt.id } });
  });

  it('rejects a guest token after its Belgrade play date expires', async () => {
    const session = await openGuestSession(null, db);
    const guestTokenHash = createHash('sha256').update(session.token).digest('hex');
    await db.user.update({ where: { guestTokenHash }, data: { guestPlayDate: new Date(`${belgradeDate(new Date(Date.now() - 86_400_000))}T00:00:00.000Z`) } });
    await expect(resolveGuestIdentity(session.token, db)).rejects.toThrow('GUEST_EXPIRED');
  });
});

afterAll(async () => db.$disconnect());
