'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { gameModeLabel } from '@/domain/game-copy';

type Stats = {
  users: number;
  activeAttempts: number;
  totalAttempts: number;
  publishedSets: number;
  draftSets: number;
  byMode: { mode: string; attempts: number; completed: number; timeouts: number; average_reward: number | null }[];
  denominations: { denomination: number; count: number }[];
};

const money = new Intl.NumberFormat('sr-Latn-RS');

export default function AdminStatistics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/stats', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Statistika trenutno nije dostupna.');
      return response.json() as Promise<Stats>;
    }).then((data) => { if (active) setStats(data); }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  return <main>
    <Link href="/admin">← Administracija</Link>
    <h1>Statistika</h1>
    {error && <p role="alert">{error}</p>}
    {!stats && !error && <p>Učitavanje statistike…</p>}
    {stats && <>
      <div className="cards">
        <article><strong>{stats.users}</strong><p>Nalozi</p></article>
        <article><strong>{stats.totalAttempts}</strong><p>Pokušaji ukupno</p></article>
        <article><strong>{stats.activeAttempts}</strong><p>Aktivni pokušaji</p></article>
        <article><strong>{stats.publishedSets} / {stats.draftSets}</strong><p>Objavljeni / nacrti</p></article>
      </div>
      <section className="panel"><h2>Rezultati po formatu</h2>
        {stats.byMode.length === 0 ? <p>Još nema pokušaja.</p> : <div className="table-wrap"><table><thead><tr><th>Format</th><th>Pokušaji</th><th>Završeni</th><th>Istekli</th><th>Prosečna nagrada</th></tr></thead>
          <tbody>{stats.byMode.map((row) => <tr key={row.mode}><td>{gameModeLabel(row.mode)}</td><td>{row.attempts}</td><td>{row.completed}</td><td>{row.timeouts}</td><td>{money.format(Math.round(row.average_reward ?? 0))} RSD</td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel"><h2>Raspodela novčanica</h2>
        {stats.denominations.length === 0 ? <p>Još nema osvojenih novčanica.</p> : <div className="table-wrap"><table><thead><tr><th>Apoen</th><th>Broj</th></tr></thead><tbody>{stats.denominations.map((row) => <tr key={row.denomination}><td>{money.format(row.denomination)} RSD</td><td>{row.count}</td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </main>;
}
