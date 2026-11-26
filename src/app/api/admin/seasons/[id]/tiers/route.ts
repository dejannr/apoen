import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminIdentity } from '@/server/admin';
import { db } from '@/server/db';
import { sameOrigin } from '@/server/http';

const tier = z.object({
  tierNo: z.number().int().positive(),
  thresholdAmount: z.number().int().nonnegative(),
  tierName: z.string().trim().min(1).max(120),
  description: z.string().max(1000),
  assetId: z.string().uuid(),
  assetAlt: z.string().trim().min(1).max(250),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const admin = await adminIdentity();
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.error === 'UNAUTHENTICATED' ? 401 : 403 });
  const parsed = z.array(tier).min(1).max(100).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  const tiers = parsed.data;
  if (!tiers.some((item) => item.thresholdAmount === 0) || new Set(tiers.map((item) => item.tierNo)).size !== tiers.length || new Set(tiers.map((item) => item.thresholdAmount)).size !== tiers.length) {
    return NextResponse.json({ error: 'INVALID_TIERS' }, { status: 422 });
  }
  const id = (await params).id;
  try {
    const result = await db.$transaction(async (tx) => {
      const season = await tx.season.findUnique({ where: { id }, select: { status: true } });
      if (!season || season.status !== 'DRAFT') throw new Error('NOT_EDITABLE');
      await tx.collectibleTier.deleteMany({ where: { seasonId: id } });
      const rows = tiers.map((item) => ({ ...item, seasonId: id }));
      await tx.collectibleTier.createMany({ data: rows });
      await tx.adminAudit.create({ data: { actorId: admin.user.id, action: 'EDIT', entityType: 'SEASON_TIERS', entityId: id, details: { tierCount: tiers.length } } });
      return tx.collectibleTier.findMany({ where: { seasonId: id }, orderBy: { tierNo: 'asc' } });
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === 'NOT_EDITABLE' ? 'NOT_EDITABLE' : 'TIER_CONFLICT' }, { status: error instanceof Error && error.message === 'NOT_EDITABLE' ? 409 : 422 });
  }
}
