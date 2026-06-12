import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'B2B批发平台 - 商家入驻单系统',
  description: '离线台账回填商家入驻单系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
