import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/server/auth';
import { sameOrigin } from '@/server/http';
import { claimGuestProgress } from '@/server/guest-play';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const parsed = z.object({ token: z.string().min(40).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  try {
    const result = await claimGuestProgress(parsed.data.token, (session.user as { id: string }).id);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'CLAIM_FAILED' }, { status: 409 });
  }
}
