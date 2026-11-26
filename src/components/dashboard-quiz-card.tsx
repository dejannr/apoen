'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { currentGuestToken, guestHeaders } from '@/client/guest-session';

type Challenge = { position: number; status: string };
type Today = { state: string; halves: { challenges: Challenge[] }[] };
type Progress = { heading: string; description: string; button: string };

function describeProgress(data: Today): Progress {
  const challenges = data.halves.flatMap((half) => half.challenges).sort((a, b) => a.position - b.position);
  const active = challenges.find((challenge) => challenge.status === 'ACTIVE');
  const completed = challenges.filter((challenge) => challenge.status !== 'ACTIVE' && challenge.status !== 'NOT_STARTED').length;
  const next = challenges.find((challenge) => challenge.status === 'NOT_STARTED');

  if (data.state === 'COMPLETED' || (!next && !active && completed === 8)) {
    return { heading: 'Današnji kviz je završen · 8/8', description: 'Odgovorio/la si na sva današnja pitanja.', button: 'Pogledaj završetak kviza →' };
  }
  if (active) {
    return { heading: `Kviz je u toku · pitanje ${active.position} od 8`, description: `Završeno ${completed} od 8 pitanja. Nastavi tamo gde si stao/la.`, button: 'Nastavi kviz →' };
  }
  if (completed > 0 && next) {
    return { heading: `Nastavljaš od pitanja ${next.position} od 8`, description: `Završeno ${completed} od 8 pitanja.`, button: 'Nastavi kviz →' };
  }
  return { heading: 'Današnji kviz je spreman', description: 'Odigraj osam izazova u dva poluvremena.', button: 'Pokreni današnji kviz →' };
}

export default function DashboardQuizCard({ available, authenticated }: { available: boolean; authenticated: boolean }) {
  const [progress, setProgress] = useState<Progress>();

  useEffect(() => {
    if (!available || (!authenticated && !currentGuestToken())) return;
    let current = true;
    void fetch('/api/game/today', { headers: guestHeaders(), cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as Today;
      })
      .then((data) => { if (current && data) setProgress(describeProgress(data)); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [available, authenticated]);

  return <section className="panel dashboard-quiz-card">
    <h2>{available ? progress?.heading ?? 'Današnji kviz je spreman' : 'Današnji kviz još nije dostupan'}</h2>
    <p>{available ? progress?.description ?? 'Odigraj osam izazova u dva poluvremena. Tvoj gostujući napredak čuva se do sutra i možeš ga preneti na nalog.' : 'Novi dnevni set još nije objavljen.'}</p>
    {available && <Link className="button" href="/kviz">{progress?.button ?? 'Pokreni današnji kviz →'}</Link>}
  </section>;
}
