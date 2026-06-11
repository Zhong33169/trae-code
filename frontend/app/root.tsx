import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { ConfigProvider, App as AntApp } from "antd";
import zhCN from "antd/locale/zh_CN";
import "antd/dist/reset.css";
import { getAuthToken, getCurrentUser } from "~/utils/auth.server";
import AppLayout from "~/components/AppLayout";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = getAuthToken(request);
  const user = token ? await getCurrentUser(token) : null;
  return json({ user });
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntApp>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AntApp>
    </ConfigProvider>
  );
}
