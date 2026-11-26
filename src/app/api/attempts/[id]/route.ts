import { NextResponse } from 'next/server';
import { attemptSnapshot } from '@/server/game';
import { resolvePlayIdentity } from '@/server/guest-play';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let identity;
  try { identity = await resolvePlayIdentity(request); }
  catch (error) { const code = (error as Error).message; return NextResponse.json({ error: code }, { status: code === 'UNAUTHENTICATED' ? 401 : 410 }); }
  try {
    return NextResponse.json(await attemptSnapshot(identity.userId, (await params).id), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 }); }
}
