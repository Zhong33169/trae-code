import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '维修服务平台 - 跨班组交接确认维修报价单系统',
  description: '维修报价单登记、跨班组交接、状态流转统一管理平台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
