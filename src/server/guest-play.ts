import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { db } from './db';
import { authOptions } from './auth';
import { belgradeDate } from './calendar';

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dateValue = (day: string) => new Date(`${day}T00:00:00.000Z`);

export type PlayIdentity = { userId: string; isGuest: boolean };

export async function resolveGuestIdentity(token: string | null, client: PrismaClient = db): Promise<PlayIdentity> {
  if (!token || token.length < 40 || token.length > 100) throw new Error('UNAUTHENTICATED');
  const guest = await client.user.findUnique({ where: { guestTokenHash: tokenHash(token) }, select: { id: true, isGuest: true, guestPlayDate: true, status: true } });
  if (!guest || !guest.isGuest || guest.status !== 'ACTIVE' || guest.guestPlayDate?.toISOString().slice(0, 10) !== belgradeDate()) throw new Error('GUEST_EXPIRED');
  return { userId: guest.id, isGuest: true };
}

export async function resolvePlayIdentity(request: Request): Promise<PlayIdentity> {
  const session = await getServerSession(authOptions);
  if (session?.user) return { userId: (session.user as { id: string }).id, isGuest: false };
  return resolveGuestIdentity(request.headers.get('x-apoen-guest-token'));
}

export async function openGuestSession(existingToken?: string | null, client: PrismaClient = db) {
  const day = belgradeDate();
  if (existingToken && existingToken.length >= 40 && existingToken.length <= 100) {
    const found = await client.user.findUnique({ where: { guestTokenHash: tokenHash(existingToken) }, select: { isGuest: true, guestPlayDate: true, status: true } });
    if (found?.isGuest && found.status === 'ACTIVE' && found.guestPlayDate?.toISOString().slice(0, 10) === day) return { token: existingToken, playDate: day };
  }
  const token = randomBytes(32).toString('base64url');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 18).toLowerCase();
  await client.user.create({ data: {
    email: `guest-${suffix}@guest.apoen.invalid`,
    nickname: `Gost-${suffix.slice(0, 10)}`,
    nicknameKey: `gost-${suffix}`,
    passwordHash: `guest-disabled:${randomBytes(32).toString('hex')}`,
    status: 'ACTIVE', isGuest: true, guestTokenHash: tokenHash(token), guestPlayDate: dateValue(day),
  }, select: { id: true } });
  return { token, playDate: day };
}

export async function claimGuestProgress(token: string, userId: string, client: PrismaClient = db) {
  if (token.length < 40 || token.length > 100) throw new Error('GUEST_EXPIRED');
  const day = belgradeDate();
  for (let retry = 0; retry < 4; retry++) {
    try { return await client.$transaction(async (tx) => {
    const guest = await tx.user.findUnique({ where: { guestTokenHash: tokenHash(token) }, select: { id: true, isGuest: true, guestPlayDate: true } });
    if (!guest?.isGuest || guest.guestPlayDate?.toISOString().slice(0, 10) !== day) return { status: 'EXPIRED' as const, transferred: 0 };
    const guestAttempts = await tx.attempt.findMany({
      where: { userId: guest.id, challenge: { dailySet: { playDate: dateValue(day) } } },
      select: { id: true, seasonId: true, finalReward: true },
    });
    const accountHasPlayed = await tx.attempt.count({ where: { userId, challenge: { dailySet: { playDate: dateValue(day) } } } });
    if (accountHasPlayed) {
      await tx.user.update({ where: { id: guest.id }, data: { status: 'DISABLED', guestTokenHash: null } });
      return { status: 'ALREADY_PLAYED' as const, transferred: 0 };
    }
    if (guestAttempts.length) {
      await tx.$queryRaw`SELECT set_config('apoen.allow_guest_transfer', 'on', true)`;
      await tx.attempt.updateMany({ where: { id: { in: guestAttempts.map((a) => a.id) }, userId: guest.id }, data: { userId } });
      const totals = await tx.seasonTotal.findMany({ where: { userId: guest.id } });
      for (const total of totals) {
        await tx.seasonTotal.upsert({
          where: { userId_seasonId: { userId, seasonId: total.seasonId } },
          create: { userId, seasonId: total.seasonId, totalAmount: total.totalAmount, completedCount: total.completedCount },
          update: { totalAmount: { increment: total.totalAmount }, completedCount: { increment: total.completedCount } },
        });
      }
      await tx.seasonTotal.deleteMany({ where: { userId: guest.id } });
    }
    await tx.user.update({ where: { id: guest.id }, data: { status: 'DISABLED', guestTokenHash: null } });
    return { status: 'TRANSFERRED' as const, transferred: guestAttempts.length };
    }, { isolationLevel: 'Serializable' }); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2034' && retry < 3) { await new Promise((resolve) => setTimeout(resolve, 10 * (retry + 1))); continue; }
      throw error;
    }
  }
  throw new Error('CONCURRENT_RETRY');
}
