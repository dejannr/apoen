'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePlaySession, guestHeaders } from '@/client/guest-session';
import { gameModeLabel } from '@/domain/game-copy';

type Challenge = { id: string; position: number; title: string; mode: string; category: string; status: string; attemptId: string | null; reward: number | null };
type Today = { playDate: string; state: string; activeAttemptId: string | null; halves: { half: number; challenges: Challenge[] }[] };
type Phase = 'loading' | 'intro' | 'starting' | 'halftime' | 'error' | 'complete' | 'unavailable';
const money = new Intl.NumberFormat('sr-Latn-RS');

export default function TodayQuiz() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [challenge, setChallenge] = useState<Challenge>();
  const [playDate, setPlayDate] = useState('');
  const [halfResults, setHalfResults] = useState<Challenge[]>([]);
  const [nextChallenge, setNextChallenge] = useState<Challenge>();
  const [introSeconds, setIntroSeconds] = useState(3);
  const [error, setError] = useState('');
  const introTimer = useRef<number | undefined>(undefined);

  const beginChallenge = useCallback(async (challengeId: string) => {
    setPhase('starting');
    try {
      await ensurePlaySession();
      const response = await fetch('/api/attempts/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...guestHeaders() },
        body: JSON.stringify({ challengeId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'OUT_OF_ORDER' ? 'Prethodno pitanje još nije završeno.' : result.error === 'HALF_LOCKED' ? 'Nastavi redom kroz prvo poluvreme.' : 'Pitanje trenutno nije moguće pokrenuti.');
      router.replace(`/kviz/${result.attemptId}`);
    } catch (reason) {
      setError((reason as Error).message);
      setPhase('error');
    }
  }, [router]);

  const beginIntro = useCallback((next: Challenge) => {
    if (introTimer.current !== undefined) window.clearInterval(introTimer.current);
    setChallenge(next);
    setIntroSeconds(3);
    setPhase('intro');
    let remaining = 3;
    introTimer.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) setIntroSeconds(remaining);
      else {
        if (introTimer.current !== undefined) window.clearInterval(introTimer.current);
        introTimer.current = undefined;
        void beginChallenge(next.id);
      }
    }, 1000);
  }, [beginChallenge]);

  useEffect(() => {
    let cancelled = false;
    async function prepareQuiz() {
      try {
        await ensurePlaySession();
        const response = await fetch('/api/game/today', { headers: guestHeaders(), cache: 'no-store' });
        const result = await response.json() as Today & { error?: string };
        if (!response.ok) throw new Error(result.error === 'UNAUTHENTICATED' ? 'Osveži stranicu da nastaviš kviz.' : 'Današnji kviz trenutno nije dostupan.');
        if (cancelled) return;
        setPlayDate(result.playDate);
        if (result.activeAttemptId) { router.replace(`/kviz/${result.activeAttemptId}`); return; }
        if (result.state === 'UNAVAILABLE') { setPhase('unavailable'); return; }

        const challenges = result.halves.flatMap((half) => half.challenges).sort((a, b) => a.position - b.position);
        const next = challenges.find((item) => item.status === 'NOT_STARTED');
        if (result.state === 'BREAK' && next) {
          setHalfResults(challenges.filter((item) => item.position <= 4));
          setNextChallenge(next);
          setPhase('halftime');
          return;
        }
        if (!next || result.state === 'COMPLETED') { setPhase('complete'); return; }
        beginIntro(next);
      } catch (reason) {
        if (!cancelled) { setError((reason as Error).message); setPhase('error'); }
      }
    }

    void prepareQuiz();
    return () => {
      cancelled = true;
      if (introTimer.current !== undefined) window.clearInterval(introTimer.current);
    };
  }, [beginIntro, router]);

  const halfTotal = halfResults.reduce((sum, result) => sum + (result.reward ?? 0), 0);

  return <main className="quiz-flow">
    <Link href="/">← Početna</Link>
    {phase === 'loading' && <section className="panel"><h1>Pripremamo današnji kviz…</h1></section>}
    {phase === 'intro' && challenge && <section className="panel quiz-intro" aria-live="polite">
      <p className="eyebrow">{challenge.position}. PITANJE · {challenge.category}</p>
      <h1>{gameModeLabel(challenge.mode)}</h1>
      <p>Pitanje počinje za</p>
      <strong className="intro-count" aria-label={`${introSeconds} sekunde`}>{introSeconds}</strong>
    </section>}
    {phase === 'starting' && <section className="panel"><p className="eyebrow">{challenge && gameModeLabel(challenge.mode)}</p><h1>Spremi se…</h1></section>}
    {phase === 'halftime' && <section className="panel halftime-card">
      <p className="eyebrow">{playDate} · PAUZA</p>
      <h1>Rezultati prvog poluvremena</h1>
      <div className="halftime-results">{halfResults.map((result) => <article className="halftime-row" key={result.id}>
        <span>{result.position}. pitanje · {result.title}</span>
        <strong>{money.format(result.reward ?? 0)} RSD</strong>
      </article>)}</div>
      <div className="halftime-total"><span>Ukupno osvojeno</span><strong>{money.format(halfTotal)} RSD</strong></div>
      <p>Drugo poluvreme počinje pitanjem broj 5.</p>
      {nextChallenge && <button className="button" onClick={() => beginIntro(nextChallenge)}>Nastavi na pitanje 5 →</button>}
    </section>}
    {phase === 'error' && <section className="panel"><h1>Kviz nije mogao da se pokrene</h1><p role="alert">{error}</p><button className="button" onClick={() => window.location.reload()}>Pokušaj ponovo</button></section>}
    {phase === 'unavailable' && <section className="panel"><h1>Današnji kviz još nije dostupan</h1><p>Novi dnevni set još nije objavljen.</p></section>}
    {phase === 'complete' && <section className="panel"><p className="eyebrow">{playDate}</p><h1>Današnji kviz je završen!</h1><p>Odgovorio/la si na sva današnja pitanja. Novi kviz stiže sutra.</p><Link className="button" href="/">Povratak na početnu</Link></section>}
    <p className="muted">Gostujući napredak čuva se u ovom pregledaču do sutra. Nakon prijave ili registracije možeš ga preneti na nalog.</p>
  </main>;
}
