'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensurePlaySession, guestHeaders } from '@/client/guest-session';
import { gameModeLabel } from '@/domain/game-copy';

type Challenge = { id: string; position: number; title: string; mode: string; category: string; status: string; attemptId: string | null; reward: number | null; jokerUsed?: boolean };
type Puzzle = { imageUrl: string; revealedCount: number; guessUsed: boolean; result: null | { correct: boolean; reward: number; revealedCount: number } };
type Today = { playDate: string; state: string; activeAttemptId: string | null; halves: { half: number; challenges: Challenge[] }[]; joker: { position: number | null; used: boolean }; puzzle: Puzzle | null };
type Phase = 'loading' | 'briefing' | 'starting' | 'halftime' | 'error' | 'complete' | 'unavailable';
const money = new Intl.NumberFormat('sr-Latn-RS');
const puzzleRewards = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export default function TodayQuiz() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [challenge, setChallenge] = useState<Challenge>();
  const [playDate, setPlayDate] = useState('');
  const [halfResults, setHalfResults] = useState<Challenge[]>([]);
  const [finalResults, setFinalResults] = useState<Challenge[]>([]);
  const [nextChallenge, setNextChallenge] = useState<Challenge>();
  const [joker, setJoker] = useState<Today['joker']>({ position: null, used: false });
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guess, setGuess] = useState('');
  const [guessMessage, setGuessMessage] = useState('');
  const [jokerMessage, setJokerMessage] = useState('');
  const [savingJoker, setSavingJoker] = useState(false);
  const [sendingGuess, setSendingGuess] = useState(false);
  const [error, setError] = useState('');

  const beginChallenge = useCallback(async (next: Challenge) => {
    setPhase('starting');
    try {
      await ensurePlaySession();
      const response = await fetch('/api/attempts/start', {
        method: 'POST', headers: { 'content-type': 'application/json', ...guestHeaders() }, body: JSON.stringify({ challengeId: next.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'OUT_OF_ORDER' ? 'Prethodno pitanje još nije završeno.' : result.error === 'HALF_LOCKED' ? 'Nastavi redom kroz prvo poluvreme.' : 'Pitanje trenutno nije moguće pokrenuti.');
      router.replace(`/kviz/${result.attemptId}`);
    } catch (reason) { setError((reason as Error).message); setPhase('error'); }
  }, [router]);

  const prepareQuiz = useCallback(async () => {
    await ensurePlaySession();
    const response = await fetch('/api/game/today', { headers: guestHeaders(), cache: 'no-store' });
    const result = await response.json() as Today & { error?: string };
    if (!response.ok) throw new Error(result.error === 'UNAUTHENTICATED' ? 'Osveži stranicu da nastaviš kviz.' : 'Današnji kviz trenutno nije dostupan.');
    setPlayDate(result.playDate); setJoker(result.joker); setPuzzle(result.puzzle);
    if (result.activeAttemptId) { router.replace(`/kviz/${result.activeAttemptId}`); return; }
    if (result.state === 'UNAVAILABLE') { setPhase('unavailable'); return; }
    const challenges = result.halves.flatMap((half) => half.challenges).sort((a, b) => a.position - b.position);
    const next = challenges.find((item) => item.status === 'NOT_STARTED');
    if (result.state === 'BREAK' && next) { setHalfResults(challenges.filter((item) => item.position <= 4)); setNextChallenge(next); setPhase('halftime'); return; }
    if (result.state === 'COMPLETED' || !next) { setFinalResults(challenges); setPhase('complete'); return; }
    setChallenge(next); setPhase('briefing');
  }, [router]);

  useEffect(() => { let cancelled = false; const timer = window.setTimeout(() => { void prepareQuiz().catch((reason) => { if (!cancelled) { setError((reason as Error).message); setPhase('error'); } }); }, 0); return () => { cancelled = true; window.clearTimeout(timer); }; }, [prepareQuiz]);

  async function activateJoker() {
    if (!challenge || joker.position || joker.used) return;
    setSavingJoker(true);
    try {
      const response = await fetch('/api/game/joker', { method: 'POST', headers: { 'content-type': 'application/json', ...guestHeaders() }, body: JSON.stringify({ position: challenge.position }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === 'JOKER_ALREADY_USED' ? 'Džoker je već iskorišćen.' : 'Džoker trenutno nije moguće aktivirati.');
      setJoker(data);
    } catch (reason) { setJokerMessage((reason as Error).message); }
    finally { setSavingJoker(false); }
  }

  async function submitGuess() {
    if (!guess.trim() || !puzzle || puzzle.guessUsed) return;
    setSendingGuess(true); setGuessMessage('');
    try {
      const response = await fetch('/api/game/puzzle/guess', { method: 'POST', headers: { 'content-type': 'application/json', ...guestHeaders() }, body: JSON.stringify({ guess }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'GUESS_ALREADY_USED' ? 'Današnji pokušaj je već iskorišćen.' : 'Pokušaj trenutno nije moguće sačuvati.');
      setPuzzle({ ...puzzle, guessUsed: true, result });
      setGuessMessage(result.correct ? `Tačno! Osvojio/la si ${money.format(result.reward)} RSD.` : 'Nije tačno. Dnevni pokušaj je iskorišćen.');
    } catch (reason) { setGuessMessage((reason as Error).message); }
    finally { setSendingGuess(false); }
  }

  const halfTotal = halfResults.reduce((sum, result) => sum + (result.reward ?? 0), 0);
  const firstHalfResults = finalResults.filter((result) => result.position <= 4);
  const secondHalfResults = finalResults.filter((result) => result.position > 4);
  const firstHalfTotal = firstHalfResults.reduce((sum, result) => sum + (result.reward ?? 0), 0);
  const secondHalfTotal = secondHalfResults.reduce((sum, result) => sum + (result.reward ?? 0), 0);
  const finalTotal = finalResults.reduce((sum, result) => sum + (result.reward ?? 0), 0);
  const puzzleTotal = puzzle?.result?.reward ?? 0;
  const resultRows = (results: Challenge[]) => results.map((result) => <article className="halftime-row" key={result.id}><span>{result.position}. pitanje · {result.title}{result.jokerUsed ? ' · džoker 2×' : ''}</span><strong>{money.format(result.reward ?? 0)} RSD</strong></article>);

  function puzzlePanel() {
    if (!puzzle) return null;
    const revealed = puzzle.result?.correct ? 8 : puzzle.revealedCount;
    const reward = puzzleRewards[Math.min(puzzle.revealedCount, 8)];
    return <section className="picture-puzzle panel" aria-label="Dnevna slika-zagonetka">
      <div><p className="eyebrow">DNEVNA SLIKA · {puzzle.revealedCount}/8 DELOVA</p><h2>Pogodi šta je na slici</h2><p>{puzzle.guessUsed ? 'Dnevni pokušaj je iskorišćen.' : `Jedan pokušaj · nagrada sada: ${money.format(reward)} RSD`}</p></div>
      <div className="puzzle-image" style={{ backgroundImage: `url("${puzzle.imageUrl}")` }} role="img" aria-label={`Slika prekrivena delovima, ${revealed} od 8 otkriveno`}>
        {Array.from({ length: 8 }, (_, index) => <span key={index} className={index < revealed ? 'puzzle-tile revealed' : 'puzzle-tile'} aria-hidden="true" />)}
      </div>
      {puzzle.result && <p className="puzzle-feedback" role="status">{puzzle.result.correct ? `Tačan odgovor · ${money.format(puzzle.result.reward)} RSD` : 'Odgovor nije tačan. Sutra stiže nova slika.'}</p>}
      {!puzzle.guessUsed && <form className="puzzle-guess" onSubmit={(event) => { event.preventDefault(); void submitGuess(); }}><label htmlFor="puzzle-guess">Tvoj odgovor</label><input id="puzzle-guess" value={guess} onChange={(event) => setGuess(event.target.value)} maxLength={80} autoComplete="off"/><button className="button secondary" disabled={sendingGuess || !guess.trim()}>{sendingGuess ? 'Proveravam…' : 'Pogodi'}</button></form>}
      {guessMessage && <p role="status">{guessMessage}</p>}
    </section>;
  }

  return <main className="quiz-flow">
    <Link href="/">← Početna</Link>
    {phase === 'loading' && <section className="panel"><h1>Pripremamo današnji kviz…</h1></section>}
    {phase === 'briefing' && challenge && <section className="panel quiz-intro" aria-live="polite">
      <p className="eyebrow">SLEDEĆE · {challenge.position}. PITANJE · {challenge.category}</p><h1>{gameModeLabel(challenge.mode)}</h1><p>{challenge.title}</p>
      {joker.position === challenge.position ? <p className="joker-active">Džoker je aktiviran za ovo pitanje · osvojićeš dve iste novčanice.</p> : joker.used || joker.position ? <p>Džoker je već potrošen za današnji kviz.</p> : <button className="button secondary" onClick={() => void activateJoker()} disabled={savingJoker}>{savingJoker ? 'Aktiviram…' : 'Aktiviraj džoker za ovo pitanje · 2× iste novčanice'}</button>}{jokerMessage&&<p role="alert">{jokerMessage}</p>}
      <button className="button" onClick={() => void beginChallenge(challenge)}>Započni {challenge.position}. pitanje →</button>
      {puzzlePanel()}
    </section>}
    {phase === 'starting' && <section className="panel"><p className="eyebrow">{challenge && gameModeLabel(challenge.mode)}</p><h1>Spremi se…</h1></section>}
    {phase === 'halftime' && <section className="panel halftime-card">
      <p className="eyebrow">{playDate} · PAUZA</p><h1>Rezultati prvog poluvremena</h1><div className="halftime-results">{resultRows(halfResults)}</div>
      <div className="halftime-total"><span>Ukupno osvojeno</span><strong>{money.format(halfTotal)} RSD</strong></div><p>Drugo poluvreme počinje pitanjem broj 5.</p>
      {nextChallenge && <div className="next-question"><p className="eyebrow">SLEDEĆE · {nextChallenge.position}. PITANJE · {nextChallenge.category}</p><h2>{gameModeLabel(nextChallenge.mode)}</h2><p>{nextChallenge.title}</p>{joker.position === nextChallenge.position ? <p className="joker-active">Džoker je aktiviran za ovo pitanje · nagrada se isplaćuje u dve iste novčanice.</p> : joker.used || joker.position ? <p>Džoker je već potrošen za današnji kviz.</p> : <button className="button secondary" onClick={() => void activateJoker()} disabled={savingJoker}>{savingJoker ? 'Aktiviram…' : 'Aktiviraj džoker za ovo pitanje · 2×'}</button>}{jokerMessage&&<p role="alert">{jokerMessage}</p>}<button className="button" onClick={() => void beginChallenge(nextChallenge)}>Nastavi na pitanje 5 →</button></div>}
      {puzzlePanel()}
    </section>}
    {phase === 'error' && <section className="panel"><h1>Kviz nije mogao da se pokrene</h1><p role="alert">{error}</p><button className="button" onClick={() => window.location.reload()}>Pokušaj ponovo</button></section>}
    {phase === 'unavailable' && <section className="panel"><h1> Današnji kviz još nije dostupan</h1><p>Novi dnevni set još nije objavljen.</p></section>}
    {phase === 'complete' && <section className="panel halftime-card">
      <p className="eyebrow">{playDate} · KONAČNI REZULTAT</p><h1>Rezultati današnjeg kviza</h1><div className="halftime-results"><h2>Prvo poluvreme</h2>{resultRows(firstHalfResults)}<div className="halftime-total"><span>Zbir prvog poluvremena</span><strong>{money.format(firstHalfTotal)} RSD</strong></div></div>
      <div className="halftime-results"><h2>Drugo poluvreme</h2>{resultRows(secondHalfResults)}<div className="halftime-total"><span>Zbir drugog poluvremena</span><strong>{money.format(secondHalfTotal)} RSD</strong></div></div><div className="halftime-total final-total"><span>Ukupno osvojeno u kvizu</span><strong>{money.format(finalTotal)} RSD</strong></div>
      <p>Odgovorio/la si na svih 8 pitanja. Novi kviz stiže sutra.</p>{puzzlePanel()}<div className="halftime-total final-total"><span>Ukupno osvojeno danas{puzzleTotal ? ` · uključuje ${money.format(puzzleTotal)} RSD za sliku` : ''}</span><strong>{money.format(finalTotal + puzzleTotal)} RSD</strong></div><Link className="button" href="/">Povratak na početnu</Link>
    </section>}
    <p className="muted">Gostujući napredak čuva se u ovom pregledaču do sutra. Nakon prijave ili registracije možeš ga preneti na nalog.</p>
  </main>;
}
