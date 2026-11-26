import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import argon2 from 'argon2';
import { z } from 'zod';
import { db } from './db';
import { rateLimit,rateLimitStatus } from './rate-limit';

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [CredentialsProvider({
    name: 'Email i lozinka',
    credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Lozinka', type: 'password' } },
    async authorize(credentials, request) {
      const ip=request.headers?.['x-forwarded-for']?.split(',')[0]??'local';const ipLimit=await rateLimitStatus('LOGIN_IP',ip,30,15*60_000);
      const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }).safeParse(credentials);
      if (!parsed.success||!ipLimit.allowed) return null;
      const email=parsed.data.email.trim().toLowerCase(),accountLimit=await rateLimitStatus('LOGIN_ACCOUNT',email,5,15*60_000);if(!accountLimit.allowed)return null;
      const user = await db.user.findUnique({ where: { email } });
      if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, parsed.data.password))) { await Promise.all([rateLimit('LOGIN_IP',ip,30,15*60_000),rateLimit('LOGIN_ACCOUNT',email,5,15*60_000)]);return null; }
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return { id: user.id, name: user.nickname, email: user.email, role: user.role, sessionVersion: user.sessionVersion } as never;
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.role = (user as unknown as {role:string}).role; token.sessionVersion = (user as unknown as {sessionVersion:number}).sessionVersion; }
      if (token.sub) { const current=await db.user.findUnique({where:{id:token.sub},select:{status:true,sessionVersion:true,role:true}}); if(!current||current.status!=='ACTIVE'||current.sessionVersion!==token.sessionVersion){token.invalid=true}else{token.role=current.role;token.invalid=false} }
      return token;
    },
    async session({ session, token }) {
      if(token.invalid){session.user=null as never;return session}
      if (session.user) { (session.user as typeof session.user & {id:string;role:string}).id = token.sub!; (session.user as typeof session.user & {role:string}).role = String(token.role ?? 'PLAYER'); }
      return session;
    },
  },
};
