import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RegForge — private requirement workspaces',
  description:
    'RegForge gives each Google-signed-in user a private workspace for shareable, autosaved requirement questionnaires.',
  // Phone-friendly: installs to the home screen with the app shell colour.
  appleWebApp: {
    capable: true,
    title: 'RegForge',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#07080f',
  width: 'device-width',
  initialScale: 1,
  // Never lock pinch-zoom (accessibility); just stop iOS from auto-zooming
  // focused inputs by keeping every control at 16px on phones.
  maximumScale: 5,
  // Lets the layout reach under the notch and home indicator.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
