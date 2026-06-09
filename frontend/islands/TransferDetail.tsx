import { useState, useEffect, useCallback } from "preact/hooks";
import { getTransfer, getEvidences, registerTransfer, verifyTransfer, reviewTransfer } from "../utils/api.ts";
import { getUser, clearAuth } from "../utils/auth.ts";
import { STATUS_MAP, ROLE_MAP, EVIDENCE_TYPE_MAP } from "../utils/types.ts";
import type { PrescriptionTransfer, TransferEvidence, User } from "../utils/types.ts";
import { formatDateTime, formatAmount, maskIdCard } from "../utils/format.ts";
import { StatusBadge } from "../components/StatusBadge.tsx";

interface TransferDetailProps {
  id: string;
}

export default function TransferDetail({ id }: TransferDetailProps) {
  const [user, setUser] = useState<User | null>(null);
  const [transfer, setTransfer] = useState<PrescriptionTransfer | null>(null);
  const [evidences, setEvidences] = useState<TransferEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<"register" | "verify" | "review" | null>(null);
  const [evidenceContent, setEvidenceContent] = useState("");
  const [remark, setRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [transferData, evidencesData] = await Promise.all([
        getTransfer(parseInt(id)),
        getEvidences(parseInt(id)),
      ]);
      setTransfer(transferData);
      setEvidences(evidencesData);
    } catch (err: any) {
      setError(err.error || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      window.location.href = "/login";
      return;
    }
    setUser(u);
    loadData();
  }, [loadData]);

  const canDoAction = (type: "register" | "verify" | "review") => {
    if (!user || !transfer) return false;
    if (type === "register") {
      return user.role === "reception_assistant" && 
        (transfer.status === "draft" || transfer.status === "pending_registration");
    }
    if (type === "verify") {
      return user.role === "attending_physician" && 
        (transfer.status === "registered" || transfer.status === "pending_verification");
    }
    if (type === "review") {
      return user.role === "pharmacy_admin" && 
        (transfer.status === "verified" || transfer.status === "pending_review");
    }
    return false;
  };

  const getActionLabel = (type: "register" | "verify" | "review") => {
    if (type === "register") return "登记";
    if (type === "verify") return "核验";
    if (type === "review") return "复核归档";
    return "";
  };

  const openActionModal = (type: "register" | "verify" | "review") => {
    setActionType(type);
    setEvidenceContent("");
    setRemark("");
    setActionError("");
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!evidenceContent.trim()) {
      setActionError("请输入证据内容");
      return;
    }
    if (!transfer || !actionType) return;

    setActionLoading(true);
    setActionError("");

    try {
      const data = {
        evidence_content: evidenceContent,
        remark,
        version: transfer.version,
      };

      let result;
      if (actionType === "register") {
        result = await registerTransfer(transfer.id, data);
      } else if (actionType === "verify") {
        result = await verifyTransfer(transfer.id, data);
      } else if (actionType === "review") {
        result = await reviewTransfer(transfer.id, data);
      }

      setTransfer(result);
      setShowActionModal(false);
      loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setActionError("版本冲突：该记录已被他人修改，请刷新页面后重试");
      } else {
        setActionError(err.error || "操作失败");
      }
    } finally {
      setActionLoading(false);
    }
  };

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
                <a href="/audit" className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <a href="/" className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
            ← 返回列表
          </a>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            加载中...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-red-500">
            {error}
          </div>
        ) : transfer ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{transfer.transfer_no}</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    创建于 {formatDateTime(transfer.created_at)}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <StatusBadge status={transfer.status} />
                  <span className="text-xs text-gray-400">版本 {transfer.version}</span>
                </div>
              </div>

              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">基本信息</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-gray-500">患者姓名</label>
                    <p className="text-gray-900 font-medium mt-1">{transfer.patient_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">身份证号</label>
                    <p className="text-gray-900 font-medium mt-1">{maskIdCard(transfer.id_card)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">科室</label>
                    <p className="text-gray-900 font-medium mt-1">{transfer.department}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">开方医生</label>
                    <p className="text-gray-900 font-medium mt-1">{transfer.doctor_name}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">药品清单</label>
                    <p className="text-gray-900 mt-1">{transfer.medicine_list || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">总金额</label>
                    <p className="text-gray-900 font-medium mt-1 text-lg text-blue-600">
                      {formatAmount(transfer.total_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">办理操作</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-3">
                  {canDoAction("register") && (
                    <button
                      onClick={() => openActionModal("register")}
                      className="px-6 py-2.5 bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
                    >
                      进行登记
                    </button>
                  )}
                  {canDoAction("verify") && (
                    <button
                      onClick={() => openActionModal("verify")}
                      className="px-6 py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      进行核验
                    </button>
                  )}
                  {canDoAction("review") && (
                    <button
                      onClick={() => openActionModal("review")}
                      className="px-6 py-2.5 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                    >
                      复核归档
                    </button>
                  )}
                  {!canDoAction("register") && !canDoAction("verify") && !canDoAction("review") && (
                    <p className="text-gray-500 text-sm">
                      当前状态或角色无可执行的操作
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">证据时间线</h2>
              </div>
              <div className="p-6">
                {evidences.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    暂无证据记录
                  </div>
                ) : (
                  <div className="relative">
                    {evidences.map((ev, index) => (
                      <div key={ev.id} className="relative pl-8 pb-8 last:pb-0">
                        {index < evidences.length - 1 && (
                          <div className="absolute left-3 top-4 bottom-0 w-0.5 bg-gray-200"></div>
                        )}
                        <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              {EVIDENCE_TYPE_MAP[ev.evidence_type] || ev.evidence_type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(ev.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            操作人：{ev.operator_name} ({ROLE_MAP[ev.operator_role] || ev.operator_role})
                          </p>
                          <div className="bg-white rounded p-3 border border-gray-200">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {ev.evidence_content}
                            </p>
                          </div>
                          {ev.remark && (
                            <p className="text-sm text-gray-500 mt-2">
                              <span className="font-medium">备注：</span>{ev.remark}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showActionModal && actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {getActionLabel(actionType)}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                流转单号：{transfer?.transfer_no}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {actionError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  证据内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={evidenceContent}
                  onInput={(e) => setEvidenceContent((e.target as HTMLTextAreaElement).value)}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入证据内容..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={remark}
                  onInput={(e) => setRemark((e.target as HTMLTextAreaElement).value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="可选备注信息"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-700">
                  ⚠️ 提交后状态将变更，请确认信息无误后再提交。
                  当前版本号：{transfer?.version}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowActionModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? "提交中..." : "确认提交"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
