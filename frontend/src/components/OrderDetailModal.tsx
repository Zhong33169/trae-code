import React, { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import type { OrderDetail, UserRole } from "../lib/types";
import { STATUS_LABEL, ROLE_LABEL } from "../lib/types";
import { api } from "../lib/api";
import {
  X,
  Send,
  RotateCcw,
  CheckCircle,
  Archive,
  AlertTriangle,
  Clock,
  FileCheck,
  User,
} from "lucide-react";

interface OrderDetailProps {
  order: OrderDetail;
  onClose: () => void;
  onRefresh: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  create: "创建单据",
  submit: "提交单据",
  review: "审核通过",
  review_return: "退回补正",
  archive: "复核归档",
  archive_return: "退回审核",
  amend: "补正提交",
  upload_evidence: "上传证据",
};

const ACTION_ICONS: Record<string, string> = {
  create: "📝",
  submit: "📤",
  review: "✅",
  review_return: "↩️",
  archive: "📦",
  archive_return: "↩️",
  amend: "✏️",
  upload_evidence: "📎",
};

export default function OrderDetailModal({ order, onClose, onRefresh }: OrderDetailProps) {
  const { user } = useAuthStore();
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    setActionError(null);

    let res;
    switch (action) {
      case "submit":
        res = await api.orders.submit(order.id, order.version, comment);
        break;
      case "review":
        res = await api.orders.review(order.id, order.version, comment);
        break;
      case "review_return":
        res = await api.orders.reviewReturn(order.id, order.version, comment);
        break;
      case "archive":
        res = await api.orders.archive(order.id, order.version, comment);
        break;
      case "archive_return":
        res = await api.orders.archiveReturn(order.id, order.version, comment);
        break;
      default:
        setActionLoading(false);
        return;
    }

    if (res.success) {
      onRefresh();
      onClose();
    } else {
      setActionError(res.error?.message || "操作失败");
    }
    setActionLoading(false);
  };

  const canSubmit = user?.role === "registrar" && ["draft", "returned_to_registrar"].includes(order.status);
  const canAmend = user?.role === "registrar" && order.status === "returned_to_registrar";
  const canReview = user?.role === "reviewer" && order.status === "submitted";
  const canReviewReturn = user?.role === "reviewer" && order.status === "submitted";
  const canArchive = user?.role === "archiver" && order.status === "reviewed";
  const canArchiveReturn = user?.role === "archiver" && order.status === "reviewed";

  const hasRegistrationEvidence = order.evidence?.some((e) => e.type === "registration");
  const hasVerificationEvidence = order.evidence?.some((e) => e.type === "verification");
  const hasArchiveEvidence = order.evidence?.some((e) => e.type === "archive");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{order.order_no}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {STATUS_LABEL[order.status]} · 版本 v{order.version}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-xs text-slate-500 font-medium">菜品名称</label>
              <p className="text-sm text-slate-800 font-medium mt-0.5">{order.dish_name}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">菜品分类</label>
              <p className="text-sm text-slate-800 mt-0.5">{order.dish_category}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">价格</label>
              <p className="text-sm text-slate-800 mt-0.5">¥{order.price}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">创建时间</label>
              <p className="text-sm text-slate-800 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
            </div>
          </div>

          {order.description && (
            <div className="mb-6">
              <label className="text-xs text-slate-500 font-medium">描述</label>
              <p className="text-sm text-slate-700 mt-0.5">{order.description}</p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              证据检查
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg border ${hasRegistrationEvidence ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {hasRegistrationEvidence ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  登记证据
                </div>
                <p className="text-xs mt-1 text-slate-500">
                  {hasRegistrationEvidence ? "已上传" : "⚠️ 缺失"}
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${hasVerificationEvidence ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {hasVerificationEvidence ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  核验证据
                </div>
                <p className="text-xs mt-1 text-slate-500">
                  {hasVerificationEvidence ? "已上传" : "待上传"}
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${hasArchiveEvidence ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {hasArchiveEvidence ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                  归档证据
                </div>
                <p className="text-xs mt-1 text-slate-500">
                  {hasArchiveEvidence ? "已上传" : "待上传"}
                </p>
              </div>
            </div>
          </div>

          {order.action_logs && order.action_logs.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                流程轨迹
              </h3>
              <div className="space-y-0">
                {order.action_logs.map((log, i) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                        {ACTION_ICONS[log.action] || "📌"}
                      </div>
                      {i < (order.action_logs?.length || 0) - 1 && (
                        <div className="w-0.5 h-8 bg-slate-200" />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-medium text-slate-800">
                        {ACTION_LABELS[log.action] || log.action}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <User className="w-3 h-3" />
                        {log.operator_name || log.operator}
                        <span className="text-slate-400">({ROLE_LABEL[log.operator_role as UserRole]})</span>
                      </div>
                      {log.comment && (
                        <div className="text-xs text-slate-600 mt-1 bg-slate-50 rounded p-2">
                          {log.comment}
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-5">
          {actionError && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">操作被拦截</div>
                <div className="mt-0.5">{actionError}</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="输入操作备注（可选）"
              className="flex-1 px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2">
            {canSubmit && (
              <button
                onClick={() => handleAction("submit")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                提交单据
              </button>
            )}
            {canReview && (
              <button
                onClick={() => handleAction("review")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                审核通过
              </button>
            )}
            {canReviewReturn && (
              <button
                onClick={() => handleAction("review_return")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                退回补正
              </button>
            )}
            {canArchive && (
              <button
                onClick={() => handleAction("archive")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                <Archive className="w-4 h-4" />
                复核归档
              </button>
            )}
            {canArchiveReturn && (
              <button
                onClick={() => handleAction("archive_return")}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                退回审核
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
