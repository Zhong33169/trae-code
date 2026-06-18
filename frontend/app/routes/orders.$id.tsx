import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useOutletContext,
  useRevalidator,
} from "@remix-run/react";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  MapPin,
  MinusCircle,
  Phone,
  PlusCircle,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { fetchOrderDetail, processStage, ApiError } from "~/lib/api";
import {
  ROLE_LABELS,
  STAGE_LABELS,
  STAGE_ROLE,
  STATUS_LABELS,
  WARNING_LABELS,
} from "~/lib/types";
import type {
  AuditLog,
  Material,
  OrderDetail,
  Role,
  Stage,
  StageRecord,
  User,
} from "~/lib/types";
import { WarningBadge, WARNING_STYLES } from "~/components/WarningBadge";
import { Toast } from "~/components/Toast";
import type { ToastData } from "~/components/Toast";

export const meta: MetaFunction = () => [{ title: "工单详情 · 水务营业厅" }];

const STAGES: Stage[] = ["registration", "verification", "archiving"];
const ROLES: Role[] = ["window_staff", "meter_supervisor", "business_manager"];

interface OutletCtx {
  users: User[];
}

export async function loader(args: LoaderFunctionArgs) {
  const id = Number(args.params.id);
  if (!id || Number.isNaN(id)) {
    throw new Response("工单不存在", { status: 404 });
  }
  try {
    const detail = await fetchOrderDetail(id);
    return { detail, error: null };
  } catch (e) {
    return {
      detail: null as OrderDetail | null,
      error: e instanceof Error ? e.message : "加载失败",
    };
  }
}

export default function OrderDetailPage() {
  const { detail, error } = useLoaderData<typeof loader>();
  const { users } = useOutletContext<OutletCtx>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [actingRole, setActingRole] = useState<Role>("meter_supervisor");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [materialsOverride, setMaterialsOverride] = useState<
    Record<number, Record<string, boolean>>
  >({});
  const [opinion, setOpinion] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  const showToast = useCallback((t: ToastData) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }, []);

  if (error || !detail) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-crimson mx-auto mb-3" />
        <p className="text-ink-soft font-medium mb-1">工单详情加载失败</p>
        <p className="text-ink-muted text-sm font-mono">{error}</p>
        <Link to="/" className="btn-secondary mt-4 inline-flex">
          <ArrowLeft className="w-4 h-4" /> 返回列表
        </Link>
      </div>
    );
  }

  const { order, stages, auditLogs, warning, currentStageRecord } = detail;
  const currentStageIndex = STAGES.indexOf(order.currentStage);
  const actingUser = users.find((u) => u.role === actingRole);

  const handleAction = async (
    action: "submit" | "approve" | "reject",
    stage: Stage,
  ) => {
    if (!actingUser) {
      showToast({ type: "error", msg: "未找到当前岗位用户" });
      return;
    }
    const stageRec = stages.find((s) => s.stage === stage);
    if (!stageRec) return;

    const override = materialsOverride[stageRec.id] ?? {};
    const materials = stageRec.materials.map((m) => ({
      ...m,
      provided: override[m.name] ?? m.provided,
    }));

    setActionLoading(true);
    try {
      await processStage(order.id, stage, {
        action,
        actorRole: actingRole,
        actorId: actingUser.id,
        materials: action === "reject" ? undefined : materials,
        processingOpinion: opinion || undefined,
        reviewComment: reviewComment || undefined,
        version: order.version,
      });
      showToast({ type: "success", msg: "操作成功，工单已推进" });
      setOpinion("");
      setReviewComment("");
      setMaterialsOverride({});
      revalidator.revalidate();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "操作失败";
      const reason = e instanceof ApiError ? e.reason : "";
      showToast({
        type: "error",
        msg: reason ? `${msg}（${reasonLabel(reason)}）` : msg,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleMaterial = (
    stageRecId: number,
    matName: string,
    currentProvided: boolean,
  ) => {
    setMaterialsOverride((prev) => {
      const stageMap = prev[stageRecId] ?? {};
      const effective = stageMap[matName] ?? currentProvided;
      return {
        ...prev,
        [stageRecId]: {
          ...stageMap,
          [matName]: !effective,
        },
      };
    });
  };

  const canActOnCurrent =
    actingRole === STAGE_ROLE[order.currentStage] &&
    order.status !== "synced";

  return (
    <div className="space-y-4">
      <Toast toast={toast} />

      <div className="flex items-center gap-3">
        <Link to="/" className="btn-secondary !py-1.5">
          <ArrowLeft className="w-4 h-4" /> 返回列表
        </Link>
        <h1 className="font-display text-2xl font-extrabold text-ink">
          {order.title}
        </h1>
        <span className="font-mono text-sm text-ink-muted">{order.orderNo}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <OrderInfoCard order={order} />
          <StageTrack
            stages={STAGES}
            current={order.currentStage}
            stageRecords={stages}
          />
          <WarningCard warning={warning} />
          {STAGES.map((st) => (
            <StageDetailCard
              key={st}
              stage={st}
              stageRec={stages.find((s) => s.stage === st)}
              isCurrent={st === order.currentStage}
              canAct={canActOnCurrent && st === order.currentStage}
              materialsOverride={materialsOverride}
              onToggleMaterial={toggleMaterial}
              opinion={opinion}
              setOpinion={setOpinion}
              reviewComment={reviewComment}
              setReviewComment={setReviewComment}
              onAction={(action) => handleAction(action, st)}
              loading={actionLoading}
              actingRole={actingRole}
              orderStatus={order.status}
            />
          ))}
        </div>

        <div className="space-y-4">
          <RoleActionPanel
            actingRole={actingRole}
            setActingRole={setActingRole}
            actingUser={actingUser}
            currentStage={order.currentStage}
            canAct={canActOnCurrent}
            orderStatus={order.status}
          />
          <AuditTimeline logs={auditLogs} />
        </div>
      </div>
    </div>
  );
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    forbidden: "越权",
    wrong_order: "顺序有误",
    missing_evidence: "证据缺失",
    stage_timeout: "超时限",
    concurrency_conflict: "并发冲突",
    not_found: "未找到",
    invalid_input: "参数有误",
    internal: "内部错误",
  };
  return map[reason] ?? reason;
}

function OrderInfoCard({ order }: { order: OrderDetail["order"] }) {
  return (
    <div className="card p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <InfoItem icon={<UserIcon className="w-4 h-4" />} label="报修客户" value={order.customerName} />
        <InfoItem icon={<Phone className="w-4 h-4" />} label="联系电话" value={order.customerPhone} />
        <InfoItem icon={<MapPin className="w-4 h-4" />} label="抢修地址" value={order.address} />
        <InfoItem icon={<FileText className="w-4 h-4" />} label="抢修类型" value={order.repairType} />
        <InfoItem
          icon={<AlertTriangle className="w-4 h-4" />}
          label="优先级"
          value={
            <span className={order.priority === "紧急" ? "text-crimson font-semibold" : ""}>
              {order.priority}
            </span>
          }
        />
        <InfoItem icon={<Clock className="w-4 h-4" />} label="SLA" value={`${order.slaHours}h`} />
        <InfoItem icon={<UserIcon className="w-4 h-4" />} label="建单人" value={order.createdByName} />
        <InfoItem
          icon={<ChevronRight className="w-4 h-4" />}
          label="版本号"
          value={<span className="font-mono">v{order.version}</span>}
        />
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-ink-muted mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-ink font-medium">{value}</div>
    </div>
  );
}

function StageTrack({
  stages,
  current,
  stageRecords,
}: {
  stages: Stage[];
  current: Stage;
  stageRecords: StageRecord[];
}) {
  const currentIndex = stages.indexOf(current);
  return (
    <div className="card p-4">
      <div className="flex items-center">
        {stages.map((st, i) => {
          const rec = stageRecords.find((s) => s.stage === st);
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={st} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isDone
                      ? "bg-emerald-ok text-white border-emerald-ok"
                      : isCurrent
                      ? "bg-deep-500 text-white border-deep-500 ring-4 ring-deep-100"
                      : "bg-white text-ink-muted border-deep-100"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-semibold text-center ${
                    isCurrent ? "text-deep-600" : isDone ? "text-emerald-ok" : "text-ink-muted"
                  }`}
                >
                  {STAGE_LABELS[st]}
                </span>
                {rec && (
                  <span className="text-[10px] text-ink-muted font-mono">
                    {rec.status}
                  </span>
                )}
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 mb-5 rounded ${
                    i < currentIndex ? "bg-emerald-ok" : "bg-deep-100"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WarningCard({ warning }: { warning: OrderDetail["warning"] }) {
  const style = WARNING_STYLES[warning.level];
  const isOverdue = warning.level === "overdue";
  const isNearDue = warning.level === "near_due";
  return (
    <div
      className={`card p-4 border-l-4 ${
        isOverdue
          ? "border-l-crimson bg-crimson-soft/30"
          : isNearDue
          ? "border-l-amber-warn bg-amber-soft/30"
          : "border-l-deep-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-ink-muted">到期预警</span>
            <WarningBadge level={warning.level} size="md" />
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-xs text-ink-muted">剩余时间</div>
              <div
                className={`font-mono text-2xl font-bold ${
                  isOverdue
                    ? "text-crimson"
                    : isNearDue
                    ? "text-amber-warn"
                    : "text-deep-600"
                } ${isOverdue || isNearDue ? "animate-pulse" : ""}`}
              >
                {warning.remainText}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">截止时间</div>
              <div className="font-mono text-sm text-ink-soft">
                {new Date(warning.deadline).toLocaleString("zh-CN")}
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">命中档位</div>
              <div className={`text-sm font-bold ${style.text}`}>
                {WARNING_LABELS[warning.level]}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageDetailCard({
  stage,
  stageRec,
  isCurrent,
  canAct,
  materialsOverride,
  onToggleMaterial,
  opinion,
  setOpinion,
  reviewComment,
  setReviewComment,
  onAction,
  loading,
  actingRole,
  orderStatus,
}: {
  stage: Stage;
  stageRec: StageRecord | undefined;
  isCurrent: boolean;
  canAct: boolean;
  materialsOverride: Record<number, Record<string, boolean>>;
  onToggleMaterial: (stageRecId: number, matName: string, currentProvided: boolean) => void;
  opinion: string;
  setOpinion: (v: string) => void;
  reviewComment: string;
  setReviewComment: (v: string) => void;
  onAction: (action: "submit" | "approve" | "reject") => void;
  loading: boolean;
  actingRole: Role;
  orderStatus: string;
}) {
  if (!stageRec) return null;
  const override = materialsOverride[stageRec.id] ?? {};
  const elapsedMs = Date.now() - new Date(stageRec.startedAt).getTime();
  const elapsedH = Math.floor(elapsedMs / (1000 * 60 * 60));
  const isOverTime = elapsedH > stageRec.timeLimitHours;

  const requiredMissing = stageRec.materials.filter(
    (m) => m.required && !(override[m.name] ?? m.provided),
  );

  const pendingAdds = stageRec.materials.filter(
    (m) => !m.provided && override[m.name] === true,
  );
  const pendingRemoves = stageRec.materials.filter(
    (m) => m.provided && override[m.name] === false,
  );
  const hasPendingChange = pendingAdds.length > 0 || pendingRemoves.length > 0;

  const isRegistration = stage === "registration";
  const isTerminal = orderStatus === "synced";

  return (
    <div
      className={`card p-4 ${
        isCurrent ? "ring-2 ring-deep-200 border-deep-200" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-display font-bold text-base text-ink">
          {STAGE_LABELS[stage]}
        </h3>
        <span
          className={`badge px-2 py-0.5 text-xs ${stageStatusStyle(stageRec.status)}`}
        >
          {stageStatusText(stageRec.status)}
        </span>
        <span className="ml-auto text-xs text-ink-muted font-mono">
          处理人：{stageRec.handlerName || "未指派"} · {ROLE_LABELS[stageRec.handlerRole]}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="bg-paper rounded p-3">
          <div className="text-xs font-semibold text-ink-muted mb-2">材料清单</div>
          <div className="space-y-1.5">
            {stageRec.materials.map((m) => {
              const isChecked = override[m.name] ?? m.provided;
              const missing = m.required && !isChecked;
              return (
                <div
                  key={m.name}
                  className={`flex items-center gap-2 text-sm ${
                    missing ? "text-crimson" : "text-ink-soft"
                  }`}
                >
                  {canAct ? (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleMaterial(stageRec.id, m.name, m.provided)}
                      className="w-4 h-4 accent-deep-500"
                    />
                  ) : (
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded border ${
                        isChecked
                          ? "bg-emerald-ok text-white border-emerald-ok"
                          : "border-deep-200"
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3 h-3" />}
                    </span>
                  )}
                  <span className="flex-1">
                    {m.name}
                    {m.required && (
                      <span className="text-crimson ml-1 text-xs">*必填</span>
                    )}
                  </span>
                  {missing && (
                    <span className="text-xs text-crimson font-semibold">未提供</span>
                  )}
                </div>
              );
            })}
          </div>
          {requiredMissing.length > 0 && (
            <div className="mt-2 text-xs text-crimson bg-crimson-soft/50 px-2 py-1 rounded">
              ⚠ 必填材料缺失：{requiredMissing.map((m) => m.name).join("、")}
            </div>
          )}
          {canAct && hasPendingChange && (
            <div className="mt-2 text-xs space-y-1 border-t border-deep-50 pt-2">
              <div className="font-semibold text-deep-600">待提交变更</div>
              {pendingAdds.length > 0 && (
                <div className="text-emerald-ok">
                  ＋ 补齐：{pendingAdds.map((m) => m.name).join("、")}
                </div>
              )}
              {pendingRemoves.length > 0 && (
                <div className="text-amber-warn">
                  − 撤销：{pendingRemoves.map((m) => m.name).join("、")}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-paper rounded p-3">
          <div className="text-xs font-semibold text-ink-muted mb-2">时限校验</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">时限</span>
              <span className="font-mono">{stageRec.timeLimitHours}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">已耗时</span>
              <span className={`font-mono ${isOverTime ? "text-crimson font-bold" : ""}`}>
                {elapsedH}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">状态</span>
              <span
                className={`text-xs font-bold ${
                  isOverTime ? "text-crimson" : "text-emerald-ok"
                }`}
              >
                {isOverTime ? "⚠ 已超时限" : "✓ 时限内"}
              </span>
            </div>
            {stageRec.submittedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-ink-muted">提交时间</span>
                <span className="font-mono text-ink-soft">
                  {new Date(stageRec.submittedAt).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
            {stageRec.reviewedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-ink-muted">审核时间</span>
                <span className="font-mono text-ink-soft">
                  {new Date(stageRec.reviewedAt).toLocaleString("zh-CN")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {stageRec.processingOpinion && (
        <div className="mb-3 bg-deep-50/50 rounded p-2 text-sm">
          <span className="text-xs font-semibold text-ink-muted">处理意见：</span>
          <span className="text-ink-soft">{stageRec.processingOpinion}</span>
        </div>
      )}
      {stageRec.reviewComment && (
        <div className="mb-3 bg-emerald-soft/30 rounded p-2 text-sm">
          <span className="text-xs font-semibold text-ink-muted">复核备注：</span>
          <span className="text-ink-soft">{stageRec.reviewComment}</span>
        </div>
      )}

      {canAct && !isTerminal && (
        <div className="border-t border-deep-50 pt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span className="font-semibold text-deep-600">
              当前岗位：{ROLE_LABELS[actingRole]}
            </span>
            <span>可编辑材料并执行以下操作：</span>
          </div>
          <input
            type="text"
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder={
              isRegistration
                ? "处理意见（必填，描述登记结论）"
                : stage === "verification"
                ? "处理意见（必填，描述核验结论）"
                : "处理意见（必填，描述归档结论）"
            }
            className="input-field"
          />
          {!isRegistration && (
            <input
              type="text"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="复核备注 / 退回原因（退回时必填）"
              className="input-field"
            />
          )}
          <div className="flex items-center gap-2">
            {isRegistration ? (
              <button
                onClick={() => onAction("submit")}
                disabled={loading}
                className="btn-primary"
              >
                <CheckCircle2 className="w-4 h-4" />
                提交登记
              </button>
            ) : (
              <>
                <button
                  onClick={() => onAction("approve")}
                  disabled={loading}
                  className="btn-success"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {stage === "verification" ? "核验通过" : "归档同步"}
                </button>
                <button
                  onClick={() => onAction("reject")}
                  disabled={loading}
                  className="btn-danger"
                >
                  <XCircle className="w-4 h-4" />
                  退回
                </button>
              </>
            )}
            {loading && (
              <span className="text-xs text-ink-muted animate-pulse">提交中…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function stageStatusStyle(status: string): string {
  switch (status) {
    case "pending":
      return "bg-deep-50 text-deep-600";
    case "submitted":
      return "bg-blue-50 text-blue-700";
    case "approved":
      return "bg-emerald-soft text-emerald-ok";
    case "rejected":
      return "bg-crimson-soft text-crimson";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function stageStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: "待处理",
    submitted: "已提交",
    approved: "已通过",
    rejected: "已退回",
  };
  return map[status] ?? status;
}

function RoleActionPanel({
  actingRole,
  setActingRole,
  actingUser,
  currentStage,
  canAct,
  orderStatus,
}: {
  actingRole: Role;
  setActingRole: (r: Role) => void;
  actingUser: User | undefined;
  currentStage: Stage;
  canAct: boolean;
  orderStatus: string;
}) {
  return (
    <div className="card p-4 sticky top-20">
      <h3 className="font-display font-bold text-base text-ink mb-3">
        操作岗位
      </h3>
      <div className="space-y-1.5">
        {ROLES.map((r) => {
          const isStageOwner = STAGE_ROLE[currentStage] === r;
          return (
            <button
              key={r}
              onClick={() => setActingRole(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-all ${
                actingRole === r
                  ? "bg-deep-500 text-white"
                  : "bg-paper text-ink-soft hover:bg-deep-50"
              }`}
            >
              <span className="font-semibold">{ROLE_LABELS[r]}</span>
              {isStageOwner && (
                <span
                  className={`ml-auto text-xs px-1.5 py-0.5 rounded ${
                    actingRole === r ? "bg-deep-600" : "bg-deep-100 text-deep-600"
                  }`}
                >
                  当前阶段
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-deep-50 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-ink-muted">操作人</span>
          <span className="font-semibold text-ink">
            {actingUser?.name ?? "未找到"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">可操作</span>
          <span className={`font-bold ${canAct ? "text-emerald-ok" : "text-crimson"}`}>
            {orderStatus === "synced"
              ? "工单已同步"
              : canAct
              ? "是"
              : "否（越权/非当前阶段）"}
          </span>
        </div>
      </div>
    </div>
  );
}

function AuditTimeline({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-deep-500" />
        <h3 className="font-display font-bold text-base text-ink">审计时间线</h3>
        <span className="ml-auto text-xs font-mono text-ink-muted">
          {logs.length} 条记录
        </span>
      </div>
      <div className="relative pl-4">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-deep-100" />
        <div className="space-y-3">
          {logs.map((log, i) => {
            const isReject = log.action.includes("reject");
            const isSync = log.action.includes("sync");
            const isCreate = log.action === "create";
            const hasMaterialChange =
              log.detail.includes("补齐") || log.detail.includes("撤销");
            const dotColor = isReject
              ? "bg-crimson border-crimson-soft"
              : isSync
              ? "bg-aqua border-blue-100"
              : isCreate
              ? "bg-deep-500 border-deep-100"
              : "bg-emerald-ok border-emerald-soft";
            return (
              <div
                key={log.id}
                className="relative"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div
                  className={`absolute -left-4 w-2.5 h-2.5 rounded-full border-2 ${dotColor}`}
                />
                <div className="ml-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {actionLabel(log.action)}
                    </span>
                    <span className="badge bg-deep-50 text-deep-600 text-[10px]">
                      {ROLE_LABELS[log.actorRole]}
                    </span>
                    {isReject && (
                      <span className="badge bg-crimson-soft text-crimson text-[10px]">
                        退回
                      </span>
                    )}
                    {hasMaterialChange && (
                      <span className="badge bg-emerald-soft text-emerald-ok text-[10px] flex items-center gap-0.5">
                        {log.detail.includes("撤销") ? (
                          <MinusCircle className="w-2.5 h-2.5" />
                        ) : (
                          <PlusCircle className="w-2.5 h-2.5" />
                        )}
                        材料变更
                      </span>
                    )}
                    <span className="ml-auto text-[10px] font-mono text-ink-muted">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    {renderAuditDetail(log.detail)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-ink-muted font-mono">
                    {log.actorName && <span>操作人：{log.actorName}</span>}
                    {log.fromStage && log.toStage && (
                      <span>
                        {STAGE_LABELS[log.fromStage]} → {STAGE_LABELS[log.toStage]}
                      </span>
                    )}
                    {log.fromStatus && log.toStatus && (
                      <span>
                        {STATUS_LABELS[log.fromStatus]} → {STATUS_LABELS[log.toStatus]}
                      </span>
                    )}
                    {log.versionBefore != null && log.versionAfter != null && (
                      <span className="px-1.5 py-0.5 rounded bg-deep-50 text-deep-600 font-semibold">
                        v{log.versionBefore} → v{log.versionAfter}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="text-center text-ink-muted text-sm py-4">
              暂无审计记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderAuditDetail(detail: string) {
  const segments: { text: string; cls: string }[] = [];
  const re = /(材料变更：[^；]*补齐[^；]*)|(材料变更：[^；]*撤销[^；]*)|(退回原因：[^（]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(detail)) !== null) {
    if (m.index > last) {
      segments.push({ text: detail.slice(last, m.index), cls: "text-ink-soft" });
    }
    const seg = m[0];
    if (seg.includes("补齐")) {
      segments.push({
        text: seg,
        cls: "text-emerald-ok font-semibold",
      });
    } else if (seg.includes("撤销")) {
      segments.push({
        text: seg,
        cls: "text-amber-warn font-semibold",
      });
    } else if (seg.includes("退回原因")) {
      segments.push({
        text: seg,
        cls: "text-crimson font-semibold",
      });
    }
    last = re.lastIndex;
  }
  if (last < detail.length) {
    segments.push({ text: detail.slice(last), cls: "text-ink-soft" });
  }
  return (
    <div className="text-xs leading-relaxed">
      {segments.map((seg, i) => (
        <span key={i} className={seg.cls}>
          {seg.text}
        </span>
      ))}
    </div>
  );
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: "创建工单",
    submit_registration: "提交登记",
    approve_verification: "核验通过",
    reject_verification: "核验退回",
    sync_archiving: "归档同步",
    reject_archiving: "归档退回",
    batch_approve_verification: "批量核验通过",
    batch_sync_archiving: "批量归档同步",
    batch_reject_verification: "批量核验退回",
    batch_reject_archiving: "批量归档退回",
  };
  return map[action] ?? action;
}
