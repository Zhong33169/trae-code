import { Outlet, useLoaderData, Form, redirect, ActionFunctionArgs, json, useMatches } from "@remix-run/react";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Layout, Menu, Button, Avatar, Dropdown, Badge } from "antd";
import {
  FileTextOutlined,
  PlusOutlined,
  DashboardOutlined,
  HistoryOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { Link } from "@remix-run/react";
import { useState } from "react";
import { requireAuth, logout, getSession, commitSession } from "~/utils/auth.server";
import { apiGet } from "~/utils/api.server";
import { Statistics } from "~/types";

const { Header, Sider, Content } = Layout;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { token, user } = await requireAuth(request);
  const statsResponse = await apiGet<Statistics>(token, "/api/records/statistics");
  return json({ user, statistics: statsResponse.data });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "logout") {
    return logout(request);
  }

  return null;
};

export default function LayoutComponent() {
  const { user, statistics } = useLoaderData<typeof loader>();
  const [collapsed, setCollapsed] = useState(false);

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
        <Form method="post">
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
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
