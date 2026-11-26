'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Job = { id: string; jobType: string; status: string; startedAt: string; finishedAt: string | null; details: unknown };
const jobs = [
  { type: 'EXPIRE', label: 'Obradi istekle pokušaje', done: 'Istekli pokušaji su obrađeni.' },
  { type: 'CLOSE_SEASON', label: 'Zatvori dospele sezone', done: 'Dospele sezone su zatvorene.' },
  { type: 'RECONCILE', label: 'Proveri ledger i banke', done: 'Ledger se slaže sa novčanicama i pokušajima.' },
];

export default function Jobs() {
  const [rows, setRows] = useState<Job[]>([]);
  const [message, setMessage] = useState('');
  async function refresh() {
    const response = await fetch('/api/admin/jobs', { cache: 'no-store' });
    const data = await response.json();
    setRows(Array.isArray(data) ? data : []);
  }
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/jobs', { cache: 'no-store' }).then((response) => response.json()).then((data) => {
      if (active) setRows(Array.isArray(data) ? data : []);
    });
    return () => { active = false; };
  }, []);
  async function run(job: typeof jobs[number]) {
    const response = await fetch(`/api/admin/jobs/${job.type}/run`, { method: 'POST' });
    setMessage(response.ok ? job.done : 'Posao nije uspeo; pogledaj detalje izvršavanja.');
    await refresh();
  }
  return <main>
    <Link href="/admin">← Administracija</Link>
    <h1>Lokalni poslovi</h1>
    <section className="panel">
      {jobs.map((job) => <button className="button" key={job.type} onClick={() => void run(job)}>{job.label}</button>)}
      {message && <p role="status">{message}</p>}
      {rows.map((job) => <details key={job.id}>
        <summary>{job.jobType} · {job.status} · {new Date(job.startedAt).toLocaleString('sr-Latn-RS')}</summary>
        <pre>{JSON.stringify(job.details, null, 2)}</pre>
      </details>)}
    </section>
  </main>;
}
