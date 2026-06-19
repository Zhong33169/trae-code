import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Space, Tag, Select, Button } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  LogoutOutlined,
  UserOutlined,
  SwitcherOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { RoleLabelMap, Role, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api';
import DashboardPage from '../pages/DashboardPage';
import HarvestListPage from '../pages/HarvestListPage';
import HarvestDetailPage from '../pages/HarvestDetailPage';
import HarvestCreatePage from '../pages/HarvestCreatePage';
import ScanPage from '../pages/ScanPage';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const { user, logout, switchUser, refreshUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadUsers();
    refreshUser();
  }, []);

  const loadUsers = async () => {
    try {
      const users = (await userApi.findAll()) as User[];
      setAllUsers(users);
    } catch (e) {
      console.error('加载用户列表失败', e);
    }
  };

  const handleSwitchUser = (userId: string) => {
    const targetUser = allUsers.find((u) => u.id === userId);
    if (targetUser) {
      switchUser(targetUser);
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/harvest',
      icon: <UnorderedListOutlined />,
      label: '采收记录',
    },
    ...(user?.role === Role.FIELD_ADMIN
      ? [
          {
            key: '/harvest/create',
            icon: <PlusOutlined />,
            label: '新增采收记录',
          },
        ]
      : []),
    ...(user?.role === Role.TECHNICIAN
      ? [
          {
            key: '/scan',
            icon: <SwitcherOutlined />,
            label: '扫码核验',
          },
        ]
      : []),
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  const selectedKey = location.pathname.startsWith('/harvest/create')
    ? '/harvest/create'
    : location.pathname.startsWith('/harvest/')
    ? '/harvest'
    : location.pathname;

  if (!user) return null;

  return (
    <Layout className="app-container">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: collapsed ? 12 : 16,
          }}
        >
          采收管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: 'white',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>采收记录管理系统</h3>
            <Tag color="blue" style={{ marginLeft: 16 }}>
              {RoleLabelMap[user.role]}
            </Tag>
          </div>
          <Space>
            <div className="user-selector">
              <span style={{ marginRight: 8, color: '#666' }}>切换角色：</span>
              <Select
                style={{ width: 200 }}
                value={user.id}
                onChange={handleSwitchUser}
                options={allUsers.map((u) => ({
                  value: u.id,
                  label: `${u.name}（${RoleLabelMap[u.role]}）`,
                }))}
              />
            </div>
            <Dropdown menu={{ items: userMenuItems }}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/harvest" element={<HarvestListPage />} />
            <Route path="/harvest/create" element={<HarvestCreatePage />} />
            <Route path="/harvest/edit/:id" element={<HarvestCreatePage />} />
            <Route path="/harvest/:id" element={<HarvestDetailPage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
