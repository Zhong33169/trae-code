import { Layout, Menu, Button, Avatar, Dropdown, Badge } from "antd";
import { Outlet, Link, Form, useLoaderData } from "@remix-run/react";
import {
  FileTextOutlined,
  PlusOutlined,
  DashboardOutlined,
  HistoryOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { useState } from "react";

const { Header, Sider, Content } = Layout;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  let user: any = null;
  let statistics: any = { myPending: 0, todoCounts: {} };

  try {
    const data = useLoaderData<any>();
    user = data?.user || null;
    statistics = data?.statistics || statistics;
  } catch (e) {}

  const [collapsed, setCollapsed] = useState(false);

  if (!user) {
    return <>{children}</>;
  }

  const todoCount = statistics?.myPending || 0;
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const activeKey = currentPath === '/' ? 'dashboard' :
                    currentPath.startsWith('/records/new') ? 'create' :
                    currentPath.startsWith('/records') ? 'records' :
                    currentPath.startsWith('/logs') ? 'logs' : 'dashboard';

  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/">工作台</Link>,
    },
    {
      key: "records",
      icon: <FileTextOutlined />,
      label: <Link to="/records">旁站记录单</Link>,
    },
    {
      key: "create",
      icon: <PlusOutlined />,
      label: <Link to="/records/new">新建记录</Link>,
    },
    {
      key: "logs",
      icon: <HistoryOutlined />,
      label: <Link to="/logs">操作日志</Link>,
    },
  ];

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: `${user.name} (${user.roleName})`,
      disabled: true,
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: (
        <Form method="post" action="/records">
          <input type="hidden" name="intent" value="logout" />
          <button
            type="submit"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%', textAlign: 'left' }}
          >
            退出登录
          </button>
        </Form>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#001529",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1
            style={{
              color: "white",
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            工程监理旁站记录系统
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Badge count={todoCount} size="small">
            <Button
              type="text"
              icon={<BellOutlined style={{ color: "white", fontSize: 18 }} />}
            />
          </Badge>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <Avatar icon={<UserOutlined />} style={{ background: "#1890ff" }} />
              <span style={{ color: "white" }}>{user.name}</span>
            </div>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="light"
          width={220}
        >
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            style={{ height: "100%", borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: "24px", background: "#f0f2f5" }}>
          <Content
            style={{
              background: "white",
              padding: 24,
              borderRadius: 8,
              minHeight: "calc(100vh - 112px)",
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
