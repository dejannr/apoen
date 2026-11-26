import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/server/auth';
import { monthBounds } from '@/server/calendar';
import { db } from '@/server/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { year, month } = monthBounds();
  const season = await db.season.findFirst({
    where: { year, month, status: 'PUBLISHED' },
    include: { tiers: { orderBy: { thresholdAmount: 'asc' } } },
  });
  const history = await db.userCollectible.findMany({
    where: { userId },
    orderBy: { awardedAt: 'desc' },
    include: { season: { select: { id: true, year: true, month: true, collectibleTheme: true } }, tier: { select: { id: true, tierNo: true, thresholdAmount: true, tierName: true, description: true, assetId: true, assetAlt: true } } },
  });
  if (!season) return NextResponse.json({ season: null, totalAmount: 0, currentTier: null, nextTier: null, progress: null, history }, { headers: { 'Cache-Control': 'private, no-store' } });
  const total = await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId, seasonId: season.id } }, select: { totalAmount: true } });
  const totalAmount = total?.totalAmount ?? 0;
  const currentTier = total ? [...season.tiers].reverse().find((tier) => tier.thresholdAmount <= totalAmount) ?? null : null;
  const nextTier = currentTier ? season.tiers.find((tier) => tier.tierNo === currentTier.tierNo + 1) ?? null : season.tiers[0] ?? null;
  const progress = nextTier && currentTier ? Math.max(0, Math.min(1, (totalAmount - currentTier.thresholdAmount) / (nextTier.thresholdAmount - currentTier.thresholdAmount))) : null;
  const tierDto = (tier: typeof currentTier) => tier ? ({ id: tier.id, tierNo: tier.tierNo, thresholdAmount: tier.thresholdAmount, name: tier.tierName, description: tier.description, assetId: tier.assetId, assetUrl: `/api/assets/${tier.assetId}`, assetAlt: tier.assetAlt }) : null;
  return NextResponse.json({ season: { id: season.id, year, month, theme: season.collectibleTheme }, totalAmount, currentTier: tierDto(currentTier), nextTier: tierDto(nextTier), progress, history }, { headers: { 'Cache-Control': 'private, no-store' } });
}
