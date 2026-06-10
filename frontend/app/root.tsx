import React from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "@remix-run/react";
import { Layout } from "./components/Layout";
import { ToastContainer } from "./components/ToastContainer";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const { toasts, removeToast } = useToast();
  const { loading } = useAuth();

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>充电桩巡检系统</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
              Arial, "Noto Sans", sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #374151;
            background-color: #f3f4f6;
          }

          a {
            color: inherit;
            text-decoration: none;
          }

          button {
            font-family: inherit;
          }

          input, textarea, select {
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }

          input:focus, textarea:focus, select:focus {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translate(-50%, -45%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(100%);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }

          ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
          }
        `}</style>
      </head>
      <body>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              backgroundColor: "#f3f4f6",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#3b82f6",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div style={{ fontSize: "14px", color: "#6b7280" }}>加载中...</div>
            </div>
          </div>
        ) : isLoginPage ? (
          children
        ) : (
          <Layout>{children}</Layout>
        )}
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
