'use client';

import React from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import './globals.css';
import AppLayout from '@/components/Layout';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#1677ff',
            },
          }}
        >
          <AntdApp>
            <AppLayout>{children}</AppLayout>
          </AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}
