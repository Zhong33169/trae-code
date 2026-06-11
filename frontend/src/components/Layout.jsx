import React from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import {
  DashboardOutlined,
  FileTextOutlined,
  AuditOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { ROLE_LABELS } from '../utils/constants'

const { Header, Sider, Content } = Layout

export default function AppLayout({ user, setUser }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    navigate('/login')
  }

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/applications',
      icon: <FileTextOutlined />,
      label: '投保申请',
    },
  ]

  if (user?.role === 'supervisor' || user?.role === 'reviewer') {
    menuItems.push({
      key: '/audit',
      icon: <AuditOutlined />,
      label: '审计日志',
    })
  }

  const userMenu = {
    items: [
      {
        key: '1',
        label: (
          <span>
            <UserOutlined /> {user?.name}
          </span>
        ),
        disabled: true,
      },
      {
        key: '2',
        label: ROLE_LABELS[user?.role],
        disabled: true,
      },
      { type: 'divider' },
      {
        key: '3',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Layout>
      <Sider theme="dark" width={220}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
          borderBottom: '1px solid #333',
        }}>
          投保申请系统
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
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            保险代理公司-现场扫码核验投保申请系统
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span>{user?.name}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', padding: 24, background: '#fff', minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
