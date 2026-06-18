'use client';

import { useEffect, useState, ReactNode } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, message, Spin } from 'antd';
import {
  FileTextOutlined,
  BarChartOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  LogoutOutlined,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store';

const { Header, Sider, Content } = Layout;

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, checkAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [checkAuth, router]);

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    router.push('/login');
  };

  const userMenuItems = [
    {
      key: '1',
      label: (
        <span>
          <UserOutlined /> {user?.name} ({user?.role_cn})
        </span>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: '2',
      label: (
        <span onClick={handleLogout}>
          <LogoutOutlined /> 退出登录
        </span>
      ),
    },
  ];

  const menuItems = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: <Link href="/">整改单列表</Link>,
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: <Link href="/statistics">数据统计</Link>,
    },
    {
      key: '/overdue',
      icon: <ExclamationCircleOutlined />,
      label: <Link href="/overdue">超时追踪</Link>,
    },
    {
      key: '/logs',
      icon: <HistoryOutlined />,
      label: <Link href="/logs">操作日志</Link>,
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #e8e8e8',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            <FileTextOutlined style={{ color: '#1677ff' }} /> 病历整改单管理系统
          </h2>
          {user.role === 'DEPARTMENT_SECRETARY' && (
            <Link href="/create">
              <Button type="primary" icon={<PlusOutlined />}>
                新建整改单
              </Button>
            </Link>
          )}
        </div>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar icon={<UserOutlined />} />
            <span>{user.name}</span>
            <span style={{ color: '#888' }}>({user.role_cn})</span>
          </div>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #e8e8e8' }}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            minHeight: 'calc(100vh - 112px)',
          }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
