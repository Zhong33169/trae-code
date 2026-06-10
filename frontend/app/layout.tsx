import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '图书馆-异常申诉复核借阅记录系统',
  description: '图书馆借阅记录异常申诉复核管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <Link href="/" className="text-xl font-bold text-gray-900">
                  📚 图书馆借阅记录复核系统
                </Link>
              </div>
              <div className="flex space-x-4">
                <Link
                  href="/records"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                >
                  借阅记录
                </Link>
                <Link
                  href="/records?status=pending_audit"
                  className="px-3 py-2 rounded-md text-sm font-medium text-yellow-700 hover:text-yellow-900 hover:bg-yellow-50"
                >
                  待审核
                </Link>
                <Link
                  href="/records?status=pending_review"
                  className="px-3 py-2 rounded-md text-sm font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-50"
                >
                  待复核
                </Link>
                <Link
                  href="/records?status=returned_correction"
                  className="px-3 py-2 rounded-md text-sm font-medium text-red-700 hover:text-red-900 hover:bg-red-50"
                >
                  退回补正
                </Link>
                <Link
                  href="/records?status=archived"
                  className="px-3 py-2 rounded-md text-sm font-medium text-green-700 hover:text-green-900 hover:bg-green-50"
                >
                  已归档
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
