import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Space, Tag, message, Select } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  LogoutOutlined,
  UserOutlined,
  SwitcherOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { User, RoleLabelMap, Role } from '../types';
import { userApi } from '../api';
import DashboardPage from '../pages/DashboardPage';
import HarvestListPage from '../pages/HarvestListPage';
import HarvestDetailPage from '../pages/HarvestDetailPage';
import HarvestCreatePage from '../pages/HarvestCreatePage';
import ScanPage from '../pages/ScanPage';

const { Header, Sider, Content } = Layout;

const MainLayout: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userInfo = localStorage.getItem('userInfo');
    if (userInfo) {
      setCurrentUser(JSON.parse(userInfo));
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const users = (await userApi.findAll()) as User[];
      setAllUsers(users);
    } catch (e) {
      console.error('加载用户列表失败', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('userInfo');
    message.success('已退出登录');
    navigate('/login');
  };

  const handleSwitchUser = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userInfo', JSON.stringify(user));
      setCurrentUser(user);
      message.success(`已切换到 ${user.name}（${RoleLabelMap[user.role]}）`);
      window.location.reload();
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
    {
      key: '/harvest/create',
      icon: <PlusOutlined />,
      label: '新增采收记录',
    },
    {
      key: '/scan',
      icon: <SwitcherOutlined />,
      label: '扫码核验',
    },
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (!currentUser) return null;

  return (
    <Layout className="app-container">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: collapsed ? 12 : 16 }}>
          采收管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
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
              {RoleLabelMap[currentUser.role]}
            </Tag>
          </div>
          <Space>
            <div className="user-selector">
              <span style={{ marginRight: 8, color: '#666' }}>切换角色：</span>
              <Select
                style={{ width: 200 }}
                value={currentUser.id}
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
                <span>{currentUser.name}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/harvest" element={<HarvestListPage />} />
            <Route path="/harvest/create" element={<HarvestCreatePage />} />
            <Route path="/harvest/:id" element={<HarvestDetailPage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
