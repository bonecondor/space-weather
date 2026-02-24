import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Solar Sense',
  description: 'Log a space weather prediction',
  appleWebApp: {
    capable: true,
    title: 'Solar Sense',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
};

export default function PredictLayout({ children }: { children: React.ReactNode }) {
  return children;
}
