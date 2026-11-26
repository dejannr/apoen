import { NextResponse } from 'next/server';
import { z } from 'zod';
import { previewChallenge } from '@/domain/preview';
import { adminIdentity } from '@/server/admin';
import { sameOrigin } from '@/server/http';

const integerString = z.union([z.string().regex(/^-?\d+$/), z.number().int().safe()]).transform(String);
const schema = z.object({
  mode: z.enum(['EDGE', 'CONFIDENCE', 'ORDER', 'HIGH_LOW']),
  publicConfig: z.record(z.string(), z.unknown()),
  rewardRules: z.record(z.string(), z.unknown()),
  options: z.array(z.object({ label: z.string().max(500), sortOrder: z.number().int().optional(), numericValue: integerString.optional(), correctFlag: z.boolean().optional(), orderRank: z.number().int().optional() }).strict()).min(2).max(12),
}).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const admin = await adminIdentity();
  if ('error' in admin) return NextResponse.json({ error: admin.error }, { status: admin.error === 'UNAUTHENTICATED' ? 401 : 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = previewChallenge(parsed.data.mode, parsed.data.publicConfig as never, parsed.data.rewardRules as never, parsed.data.options);
    return NextResponse.json(result, { status: result.valid ? 200 : 422, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'PREVIEW_FAILED' }, { status: 422, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
