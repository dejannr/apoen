import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminIdentity } from '@/server/admin';
import { db } from '@/server/db';
import { sameOrigin } from '@/server/http';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const admin = await adminIdentity();
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.error === 'UNAUTHENTICATED' ? 401 : 403 });
  const input = z.object({ theme: z.string().trim().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const id = (await params).id;
  const result = await db.$transaction(async (tx) => {
    const season = await tx.season.findUnique({ where: { id }, select: { status: true } });
    if (!season || season.status !== 'DRAFT') return null;
    const updated = await tx.season.update({ where: { id }, data: { collectibleTheme: input.data.theme } });
    await tx.adminAudit.create({ data: { actorId: admin.user.id, action: 'EDIT', entityType: 'SEASON', entityId: id, details: { theme: input.data.theme } } });
    return updated;
  });
  if (!result) return NextResponse.json({ error: 'NOT_EDITABLE' }, { status: 409 });
  return NextResponse.json(result);
}
