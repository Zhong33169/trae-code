import { useState, useEffect, useCallback } from "preact/hooks";
import { getAuditLogs } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { ROLE_MAP } from "../utils/types.ts";
import type { AuditLog, User } from "../utils/types.ts";
import { formatDateTime } from "../utils/format.ts";

const ACTION_LABELS: Record<string, string> = {
  login: "登录",
  create_transfer: "创建流转单",
  register_transfer: "登记流转单",
  verify_transfer: "核验流转单",
  review_transfer: "复核归档",
  batch_create: "批量创建",
  batch_complete: "批量完成",
  batch_retry: "批量重试",
  batch_retry_complete: "批量重试完成",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "用户",
  transfer: "流转单",
  batch: "批量操作",
};

const getActionColor = (action: string) => {
  if (action.includes("batch")) return "bg-indigo-100 text-indigo-800";
  if (action.includes("create")) return "bg-blue-100 text-blue-800";
  if (action.includes("register")) return "bg-yellow-100 text-yellow-800";
  if (action.includes("verify")) return "bg-green-100 text-green-800";
  if (action.includes("review")) return "bg-purple-100 text-purple-800";
  if (action === "login") return "bg-gray-100 text-gray-800";
  return "bg-gray-100 text-gray-800";
};

const parseJSON = (str: string | null | undefined) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
};

const getBatchNo = (log: AuditLog) => {
  if (log.target_type !== "batch") return "";
  const val = parseJSON(log.new_value) || parseJSON(log.old_value);
  return val?.batch_no || "";
};

const getSummary = (log: AuditLog) => {
  const val = parseJSON(log.new_value);
  if (!val) return "";

  if (log.target_type === "batch") {
    if (log.action === "batch_create") {
      return `共 ${val.total_count || 0} 条 · ${val.remark || ""}`;
    }
    if (log.action === "batch_complete" || log.action === "batch_retry_complete") {
      return `成功 ${val.success_count || 0} · 失败 ${val.fail_count || 0}`;
    }
    if (log.action === "batch_retry") {
      return `重试 ${val.retry_count || 0} 条失败项`;
    }
  }

  if (log.target_type === "transfer") {
    if (val.new_status) return `状态：${statusLabel(val.new_status)}`;
    if (val.patient_name) return `患者：${val.patient_name}`;
  }

  return "";
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    draft: "草稿",
    pending_registration: "待登记",
    registered: "已登记",
    pending_verification: "待核验",
    verified: "已核验",
    pending_review: "待复核",
    archived: "已归档",
  };
  return map[status] || status;
};

export default function AuditLogList() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAuditLogs({ page, page_size: pageSize, action: actionFilter });
      setLogs(result.list);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.error || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter]);

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

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const actionOptions = [
    { value: "", label: "全部操作" },
    { value: "login", label: "登录" },
    { value: "create_transfer", label: "创建流转单" },
    { value: "register_transfer", label: "登记" },
    { value: "verify_transfer", label: "核验" },
    { value: "review_transfer", label: "复核归档" },
    { value: "batch_create", label: "批量创建" },
    { value: "batch_complete", label: "批量完成" },
    { value: "batch_retry", label: "批量重试" },
    { value: "batch_retry_complete", label: "批量重试完成" },
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">审计日志</h1>
            <p className="text-sm text-gray-500 mt-1">查看所有操作的审计记录，支持追踪批量操作全流程</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter((e.target as HTMLSelectElement).value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作人</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">批次号 / 目标</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
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
                      <>
                        <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(log.id)}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {log.user_name}
                            <span className="text-xs text-gray-400 ml-1">({ROLE_MAP[log.role] || log.role})</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {TARGET_TYPE_LABELS[log.target_type] || log.target_type}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {log.target_type === "batch" ? (
                              <span className="font-mono text-xs text-indigo-600 font-medium">
                                {getBatchNo(log) || `#${log.target_id}`}
                              </span>
                            ) : log.target_type === "transfer" ? (
                              <span className="text-blue-600">流转单 #{log.target_id}</span>
                            ) : (
                              <span className="text-gray-600">#{log.target_id}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {getSummary(log)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono text-xs">
                            {log.ip_address || "-"}
                          </td>
                        </tr>
                        {expandedId === log.id && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="text-xs text-gray-600 space-y-2">
                                {log.old_value && (
                                  <div>
                                    <span className="font-medium text-gray-500">变更前：</span>
                                    <pre className="mt-1 p-2 bg-gray-100 rounded text-gray-700 overflow-x-auto">
                                      {JSON.stringify(parseJSON(log.old_value), null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <span className="font-medium text-gray-500">变更后：</span>
                                    <pre className="mt-1 p-2 bg-blue-50 rounded text-blue-800 overflow-x-auto">
                                      {JSON.stringify(parseJSON(log.new_value), null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">📖 审计追溯说明</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• <span className="text-indigo-600 font-medium">batch_create</span>：批量操作创建，记录批次号、操作内容、涉及的流转单ID</li>
            <li>• <span className="text-indigo-600 font-medium">batch_complete</span>：批量操作完成，记录成功/失败数量及每条失败的原因</li>
            <li>• <span className="text-indigo-600 font-medium">batch_retry</span>：批量重试发起，记录上一次的成功失败数和本次重试条数</li>
            <li>• <span className="text-indigo-600 font-medium">batch_retry_complete</span>：批量重试完成，记录重试后的最终结果</li>
            <li>• 点击任意行可展开查看变更前后的详细 JSON 数据</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
