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

  return <>
    <main>
    <header className="top">
      <Link href="/" className="brand">apoen</Link>
      {user?.role === 'ADMIN' && <nav aria-label="Glavna navigacija"><Link href="/admin">Admin</Link></nav>}
      {user ? <details className="account-menu">
        <summary>{user.name || 'Moj nalog'}</summary>
        <div className="account-dropdown">
          <Link href="/profil">Profil</Link>
          <SignOut />
        </div>
      </details> : <div className="controls"><Link href="/register">Registracija</Link><Link href="/login">Prijava</Link></div>}
    </header>
    <p className="eyebrow">{today} · DNEVNI KVIZ</p>
    <h1>Danas ideš do miliona.</h1>
    <p>Osam izazova u dva poluvremena. Igraj bez naloga i sačuvaj napredak u ovom pregledaču do sutra.</p>
    <div className="cards">
      <Link className="home-card" href="/banka"><p>MOJA BANKA</p><strong>{user ? `${money(total)} RSD` : 'Otvori banku'}</strong><small>{user ? 'virtuelni dinari' : 'potrebna je prijava'}</small></Link>
      <Link className="home-card" href="/kolekcija"><p>MOJA KOLEKCIJA</p><strong>{user ? current?.tierName ?? 'Još nema predmeta' : 'Otvori kolekciju'}</strong><small>{user ? season?.collectibleTheme ?? 'Osvojeni predmeti' : 'potrebna je prijava'}</small></Link>
      <Link className="home-card" href="/rang-lista"><p>RANG-LISTA</p><strong>{rank ? `#${rank}` : 'Pogledaj plasman'}</strong><small>{user && season ? 'tvoj mesečni plasman' : 'mesečni plasman igrača'}</small></Link>
    </div>
    <DashboardQuizCard available={Boolean(set)} authenticated={Boolean(user)} />
    {user && next && <p className="muted">Do nivoa „{next.tierName}” nedostaje {money(next.thresholdAmount - total)} RSD.</p>}
    </main>
    <footer className="site-footer"><Link href="/pravila">Pravila igre</Link></footer>
  </>;
}
