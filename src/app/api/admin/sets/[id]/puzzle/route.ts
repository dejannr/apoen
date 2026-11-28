import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminIdentity } from '@/server/admin';
import { sameOrigin } from '@/server/http';
import { db } from '@/server/db';
import { belgradeDate } from '@/server/calendar';

const schema = z.object({ assetId: z.string().uuid(), answer: z.string().trim().min(2).max(80), acceptedAnswers: z.array(z.string().trim().min(1).max(80)).max(20).default([]) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const actor = await adminIdentity();
  if ('error' in actor) return NextResponse.json({ error: actor.error }, { status: actor.error === 'UNAUTHENTICATED' ? 401 : 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const id = (await params).id;
  const set = await db.dailySet.findUnique({ where: { id }, select: { id: true, status: true, playDate: true } });
  if (!set || !['DRAFT', 'PUBLISHED'].includes(set.status)) return NextResponse.json({ error: 'NOT_EDITABLE' }, { status: 409 });
  if (set.status === 'PUBLISHED' && set.playDate.toISOString().slice(0, 10) < belgradeDate()) return NextResponse.json({ error: 'NOT_EDITABLE' }, { status: 409 });
  if (set.status === 'PUBLISHED' && await db.attempt.count({ where: { challenge: { dailySetId: id } } })) return NextResponse.json({ error: 'SET_ALREADY_PLAYED' }, { status: 409 });
  const asset = await db.mediaAsset.findUnique({ where: { id: parsed.data.assetId }, select: { mimeType: true, byteSize: true, bytes: true, sha256: true } });
  if (!asset || !asset.mimeType.startsWith('image/') || asset.byteSize > 5 * 1024 * 1024 || !asset.bytes.length) return NextResponse.json({ error: 'INVALID_ASSET' }, { status: 422 });
  try {
    const puzzle = await db.$transaction(async (tx) => {
      const existing = await tx.dailyPuzzle.findUnique({ where: { dailySetId: id } });
      if (existing && (await tx.dailyPuzzleGuess.count({ where: { dailySetId: id } }))) throw new Error('PUZZLE_ALREADY_PLAYED');
      const row = await tx.dailyPuzzle.upsert({ where: { dailySetId: id }, create: { dailySetId: id, assetId: parsed.data.assetId, answer: parsed.data.answer, acceptedAnswers: [...new Set(parsed.data.acceptedAnswers.filter(Boolean))] }, update: { assetId: parsed.data.assetId, answer: parsed.data.answer, acceptedAnswers: [...new Set(parsed.data.acceptedAnswers.filter(Boolean))] } });
      await tx.adminAudit.create({ data: { actorId: actor.user.id, action: existing ? 'EDIT' : 'CREATE', entityType: 'DAILY_PUZZLE', entityId: row.id, details: { dailySetId: id, assetId: parsed.data.assetId } } });
      return row;
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ id: puzzle.id, dailySetId: puzzle.dailySetId, assetId: puzzle.assetId });
  } catch (error) {
    const code = (error as Error).message;
    return NextResponse.json({ error: code === 'PUZZLE_ALREADY_PLAYED' ? code : 'ASSET_ALREADY_ASSIGNED_OR_PUZZLE_LOCKED' }, { status: 409 });
  }
}
