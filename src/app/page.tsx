import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect('/kviz');

  return <main><div className="brand">apoen</div><section><p className="eyebrow">DNEVNA KVIZ IGRA</p><h1>Svaki dan korak bliže milionu.</h1><p>Osam izazova. Virtuelni dinari. Nova prilika svakog dana.</p><div className="controls"><Link className="button" href="/register">Registracija</Link><Link className="button secondary" href="/login">Prijava</Link><Link href="/pravila">Pravila igre</Link></div><p className="notice">apoen koristi samo virtuelne dinare. Nema uloga ni isplata.</p></section></main>;
}
