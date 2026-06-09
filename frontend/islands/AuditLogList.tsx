import { useState, useEffect, useCallback } from "preact/hooks";
import { getAuditLogs } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { ROLE_MAP } from "../utils/types.ts";
import type { AuditLog, User } from "../utils/types.ts";
import { formatDateTime } from "../utils/format.ts";

export default function AuditLogList() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLogs({ page, page_size: pageSize });
      setLogs(result.list);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.error || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      window.location.href = "/login";
      return;
    }
    setUser(u);
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = {
      login: "登录",
      create_transfer: "创建流转单",
      register_transfer: "登记流转单",
      verify_transfer: "核验流转单",
      review_transfer: "复核归档",
      batch_register: "批量登记",
      batch_verify: "批量核验",
      batch_review: "批量复核",
      batch_retry: "批量重试",
    };
    return map[action] || action;
  };

  const getActionColor = (action: string) => {
    if (action.includes("create")) return "bg-blue-100 text-blue-800";
    if (action.includes("register")) return "bg-yellow-100 text-yellow-800";
    if (action.includes("verify")) return "bg-green-100 text-green-800";
    if (action.includes("review")) return "bg-purple-100 text-purple-800";
    if (action.includes("batch")) return "bg-indigo-100 text-indigo-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-blue-600">💊 处方流转系统</span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                <a href="/" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-2">📋</span>处方流转
                </a>
                <a href="/batch" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                  <span className="mr-2">📦</span>批量操作
                </a>
                <a href="/audit" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-blue-600 bg-blue-50">
                  <span className="mr-2">📝</span>审计日志
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700">{user.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_MAP[user.role] || user.role}</p>
                </div>
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-medium">{user.name.charAt(0)}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  退出
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
          <p className="text-sm text-gray-500 mt-1">查看所有操作的审计记录</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">加载中...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标类型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.user_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ROLE_MAP[log.role] || log.role}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.target_type || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.target_id || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                          {log.ip_address || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                共 {total} 条，第 {page} / {totalPages} 页
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
