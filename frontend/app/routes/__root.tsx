import { createRootRoute, Outlet, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import "../styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <Outlet />
      </RootDocument>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>培训项目单管理系统</title>
      </head>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <header
            style={{
              background: "#111827",
              color: "white",
              padding: "1rem 1.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ maxWidth: 1400, margin: "0 auto" }}>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                培训项目单管理系统
              </h1>
              <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>
                企业培训公司 · 培训项目单 · 异常申诉复核
              </p>
            </div>
          </header>
          <main style={{ flex: 1 }}>{children}</main>
          <footer
            style={{
              padding: "1rem 1.5rem",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "0.875rem",
              borderTop: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            培训项目单管理系统 © 2026
          </footer>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
