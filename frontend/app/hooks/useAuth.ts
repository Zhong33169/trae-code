import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "@remix-run/react";
import {
  login as authLogin,
  getCurrentUser,
  setAuthData,
  clearAuthData,
  getCurrentUserFromCookie,
  User,
  LoginResponse,
} from "~/services/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const cookieUser = getCurrentUserFromCookie();
      if (cookieUser) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch {
          clearAuthData();
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!loading) {
      const publicPaths = ["/login"];
      const isPublicPath = publicPaths.includes(location.pathname);
      
      if (!user && !isPublicPath) {
        navigate("/login", { replace: true });
      } else if (user && location.pathname === "/login") {
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, location.pathname, navigate]);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResponse> => {
      const response = await authLogin(username, password);
      setAuthData(response);
      setUser(response.user);
      return response;
    },
    []
  );

  const logout = useCallback(() => {
    clearAuthData();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  return {
    user,
    loading,
    login,
    logout,
    hasRole,
    checkAuth,
  };
}
