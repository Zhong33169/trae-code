import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '银行网点-风险分级处置开户申请系统',
  description: '银行网点开户申请风险分级处置系统',
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
