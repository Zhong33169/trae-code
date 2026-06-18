import { createContext, useContext, createSignal, onMount } from "solid-js";
import type { Accessor, JSX } from "solid-js";

export interface User {
  id: string;
  username: string;
  name: string;
  role: "registrar" | "auditor" | "reviewer";
  created_at: string;
}

interface AuthContextType {
  user: Accessor<User | null>;
  token: Accessor<string | null>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: Accessor<boolean>;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
  const [user, setUser] = createSignal<User | null>(null);
  const [token, setToken] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  onMount(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user:", e);
      }
    }
    setIsLoading(false);
  });

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "登录失败");
    }

    const userData = data.data.user;
    const tokenData = data.data.token;

    setToken(tokenData);
    setUser(userData);
    localStorage.setItem("token", tokenData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export const roleNames: Record<string, string> = {
  registrar: "资料年检登记员",
  auditor: "资料年检审核主管",
  reviewer: "银行网点复核负责人",
};
