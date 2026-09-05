import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Trashketball — Out of Office',
  description: 'A very important waste of time. Toss paper in a Severance-inspired office, then escape to a sunlit beach house. Two levels. Physics-based throws. Ten points a basket.',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
