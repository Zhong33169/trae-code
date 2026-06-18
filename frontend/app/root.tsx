import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { AlertTriangle, Droplets, LayoutGrid } from "lucide-react";
import stylesheet from "~/tailwind.css?url";
import { fetchUsers } from "~/lib/api";
import type { User } from "~/lib/types";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
  },
];

export const meta: MetaFunction = () => [
  { title: "水务营业厅 · 抢修工单到期预警处置平台" },
  { name: "description", content: "抢修工单三段式流转与到期预警处置控制台" },
  { name: "viewport", content: "width=device-width, initial-scale=1" },
];

export async function loader(_args: LoaderFunctionArgs) {
  try {
    const users = await fetchUsers();
    return { users };
  } catch {
    return { users: [] as User[] };
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
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
  const { users } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-deep-700 text-white border-b-2 border-deep-800 shadow-md">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Droplets className="w-6 h-6 text-aqua-light" />
            <span className="font-display text-xl font-extrabold tracking-wide">
              水务营业厅
            </span>
            <span className="text-deep-200 text-xs font-mono ml-1 hidden sm:inline">
              WORKORDER · CONSOLE
            </span>
          </div>
          <nav className="flex items-center gap-1 ml-4">
            <NavItem to="/" icon={<LayoutGrid className="w-4 h-4" />} label="工单列表" />
            <NavItem
              to="/warnings"
              icon={<AlertTriangle className="w-4 h-4" />}
              label="到期预警"
            />
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs">
            {users.map((u) => (
              <span key={u.id} className="bg-deep-600 px-2 py-0.5 rounded font-mono">
                {u.name} · {u.role}
              </span>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-5">
        <Outlet context={{ users }} />
      </main>
      <footer className="border-t border-deep-100 bg-white py-3 px-6 text-center text-xs text-ink-muted font-mono">
        水务营业厅抢修工单到期预警处置平台 · 本地演示环境 · 后端 8004 / 前端 3004
      </footer>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          isActive
            ? "bg-deep-500 text-white"
            : "text-deep-100 hover:bg-deep-600 hover:text-white"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
