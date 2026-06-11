import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigate,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import stylesheet from "~/tailwind.css?url";
import { useState, useEffect } from "react";
import { User, setApiBaseUrl } from "~/api/client";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const cookieHeader = request.headers.get("Cookie");
  const token = cookieHeader
    ?.split(";")
    .find((c) => c.trim().startsWith("token="))
    ?.split("=")[1];

  const userStr = cookieHeader
    ?.split(";")
    .find((c) => c.trim().startsWith("user="))
    ?.split("=")[1];

  let user: User | null = null;
  if (userStr) {
    try {
      user = JSON.parse(decodeURIComponent(userStr));
    } catch {
      user = null;
    }
  }

  return json({
    user,
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:8008",
  });
}

export default function App() {
  const { user, apiBaseUrl } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(user);

  useEffect(() => {
    setApiBaseUrl(apiBaseUrl);
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    
    if (!token && location.pathname !== "/login") {
      navigate("/login");
    } else if (token && userStr && !currentUser) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, [apiBaseUrl, location.pathname, navigate, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setCurrentUser(null);
    navigate("/login");
  };

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen bg-gray-50">
        {currentUser && location.pathname !== "/login" && (
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">
                    广告代理公司-现场扫码核验创意需求单系统
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    欢迎，<span className="font-medium text-gray-900">{currentUser.name}</span>
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {currentUser.role === "registrar" && "创意需求登记员"}
                      {currentUser.role === "supervisor" && "创意需求审核主管"}
                      {currentUser.role === "reviewer" && "广告代理公司复核负责人"}
                    </span>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}
        <main className={currentUser ? "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" : ""}>
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
