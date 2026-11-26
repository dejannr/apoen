'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePlaySession, guestHeaders } from '@/client/guest-session';

type Challenge = { id: string; position: number; mode: string; category: string; status: string; attemptId: string | null; reward: number | null };
type Today = { playDate: string; state: string; halves: { half: number; challenges: Challenge[] }[] };

export default function TodayQuiz() {
  const router = useRouter();
  const [data, setData] = useState<Today>();
  const [error, setError] = useState('');
  const [starting, setStarting] = useState('');

  async function refresh() {
    await ensurePlaySession();
    const response = await fetch('/api/game/today', { headers: guestHeaders(), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error === 'UNAUTHENTICATED' ? 'Prijavi se ili osveži stranicu.' : 'Današnji kviz trenutno nije dostupan.');
    setData(result as Today);
  }

  useEffect(() => { void Promise.resolve().then(refresh).catch((reason: Error) => setError(reason.message)); }, []);

  async function start(challengeId: string) {
    setStarting(challengeId); setError('');
    try {
      await ensurePlaySession();
      const response = await fetch('/api/attempts/start', { method: 'POST', headers: { 'content-type': 'application/json', ...guestHeaders() }, body: JSON.stringify({ challengeId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'OUT_OF_ORDER' ? 'Prvo završi prethodni izazov.' : result.error === 'HALF_LOCKED' ? 'Prvo završi prvo poluvreme.' : 'Izazov trenutno nije moguće pokrenuti.');
      router.push(`/kviz/${result.attemptId}`);
    } catch (reason) { setError((reason as Error).message); await refresh().catch(() => undefined); }
    finally { setStarting(''); }
  }

  return <main>
    <Link href="/">← Početna</Link>
    <h1>Današnji kviz</h1>
    <p>Gostujući napredak se čuva u ovom pregledaču do sutra. Nakon prijave ili registracije preneće se na nalog ako danas već nisi igrao/la.</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>Učitavanje kviza…</p>}
    {data && data.state === 'UNAVAILABLE' && <p>Današnji kviz još nije objavljen.</p>}
    {data?.halves.map(({ half, challenges }) => <section className="panel" key={half}><h2>{half}. poluvreme</h2><div className="quizgrid">{challenges.map((challenge) => <article className="challenge" key={challenge.id}>
      <span>{challenge.position}. izazov · {challenge.category}</span><strong>{challenge.mode.replace('_', ' ')}</strong>
      {challenge.attemptId && challenge.status === 'ACTIVE' ? <Link className="button" href={`/kviz/${challenge.attemptId}`}>Nastavi</Link> : challenge.status !== 'NOT_STARTED' ? <small>Završeno · {challenge.reward ?? 0} RSD</small> : <button className="button" disabled={Boolean(starting)} onClick={() => void start(challenge.id)}>{starting === challenge.id ? 'Pokrećem…' : 'Započni izazov'}</button>}
    </article>)}</div></section>)}
    {data && <p className="muted">{data.playDate} · {data.state === 'COMPLETED' ? 'Današnji kviz završen' : 'Rezultati se obračunavaju na serveru'}</p>}
  </main>;
}
