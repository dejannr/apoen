import Link from 'next/link';
import SignOut from '@/components/sign-out';
import DashboardQuizCard from '@/components/dashboard-quiz-card';
import { db } from '@/server/db';
import { monthBounds, belgradeDate } from '@/server/calendar';

export const dynamic = 'force-dynamic';
const money = (n: number) => new Intl.NumberFormat('sr-Latn-RS').format(n);

export default async function DashboardHome({ user }: { user: { id: string; name?: string | null; role?: string } | null }) {
  const today = belgradeDate();
  const { year, month } = monthBounds();
  const season = await db.season.findFirst({ where: { year, month, status: 'PUBLISHED' }, include: { tiers: { include: { asset: { select: { id: true } } }, orderBy: { thresholdAmount: 'asc' } } } });
  const total = user && season ? (await db.seasonTotal.findUnique({ where: { userId_seasonId: { userId: user.id, seasonId: season.id } } }))?.totalAmount ?? 0 : 0;
  const rank = user && season ? await db.seasonTotal.count({ where: { seasonId: season.id, totalAmount: { gt: total }, user: { isGuest: false, status: 'ACTIVE' } } }) + 1 : null;
  const current = season?.tiers.filter((tier) => tier.thresholdAmount <= total).at(-1);
  const next = season?.tiers.find((tier) => tier.thresholdAmount > total);
  const set = season ? await db.dailySet.findFirst({ where: { seasonId: season.id, playDate: new Date(`${today}T00:00:00.000Z`), status: 'PUBLISHED' }, select: { id: true } }) : null;

  return <main>
    <header className="top">
      <Link href="/" className="brand">apoen</Link>
      <nav><Link href="/">Početna</Link><Link href="/kviz">Kviz</Link>{user && <><Link href="/banka">Banka</Link><Link href="/rang-lista">Rang-lista</Link><Link href="/kolekcija">Kolekcija</Link><Link href="/profil">Profil</Link>{user.role === 'ADMIN' && <Link href="/admin">Admin</Link>}</>}{!user && <Link href="/pravila">Pravila igre</Link>}</nav>
      {user ? <><span>{user.name}</span><SignOut /></> : <div className="controls"><Link href="/register">Registracija</Link><Link href="/login">Prijava</Link></div>}
    </header>
    <p className="eyebrow">{today} · DNEVNI KVIZ</p>
    <h1>Danas ideš do miliona.</h1>
    <p>Osam izazova u dva poluvremena. Igraj bez naloga i sačuvaj napredak u ovom pregledaču do sutra.</p>
    <div className="cards">
      <article><p>{user ? 'MOJA BANKA' : 'VIRTUELNA NAGRADA'}</p><strong>{user ? `${money(total)} RSD` : 'Do 1.000.000 RSD'}</strong><small>{user ? 'virtuelni dinari' : 'bez uloga i isplata'}</small></article>
      <article><p>MESEČNI PLASMAN</p><strong>{rank ? `#${rank}` : '—'}</strong><small>{user && season ? 'u tekućoj sezoni' : 'napravi nalog da pratiš plasman'}</small></article>
      <article><p>KOLEKCIONARSKI PREDMET</p><strong>{user ? current?.tierName ?? '—' : season?.collectibleTheme ?? '—'}</strong><small>{season?.collectibleTheme ?? 'Predmet će se pojaviti kada sezona bude objavljena'}</small></article>
    </div>
    <DashboardQuizCard available={Boolean(set)} authenticated={Boolean(user)} />
    {user && next && <p className="muted">Do nivoa „{next.tierName}” nedostaje {money(next.thresholdAmount - total)} RSD.</p>}
  </main>;
}
