'use client';

import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, logout, isAuthenticated } from '@/lib/auth';
import { UserRole, ROLE_LABELS } from '@/types';

const { Header, Sider, Content } = Layout;

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ real_name: string; role: string; role_name?: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const userData = getUser();
    if (userData) {
      setUser({ real_name: userData.real_name, role: userData.role, role_name: userData.role_name });
    }
  }, [router]);

  const getMenuItems = () => {
    const items = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '首页',
      },
      {
        key: '/tasks',
        icon: <UnorderedListOutlined />,
        label: '打样任务',
      },
      {
        key: '/statistics',
        icon: <BarChartOutlined />,
        label: '统计报表',
      },
    ];

    return items;
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  const handleLogout = () => {
    logout();
  };

  const userMenuItems = [
    {
      key: 'role',
      label: (
        <span className="text-gray-500">
          角色：{user ? ROLE_LABELS[user.role as UserRole] || user.role : ''}
        </span>
      ),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <Layout className="min-h-screen">
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div className="h-16 flex items-center justify-center text-white text-lg font-bold bg-blue-600">
          {collapsed ? '打样' : '服装打样系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={getMenuItems()}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header className="bg-white px-4 flex items-center justify-between shadow-sm">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-lg"
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-3 py-1 rounded">
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.real_name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="m-6 bg-white rounded-lg shadow-sm p-6">{children}</Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
