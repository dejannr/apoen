'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Leaderboard = {
  season: { year: number; month: number } | null;
  rows: { nickname: string; total_amount: number; rank: number; isMe: boolean }[];
  me: { nickname: string; totalAmount: number; rank: number } | null;
  gap: number | null;
  asOf: string;
  totalRows: number;
  page: number;
  pageSize: number;
};
const money = new Intl.NumberFormat('sr-Latn-RS');

export default function Leaderboard() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch(`/api/leaderboard?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Rang-lista trenutno nije dostupna.');
      return response.json() as Promise<Leaderboard>;
    }).then((result) => { if (active) setData(result); }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [page]);

  return <main>
    <Link href="/dashboard">← Početna</Link>
    <h1>Rang-lista</h1>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>Učitavanje rang-liste…</p>}
    {data && <>
      <p>{data.season ? `${data.season.month}/${data.season.year}` : 'Sezona još nije objavljena'}</p>
      {data.me && <section className="panel" aria-label="Tvoj plasman">
        <strong>Tvoj plasman: #{data.me.rank}</strong>
        <p>{money.format(data.me.totalAmount)} RSD</p>
        <p>{data.gap == null ? 'Trenutno si na vrhu rang-liste.' : `Do sledećeg višeg zbira: ${money.format(data.gap)} RSD`}</p>
      </section>}
      <section className="panel">
        {data.rows.length === 0 ? <p>Nema rezultata za ovu sezonu.</p> : data.rows.map((row) => <div className="rankrow" key={row.nickname} aria-current={row.isMe ? 'true' : undefined}>
          <strong>#{row.rank}</strong><span>{row.nickname}{row.isMe ? ' (ti)' : ''}</span><b>{money.format(row.total_amount)} RSD</b>
        </div>)}
      </section>
      <nav className="controls" aria-label="Stranice rang-liste">
        <button className="button secondary" disabled={data.page <= 1} onClick={() => setPage((current) => current - 1)}>Prethodna</button>
        <span>Stranica {data.page} · {data.totalRows} igrača</span>
        <button className="button secondary" disabled={data.page * data.pageSize >= data.totalRows} onClick={() => setPage((current) => current + 1)}>Sledeća</button>
      </nav>
      <small>Stanje na {new Date(data.asOf).toLocaleString('sr-Latn-RS')}</small>
    </>}
  </main>;
}
