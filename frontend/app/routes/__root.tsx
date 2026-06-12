import {
  createRootRoute,
  Outlet,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "../src/context/AuthContext";
import { Toaster } from "sonner";
import "../src/styles/globals.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>采样任务批量复核系统</title>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <Outlet />
          <Toaster position="top-right" />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
