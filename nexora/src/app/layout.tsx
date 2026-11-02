import type { Metadata } from 'next';
import './globals.css';
import { brand } from '@/lib/types';
export const metadata: Metadata = {
  title: `${brand.name} — Connected work`,
  description: 'See your work. Understand the connections. Control what happens next.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
