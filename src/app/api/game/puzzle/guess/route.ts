import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { resolvePlayIdentity } from '@/server/guest-play';
import { belgradeDate } from '@/server/calendar';
import { sameOrigin } from '@/server/http';
import { clientIp, rateLimit } from '@/server/rate-limit';

const rewards = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10];
const cyrillicToLatin: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's' };
const normalize = (value: string) => [...value.toLocaleLowerCase('sr')].map((character) => cyrillicToLatin[character] ?? character).join('').replace(/đ/g, 'dj').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  let identity;
  try { identity = await resolvePlayIdentity(request); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 401 }); }
  const limited = await rateLimit(identity.isGuest ? 'PUZZLE_GUEST' : 'PUZZLE_USER', identity.isGuest ? clientIp(request) : identity.userId, 5, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });
  const body = z.object({ guess: z.string().trim().min(1).max(80) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    const day = belgradeDate();
    const set = await db.dailySet.findFirst({ where: { playDate: new Date(`${day}T00:00:00Z`), status: 'PUBLISHED', season: { status: 'PUBLISHED' } }, select: { id: true } });
    if (!set) return NextResponse.json({ error: 'NOT_AVAILABLE' }, { status: 404 });
    const outcome = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM daily_sets WHERE id=${set.id}::uuid FOR UPDATE`;
      const lockedSet = await tx.dailySet.findFirst({ where: { id: set.id, status: 'PUBLISHED', season: { status: 'PUBLISHED' } }, include: { puzzle: true } });
      if (!lockedSet?.puzzle) throw new Error('NOT_AVAILABLE');
      const puzzle = lockedSet.puzzle;
      const active = await tx.attempt.count({ where: { userId: identity.userId, status: 'ACTIVE', challenge: { dailySetId: lockedSet.id } } });
      if (active) throw new Error('QUESTION_ACTIVE');
      const revealed = await tx.attempt.count({ where: { userId: identity.userId, status: { not: 'ACTIVE' }, challenge: { dailySetId: lockedSet.id } } });
      const aliases = Array.isArray(puzzle.acceptedAnswers) ? puzzle.acceptedAnswers.filter((v): v is string => typeof v === 'string') : [];
      const correct = [puzzle.answer, ...aliases].map(normalize).includes(normalize(body.data.guess));
      const reward = correct ? rewards[Math.min(revealed, 8)] : 0;
      const guess = await tx.dailyPuzzleGuess.create({ data: { userId: identity.userId, dailySetId: lockedSet.id, seasonId: lockedSet.seasonId, guessText: body.data.guess, isCorrect: correct, revealedCount: revealed, reward } });
      if (reward > 0) {
        await tx.banknote.create({ data: { puzzleGuessId: guess.id, userId: identity.userId, seasonId: lockedSet.seasonId, denomination: reward, earnedAt: guess.attemptedAt } });
        await tx.seasonTotal.upsert({ where: { userId_seasonId: { userId: identity.userId, seasonId: lockedSet.seasonId } }, create: { userId: identity.userId, seasonId: lockedSet.seasonId, totalAmount: reward, completedCount: 0 }, update: { totalAmount: { increment: reward } } });
      }
      return { correct, reward, revealedCount: revealed };
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json(outcome, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = (error as Error).message;
    return NextResponse.json({ error: code === 'P2002' ? 'GUESS_ALREADY_USED' : code }, { status: code === 'QUESTION_ACTIVE' ? 409 : code === 'GUESS_ALREADY_USED' ? 409 : 422 });
  }
}
