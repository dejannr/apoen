import type { Metadata } from 'next';
import './globals.css';
import ServiceWorker from '@/components/service-worker';
export const metadata: Metadata = { title: 'apoen', description: 'Dnevna kviz igra', icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="sr-Latn" suppressHydrationWarning><body><ServiceWorker />{children}</body></html>; }
