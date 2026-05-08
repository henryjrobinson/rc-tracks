import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RC Tracks — Worldwide directory of RC racing venues',
  description: 'Searchable directory of RC racing tracks worldwide, sourced from LiveRC.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
