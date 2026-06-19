import React from "react";
import { useAuthStore } from "../stores/authStore";
import { useOrderStore } from "../stores/orderStore";
import type { UserRole } from "../lib/types";
import { ROLE_LABEL } from "../lib/types";
import { User, LogOut, RefreshCw } from "lucide-react";

const ROLES: UserRole[] = ["registrar", "reviewer", "archiver"];

export default function RoleSwitcher() {
  const { user, switchRole, logout } = useAuthStore();
  const { fetchOrders, clearSelection } = useOrderStore();

  const handleSwitch = async (role: UserRole) => {
    if (role === user?.role) return;
    const ok = await switchRole(role);
    if (ok) {
      clearSelection();
      fetchOrders(role);
    }
  };

  const handleRefresh = () => {
    if (user) fetchOrders(user.role);
  };

  return (
    <div className="flex items-center gap-3 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5 text-slate-600" />
        <span className="font-semibold text-slate-800">
          {user?.display_name || "未登录"}
        </span>
        {user && (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {ROLE_LABEL[user.role]}
          </span>
        )}
      </div>

      <div className="flex gap-1 ml-4">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => handleSwitch(role)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              user?.role === role
                ? "bg-indigo-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <button
        onClick={handleRefresh}
        className="p-2 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
        title="刷新列表"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      <button
        onClick={logout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        退出
      </button>
    </div>
  );
}
