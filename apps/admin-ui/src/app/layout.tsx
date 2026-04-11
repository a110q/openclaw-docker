import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenClaw Platform',
  description: 'OpenClaw 平台控制面与运维控制台',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
