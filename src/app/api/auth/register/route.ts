import{sameOrigin}from'@/server/http';import{clientIp,rateLimit}from'@/server/rate-limit';import{isReservedNickname,normalizeNickname}from'@/domain/identity';import { NextResponse } from 'next/server';
import { z } from 'zod';
import argon2 from 'argon2';
import { db } from '@/server/db';
const schema = z.object({ email:z.string().trim().email().max(254), nickname:z.string().min(3).max(24).regex(/^[\p{L}\p{N}_]+$/u), password:z.string().min(12).max(128) });
export async function POST(request: Request) {
  if(!sameOrigin(request))return NextResponse.json({error:'INVALID_ORIGIN'},{status:403});const ip=clientIp(request),rl=await rateLimit('REGISTER_IP',ip,10,60*60_000);if(!rl.allowed)return NextResponse.json({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':String(rl.retryAfter)}});
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({error:'Neispravan zahtev.'},{status:400}); }
  const data = schema.safeParse(body); if (!data.success) return NextResponse.json({error:'Proveri email, nadimak i lozinku.'},{status:400});
  const nickname=normalizeNickname(data.data.nickname),nicknameKey=nickname.toLocaleLowerCase('sr-Latn-RS');if(isReservedNickname(nickname))return NextResponse.json({error:'Proveri email, nadimak i lozinku.'},{status:400});const email=data.data.email.toLowerCase();
  try { const user=await db.user.create({data:{email,nickname,nicknameKey,passwordHash:await argon2.hash(data.data.password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1})},select:{id:true}}); return NextResponse.json({id:user.id},{status:201}); }
  catch { return NextResponse.json({error:'Email ili nadimak su već zauzeti.'},{status:409}); }
}
