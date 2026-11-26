'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import RewardReveal from '@/components/reward-reveal';
import { guestHeaders } from '@/client/guest-session';
import { attemptReasonLabel, gameModeLabel } from '@/domain/game-copy';

type Snapshot = {
  attemptId: string;
  status: string;
  revision: number;
  expiresAt: string;
  serverNow: string;
  mode: string;
  title: string;
  prompt: string;
  publicConfig: Record<string, unknown>;
  options: { id: string; label: string; sortOrder: number }[];
  acceptedOptionIds: string[];
  step: number;
  potentialReward: number;
  canCashOut: boolean;
  rewardLadder: { label: string; reward: number }[];
  result?: { reward: number; reason: string; finishedAt: string | null } | null;
};

export default function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const [id, setId] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [picked, setPicked] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const deadline = useRef(0);
  const timeoutRequested = useRef(false);

  useEffect(() => {
    let active = true;
    void params.then(({ attemptId }) => {
      if (!active) return;
      setId(attemptId);
      return fetch(`/api/attempts/${attemptId}`, { headers: guestHeaders(), cache: 'no-store' }).then((response) => response.json()).then((data) => {
        if (active) setSnapshot(data);
      });
    });
    return () => { active = false; };
  }, [params]);

  const attemptId = snapshot?.attemptId;
  const expiresAt = snapshot?.expiresAt;
  const serverNow = snapshot?.serverNow;
  const attemptStatus = snapshot?.status;
  useEffect(() => {
    if (!attemptId || !expiresAt || !serverNow || !attemptStatus) return;
    const remainingAtSync = Date.parse(expiresAt) - Date.parse(serverNow);
    deadline.current = performance.now() + Math.max(0, remainingAtSync);
    timeoutRequested.current = false;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - performance.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0 && attemptStatus === 'ACTIVE' && id && !timeoutRequested.current) {
        timeoutRequested.current = true;
        void fetch(`/api/attempts/${id}`, { headers: guestHeaders(), cache: 'no-store' })
          .then((response) => response.json())
          .then((data) => setSnapshot(data))
          .catch(() => setMessage('Veza je prekinuta. Pokušaj osvežavanje; serverski tajmer se nastavlja.'));
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [attemptId, expiresAt, serverNow, attemptStatus, id]);

  async function act(kind: string, payload: Record<string, unknown> = {}) {
    if (!snapshot || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/attempts/${id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...guestHeaders() },
        body: JSON.stringify({ requestId: crypto.randomUUID(), expectedRevision: snapshot.revision, kind, payload }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? 'Greška');
        if (response.status === 409) {
          const fresh = await fetch(`/api/attempts/${id}`, { headers: guestHeaders(), cache: 'no-store' }).then((result) => result.json());
          setSnapshot(fresh);
        }
        return;
      }
      if (data.status === 'ACTIVE') {
        const fresh = await fetch(`/api/attempts/${id}`, { headers: guestHeaders(), cache: 'no-store' }).then((result) => result.json());
        setSnapshot(fresh);
        setPicked([]);
      } else {
        setSnapshot({ ...snapshot, ...data, options: snapshot.options });
      }
      setMessage('');
    } catch {
      setMessage('Veza je prekinuta. Tajmer se nastavlja; proveri stanje pre ponovnog slanja.');
    } finally {
      setBusy(false);
    }
  }

  if (!snapshot) return <main>Učitavanje izazova…</main>;
  if (snapshot.status !== 'ACTIVE') return <main>
    <section className="panel result-card">
      <p className="eyebrow">REZULTAT</p>
      <h1>{new Intl.NumberFormat('sr-Latn-RS').format(snapshot.result?.reward ?? 0)} RSD</h1>
      <RewardReveal amount={snapshot.result?.reward ?? 0} />
      <p>{attemptReasonLabel(snapshot.result?.reason)}</p>
      <Link className="button" href="/kviz">Nastavi na sledeće pitanje →</Link>
    </section>
  </main>;

  const mode = snapshot.mode;
  const config = snapshot.publicConfig;
  const displayedOptions = snapshot.options.filter((option) => mode !== 'ORDER' || !snapshot.acceptedOptionIds.includes(option.id));
  return <main>
    <div className="gamehead"><span>{snapshot.title}</span><strong className={seconds < 10 ? 'urgent' : ''}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></div>
    <section className="panel">
      <p className="eyebrow">{gameModeLabel(mode)}</p>
      <h1 className="gameprompt">{snapshot.prompt}</h1>
      <details className="reward-ladder"><summary>Pregled nagrada</summary><ul>{snapshot.rewardLadder.map((step, index) => <li key={`${step.label}-${index}`}><span>{step.label}</span><strong>{new Intl.NumberFormat('sr-Latn-RS').format(step.reward)} RSD</strong></li>)}</ul></details>
      {mode === 'EDGE' && <p>Cilj: {String(config.target)} {String(config.unit ?? '')}</p>}
      <div className="options">{displayedOptions.map((option) => {
        const chosen = picked.includes(option.id) || snapshot.acceptedOptionIds.includes(option.id);
        return <button disabled={busy} className={chosen ? 'option chosen' : 'option'} key={option.id} onClick={() => {
          if (mode === 'ORDER') void act('PICK_NEXT', { optionId: option.id });
          else if (mode !== 'HIGH_LOW') setPicked(chosen ? picked.filter((id) => id !== option.id) : [...picked, option.id]);
        }}>{option.label}</button>;
      })}</div>
      {mode === 'HIGH_LOW' && <div className="controls"><button disabled={busy} onClick={() => void act('COMPARE', { choice: 'GREATER', step: snapshot.step })}>Veće</button><button disabled={busy} onClick={() => void act('COMPARE', { choice: 'LESS', step: snapshot.step })}>Manje</button></div>}
      {mode === 'EDGE' && <p>Izabrano {picked.length} / {String(config.pickCount)}</p>}
      {(mode === 'EDGE' || mode === 'CONFIDENCE') && <button className="button" disabled={busy || picked.length === 0} onClick={() => void act('SUBMIT_SELECTION', { optionIds: picked })}>Potvrdi odgovor</button>}
      {(mode === 'ORDER' || mode === 'HIGH_LOW') && <div className="controls"><span>{snapshot.step} tačnih · potencijalno {new Intl.NumberFormat('sr-Latn-RS').format(snapshot.potentialReward)} RSD</span><button disabled={busy || !snapshot.canCashOut} onClick={() => void act('CASH_OUT')}>Uzmi novac</button></div>}
      <button className="quiet" disabled={busy} onClick={() => void act('ABANDON')}>Odustani</button>
      {message && <p role="alert">{message}</p>}
    </section>
  </main>;
}
