import { createSignal, createContext, useContext } from "solid-js";

interface User {
  id: number;
  username: string;
  real_name: string;
  role: string;
  created_at: string;
}

interface AppState {
  user: () => User | null;
  setUser: (user: User | null) => void;
  token: () => string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
  hasRole: (role: string) => boolean;
}

const AppContext = createContext<AppState | null>(null);

const isBrowser = typeof window !== "undefined";

export function createAppState(): AppState {
  const [user, setUser] = createSignal<User | null>(null);
  const [token, setTokenSignal] = createSignal<string | null>(
    isBrowser ? localStorage.getItem("token") : null
  );

  const setToken = (t: string | null) => {
    if (isBrowser) {
      if (t) {
        localStorage.setItem("token", t);
      } else {
        localStorage.removeItem("token");
      }
    }
    setTokenSignal(t);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const isLoggedIn = () => !!token();

  const hasRole = (role: string) => {
    const u = user();
    return u?.role === role;
  };

  return {
    user,
    setUser,
    token,
    setToken,
    logout,
    isLoggedIn,
    hasRole,
  };
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export { AppContext };

export const statusLabels: Record<string, string> = {
  draft: "草稿",
  pending_audit: "待审核",
  rejected: "已驳回",
  audited: "已审核",
  pending_review: "待复核",
  review_rejected: "复核驳回",
  archived: "已归档",
};

export const statusColors: Record<string, string> = {
  draft: "#9ca3af",
  pending_audit: "#f59e0b",
  rejected: "#ef4444",
  audited: "#3b82f6",
  pending_review: "#f59e0b",
  review_rejected: "#ef4444",
  archived: "#10b981",
};

export const nodeLabels: Record<string, string> = {
  registration: "登记节点",
  audit: "审核节点",
  review: "复核节点",
  completed: "已完成",
};

export const roleLabels: Record<string, string> = {
  registrar: "能耗账登记员",
  auditor: "能耗账审核主管",
  property: "产业园物业复核负责人",
};

export const actionLabels: Record<string, string> = {
  edit: "编辑",
  delete: "删除",
  submit_audit: "提交审核",
  resubmit_audit: "补正后重提",
  add_meter_reading: "录入抄表",
  generate_bill: "生成账单",
  add_payment: "登记缴费",
  audit_approve: "审核通过",
  audit_reject: "审核驳回",
  review_approve: "复核归档",
  review_reject: "复核驳回",
  verify_payment: "核销缴费",
};
