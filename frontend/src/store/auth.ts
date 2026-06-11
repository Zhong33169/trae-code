import { createSignal } from "solid-js";

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  role: "registrar" | "auditor" | "reviewer";
  department?: string;
}

const [user, setUser] = createSignal<UserInfo | null>(null);
const [token, setToken] = createSignal<string | null>(
  localStorage.getItem("token")
);

export const authStore = {
  user,
  token,

  setAuth(userInfo: UserInfo, tokenStr: string) {
    setUser(userInfo);
    setToken(tokenStr);
    localStorage.setItem("token", tokenStr);
    localStorage.setItem("user", JSON.stringify(userInfo));
  },

  clearAuth() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  initFromStorage() {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userInfo = JSON.parse(userStr);
        setUser(userInfo);
      } catch (e) {
        console.error("Failed to parse user from storage");
      }
    }
  },

  hasRole(role: string | string[]) {
    const currentUser = user();
    if (!currentUser) return false;
    if (Array.isArray(role)) {
      return role.includes(currentUser.role);
    }
    return currentUser.role === role;
  },
};

export const roleNames: Record<string, string> = {
  registrar: "种植登记员",
  auditor: "种植审核主管",
  reviewer: "农业合作社复核负责人",
};

export const statusNames: Record<string, string> = {
  pending_registration: "待登记",
  registered: "待审核",
  audit_rejected: "审核驳回",
  audit_passed: "待复核",
  review_rejected: "复核驳回",
  archived: "已归档",
};

export const statusTagTypes: Record<string, string> = {
  pending_registration: "default",
  registered: "processing",
  audit_rejected: "error",
  audit_passed: "warning",
  review_rejected: "error",
  archived: "success",
};

export const cropTypeNames: Record<string, string> = {
  rice: "水稻",
  wheat: "小麦",
  corn: "玉米",
  soybean: "大豆",
  vegetable: "蔬菜",
  fruit: "水果",
  other: "其他",
};

export const nodeStatusNames: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  rejected: "已驳回",
  timeout: "已超时",
};
