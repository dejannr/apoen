'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';

type Asset = { id: string; sha256: string; mimeType: string; byteSize: number; widthPx: number; heightPx: number; createdAt: string; _count: { tiers: number } };

export default function AdminAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [message, setMessage] = useState('');
  async function refresh() {
    const response = await fetch('/api/admin/assets', { cache: 'no-store' });
    const data = await response.json();
    setAssets(Array.isArray(data) ? data : []);
  }
  useEffect(() => { let active = true; void fetch('/api/admin/assets', { cache: 'no-store' }).then((response) => response.json()).then((data) => { if (active) setAssets(Array.isArray(data) ? data : []); }); return () => { active = false; }; }, []);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch('/api/admin/assets', { method: 'POST', body: new FormData(form) });
    const data = await response.json();
    setMessage(response.ok ? `Asset sačuvan: ${data.id}` : data.error ?? 'Slika nije sačuvana.');
    if (response.ok) { form.reset(); await refresh(); }
  }
  return <main>
    <Link href="/admin">← Administracija</Link>
    <h1>Slike kolekcije</h1>
    <p>Slike se normalizuju i čuvaju u PostgreSQL-u. Nema javnog pristupa draft assetima.</p>
    <form className="panel" onSubmit={upload}>
      <h2>Dodaj sliku</h2>
      <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
      <button className="button">Otpremi</button>
      {message && <p role="status">{message}</p>}
    </form>
    <section className="panel"><h2>Asseti u bazi</h2>
      {assets.length === 0 ? <p>Nema dodatih slika.</p> : assets.map((asset) => <article className="challenge" key={asset.id}>
        <Image unoptimized src={`/api/admin/assets/${asset.id}`} alt="Draft ili kolekcionarska slika" width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
        <code>{asset.id}</code>
        <p>{asset.mimeType} · {asset.widthPx}×{asset.heightPx} · {Math.ceil(asset.byteSize / 1024)} KB</p>
        <p>SHA-256: <code>{asset.sha256}</code></p>
        <p>{asset._count.tiers} tier-ova koristi ovu sliku · {new Date(asset.createdAt).toLocaleString('sr-Latn-RS')}</p>
      </article>)}
    </section>
  </main>;
}
