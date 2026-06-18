import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './globals.css';

export const metadata: Metadata = {
  title: '病历整改单管理系统',
  description: '病历质控整改全流程管理',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider locale={zhCN} theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}>
          {children}
        </ConfigProvider>
      </body>
    </html>
  );
}
