"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  UserCircle,
  FileText,
  ShieldCheck,
  CheckCheck,
  Send,
  Ban,
  ArrowRight,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  getOrder,
  supplementOrder,
  verifyOrder,
  reviewOrder,
  type Order,
  type ApiError,
  type BlockAttempt,
  type BlockCode,
} from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_supplement: { label: "待补录", color: "text-yellow-700", bg: "bg-yellow-100" },
  pending_verification: { label: "待核验", color: "text-blue-700", bg: "bg-blue-100" },
  pending_review: { label: "待复核", color: "text-purple-700", bg: "bg-purple-100" },
  archived: { label: "已归档", color: "text-green-700", bg: "bg-green-100" },
};

const BLOCK_CODE_LABELS: Record<BlockCode, { label: string; color: string; bg: string }> = {
  wrong_role: { label: "错角色", color: "text-purple-700", bg: "bg-purple-100" },
  wrong_status: { label: "错状态", color: "text-orange-700", bg: "bg-orange-100" },
  missing_evidence: { label: "缺证据", color: "text-amber-700", bg: "bg-amber-100" },
  version_conflict: { label: "版本冲突", color: "text-rose-700", bg: "bg-rose-100" },
  duplicate_supplement: { label: "重复补录", color: "text-pink-700", bg: "bg-pink-100" },
  archived: { label: "已归档", color: "text-green-700", bg: "bg-green-100" },
  not_found: { label: "不存在", color: "text-gray-700", bg: "bg-gray-100" },
  unknown: { label: "未知", color: "text-gray-700", bg: "bg-gray-100" },
};

function BlockCodeBadge({ code }: { code: BlockCode | string }) {
  const cfg = BLOCK_CODE_LABELS[code as BlockCode] || { label: code, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

const ROLE_LABELS: Record<string, string> = {
  receptionist: "前厅接待",
  room_supervisor: "客房主管",
  duty_manager: "值班经理",
};

const EVIDENCE_TYPES = [
  "身份证扫描",
  "入住登记表",
  "支付凭证",
  "客房检查记录",
  "监控截图",
  "其他",
];

const STEP_MAP: Record<string, number> = {
  pending_supplement: 0,
  pending_verification: 1,
  pending_review: 2,
  archived: 3,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "text-gray-700", bg: "bg-gray-100" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

interface EvidenceFormItem {
  type: string;
  description: string;
}

function EvidenceFormItems({
  items,
  onChange,
}: {
  items: EvidenceFormItem[];
  onChange: (items: EvidenceFormItem[]) => void;
}) {
  const addItem = () => onChange([...items, { type: "其他", description: "" }]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof EvidenceFormItem, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-navy-700">
          证据项 <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-navy-600 hover:text-navy-800"
        >
          <Plus className="w-3.5 h-3.5" /> 添加证据
        </button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-start">
          <select
            value={item.type}
            onChange={(e) => updateItem(idx, "type", e.target.value)}
            className="flex-shrink-0 w-32 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={item.description}
            onChange={(e) => updateItem(idx, "description", e.target.value)}
            placeholder="证据描述"
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-gray-400 py-2">请添加至少1项证据</p>
      )}
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const { currentUser, token, fetchOrders, login } = useStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ code?: string; actionHint?: string; currentVersion?: number } | null>(null);
  const [success, setSuccess] = useState(false);

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [supplementReason, setSupplementReason] = useState("");
  const [evidenceItems, setEvidenceItems] = useState<EvidenceFormItem[]>([]);
  const [verified, setVerified] = useState(true);
  const [approved, setApproved] = useState(true);
  const [remark, setRemark] = useState("");

  const loadOrder = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      setErrorDetail(null);
      const data = await getOrder(token, id);
      setOrder(data);
      setGuestName(data.guest_name);
      setGuestPhone(data.guest_phone || "");
      setRoomNumber(data.room_number || "");
      setSupplementReason(data.supplement_reason || "");
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.error || "获取订单失败");
      setErrorDetail({
        code: apiErr.code,
        actionHint: apiErr.actionHint,
        currentVersion: apiErr.currentVersion,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      login("receptionist1", "123456").catch(() => {});
    } else {
      loadOrder();
    }
  }, [token, id]);

  const handleSubmit = async () => {
    if (!token || !order) return;
    const role = currentUser?.role;
    const status = order.status;

    if (role === "receptionist" && status === "pending_supplement") {
      if (evidenceItems.length === 0) {
        setError("补录登记必须至少提供1项登记证据");
        return;
      }
      if (!guestName.trim()) {
        setError("住客姓名不能为空");
        return;
      }
      setSubmitting(true);
      setError(null);
      setErrorDetail(null);
      try {
        await supplementOrder(token, id, {
          version: order.version,
          guestName,
          guestPhone: guestPhone || undefined,
          roomNumber: roomNumber || undefined,
          supplementReason: supplementReason || undefined,
          evidenceItems: evidenceItems.filter((e) => e.description.trim()),
        });
        setSuccess(true);
        setTimeout(() => {
          fetchOrders();
          router.push("/");
        }, 1500);
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.reason || apiErr.error || "操作失败");
        setErrorDetail({
          code: apiErr.code,
          actionHint: apiErr.actionHint,
          currentVersion: apiErr.currentVersion,
        });
        loadOrder();
      } finally {
        setSubmitting(false);
      }
    } else if (role === "room_supervisor" && status === "pending_verification") {
      if (verified && evidenceItems.length === 0) {
        setError("核验通过必须至少提供1项核验证据");
        setErrorDetail(null);
        return;
      }
      setSubmitting(true);
      setError(null);
      setErrorDetail(null);
      try {
        await verifyOrder(token, id, {
          version: order.version,
          verified,
          evidenceItems: verified ? evidenceItems.filter((e) => e.description.trim()) : undefined,
          remark: remark || undefined,
        });
        setSuccess(true);
        setTimeout(() => {
          fetchOrders();
          router.push("/");
        }, 1500);
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.reason || apiErr.error || "操作失败");
        setErrorDetail({
          code: apiErr.code,
          actionHint: apiErr.actionHint,
          currentVersion: apiErr.currentVersion,
        });
        loadOrder();
      } finally {
        setSubmitting(false);
      }
    } else if (role === "duty_manager" && status === "pending_review") {
      if (approved && evidenceItems.length === 0) {
        setError("归档确认必须至少提供1项归档证据");
        setErrorDetail(null);
        return;
      }
      setSubmitting(true);
      setError(null);
      setErrorDetail(null);
      try {
        await reviewOrder(token, id, {
          version: order.version,
          approved,
          evidenceItems: approved ? evidenceItems.filter((e) => e.description.trim()) : undefined,
          remark: remark || undefined,
        });
        setSuccess(true);
        setTimeout(() => {
          fetchOrders();
          router.push("/");
        }, 1500);
      } catch (err) {
        const apiErr = err as ApiError;
        setError(apiErr.reason || apiErr.error || "操作失败");
        setErrorDetail({
          code: apiErr.code,
          actionHint: apiErr.actionHint,
          currentVersion: apiErr.currentVersion,
        });
        loadOrder();
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-navy-400" />
        <span className="ml-3 text-gray-500">加载订单中...</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500">订单不存在</p>
          <button onClick={() => router.push("/")} className="mt-4 text-sm text-navy-600 hover:underline">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const role = currentUser?.role;
  const status = order.status;
  const stepIndex = STEP_MAP[status] ?? 0;

  const canOperate =
    (role === "receptionist" && status === "pending_supplement") ||
    (role === "room_supervisor" && status === "pending_verification") ||
    (role === "duty_manager" && status === "pending_review");

  const noActionReason = !canOperate
    ? role !== "receptionist" && role !== "room_supervisor" && role !== "duty_manager"
      ? "当前角色无权操作此订单"
      : "此订单当前状态无需操作"
    : null;

  const steps = [
    { label: "补录登记", icon: FileText },
    { label: "过程核验", icon: ShieldCheck },
    { label: "复核归档", icon: CheckCheck },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {success && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium bg-green-600 text-white">
          <CheckCircle2 className="w-4 h-4" />
          操作成功，正在返回...
        </div>
      )}

      <header className="bg-navy-700 text-white px-6 py-3 flex items-center gap-4 shadow-md">
        <button onClick={() => router.push("/")} className="flex items-center gap-1 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">返回</span>
        </button>
        <div className="flex-1 flex items-center gap-3">
          <h1 className="text-base font-semibold">{order.order_no}</h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <UserCircle className="w-4 h-4" />
          {ROLE_LABELS[role || "receptionist"]}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-navy-800 mb-4">订单信息</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">订单编号:</span> <span className="font-medium text-navy-800 ml-2">{order.order_no}</span></div>
            <div><span className="text-gray-400">住客姓名:</span> <span className="font-medium text-navy-800 ml-2">{order.guest_name}</span></div>
            <div><span className="text-gray-400">联系电话:</span> <span className="font-medium text-navy-800 ml-2">{order.guest_phone || "—"}</span></div>
            <div><span className="text-gray-400">房间号:</span> <span className="font-medium text-navy-800 ml-2">{order.room_number || "—"}</span></div>
            <div><span className="text-gray-400">补录原因:</span> <span className="font-medium text-navy-800 ml-2">{order.supplement_reason || "—"}</span></div>
            <div><span className="text-gray-400">当前状态:</span> <span className="ml-2"><StatusBadge status={status} /></span></div>
            <div><span className="text-gray-400">版本号:</span> <span className="font-medium text-navy-800 ml-2">v{order.version}</span></div>
            <div><span className="text-gray-400">创建时间:</span> <span className="font-medium text-navy-800 ml-2">{new Date(order.created_at).toLocaleString("zh-CN")}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-navy-800 mb-6">处理进度</h2>
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = idx < stepIndex;
              const isCurrent = idx === stepIndex;
              return (
                <div key={idx} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-navy-700 text-white ring-4 ring-navy-100"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <StepIcon className="w-5 h-5" />}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isCompleted ? "text-green-600" : isCurrent ? "text-navy-700" : "text-gray-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${idx < stepIndex ? "bg-green-500" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-red-800">操作被拦截</p>
                {errorDetail?.code && <BlockCodeBadge code={errorDetail.code} />}
                {typeof errorDetail?.currentVersion === "number" && (
                  <span className="text-xs text-gray-500">当前版本 v{errorDetail.currentVersion}</span>
                )}
              </div>
              <p className="text-sm text-red-700">{error}</p>
              {errorDetail?.actionHint && (
                <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                  <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{errorDetail.actionHint}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {(order.blockAttempts && order.blockAttempts.length > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy-800 mb-4 flex items-center gap-2">
              <Ban className="w-4 h-4 text-amber-600" />
              拦截记录 <span className="text-xs text-gray-400 font-normal">({order.blockAttempts.length})</span>
            </h2>
            <div className="space-y-3">
              {order.blockAttempts.slice().reverse().map((b) => (
                <div key={b.id} className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BlockCodeBadge code={b.code} />
                    <span className="text-xs text-gray-500">{ROLE_LABELS[b.operator_role] || b.operator_role}</span>
                    <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString("zh-CN")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                    <span>当前版本 v{b.current_version}</span>
                    {b.submitted_version !== null && b.submitted_version !== b.current_version && (
                      <span className="text-rose-600">(提交 v{b.submitted_version})</span>
                    )}
                  </div>
                  <p className="text-sm text-amber-900">{b.reason}</p>
                  <p className="text-xs text-amber-700 mt-1 flex items-start gap-1">
                    <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{b.action_hint}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-navy-800 mb-4">操作面板</h2>

          {!canOperate && noActionReason && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {noActionReason}
            </div>
          )}

          {role === "receptionist" && status === "pending_supplement" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">住客姓名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">联系电话</label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">房间号</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-navy-700 mb-1">补录原因</label>
                  <input
                    type="text"
                    value={supplementReason}
                    onChange={(e) => setSupplementReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  />
                </div>
              </div>
              <EvidenceFormItems items={evidenceItems} onChange={setEvidenceItems} />
            </div>
          )}

          {role === "room_supervisor" && status === "pending_verification" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-navy-700">核验结果:</label>
                <button
                  type="button"
                  onClick={() => setVerified(true)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    verified ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  通过
                </button>
                <button
                  type="button"
                  onClick={() => setVerified(false)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !verified ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  退回
                </button>
              </div>
              {verified && <EvidenceFormItems items={evidenceItems} onChange={setEvidenceItems} />}
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  placeholder="可选填写核验备注..."
                />
              </div>
            </div>
          )}

          {role === "duty_manager" && status === "pending_review" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-navy-700">复核结果:</label>
                <button
                  type="button"
                  onClick={() => setApproved(true)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    approved ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  归档确认
                </button>
                <button
                  type="button"
                  onClick={() => setApproved(false)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    !approved ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  退回
                </button>
              </div>
              {approved && <EvidenceFormItems items={evidenceItems} onChange={setEvidenceItems} />}
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1">备注</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  placeholder="可选填写复核备注..."
                />
              </div>
            </div>
          )}

          {canOperate && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-navy-700 text-white px-6 py-2.5 rounded-lg hover:bg-navy-800 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                提交
              </button>
            </div>
          )}
        </div>

        {(order.auditLogs && order.auditLogs.length > 0) || (order.blockAttempts && order.blockAttempts.length > 0) ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-navy-800 mb-4">审计时间线</h2>
            <div className="space-y-0">
              {(() => {
                const logs: Array<{
                  id: string;
                  type: "audit" | "block";
                  ts: number;
                  data: any;
                }> = [
                  ...(order.auditLogs || []).map((l) => ({
                    id: l.id,
                    type: "audit" as const,
                    ts: new Date(l.created_at).getTime(),
                    data: l,
                  })),
                  ...(order.blockAttempts || []).map((b) => ({
                    id: b.id,
                    type: "block" as const,
                    ts: new Date(b.created_at).getTime(),
                    data: b,
                  })),
                ].sort((a, b) => a.ts - b.ts);

                return logs.map((item, idx) => {
                  if (item.type === "audit") {
                    const log = item.data;
                    return (
                      <div key={item.id} className="flex gap-4 pb-4 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-navy-500" />
                          </div>
                          {idx < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-navy-700">{ROLE_LABELS[log.operator_role] || log.operator_role}</span>
                            <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("zh-CN")}</span>
                          </div>
                          <p className="text-sm text-gray-600">{log.detail}</p>
                        </div>
                      </div>
                    );
                  } else {
                    const b = item.data as BlockAttempt;
                    return (
                      <div key={item.id} className="flex gap-4 pb-4 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <Ban className="w-4 h-4 text-amber-600" />
                          </div>
                          {idx < logs.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-amber-700">
                              {ROLE_LABELS[b.operator_role] || b.operator_role}
                            </span>
                            <BlockCodeBadge code={b.code} />
                            <span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString("zh-CN")}</span>
                          </div>
                          <p className="text-sm text-amber-800">
                            尝试{b.action_attempted === "supplement" ? "补录" : b.action_attempted === "verify" ? "核验" : "归档"}被拦截：{b.reason}
                          </p>
                          <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>{b.action_hint}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
