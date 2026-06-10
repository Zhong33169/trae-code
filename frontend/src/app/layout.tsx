import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "住客订单补录校验系统",
  description: "酒店集团移动补录校验住客订单系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" style={{ fontFamily: "'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Noto Sans SC', 'WenQuanYi Micro Hei', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
