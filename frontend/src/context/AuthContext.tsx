import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { User, UserRole } from "../types";
import { ROLE_LABELS } from "../types";
import { authApi } from "../api/client";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_USERS: Record<
  UserRole,
  { username: string; password: string; name: string }
> = {
  registrar: { username: "registrar", password: "123456", name: "张三" },
  supervisor: { username: "supervisor", password: "123456", name: "李四" },
  reviewer: { username: "reviewer", password: "123456", name: "王五" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch {
      localStorage.removeItem("auth_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ username, password });
      localStorage.setItem("auth_token", response.token);
      setUser(response.user);
      toast.success(`登录成功，欢迎 ${response.user.name}`);
    } catch (error) {
      const err = error as Error;
      toast.error(`登录失败: ${err.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setUser(null);
  }, []);

  const switchRole = useCallback(async (role: UserRole) => {
    const credentials = ROLE_USERS[role];
    if (!credentials) return;

    setIsLoading(true);
    try {
      const response = await authApi.login(credentials);
      localStorage.setItem("auth_token", response.token);
      setUser(response.user);
      toast.success(`已切换为 ${ROLE_LABELS[role]}`);
    } catch {
      const mockUser: User = {
        id: role === "registrar" ? 1 : role === "supervisor" ? 2 : 3,
        username: credentials.username,
        name: credentials.name,
        role: role,
      };
      setUser(mockUser);
      localStorage.setItem("auth_token", `mock_${role}`);
      toast.success(`已切换为 ${ROLE_LABELS[role]}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
