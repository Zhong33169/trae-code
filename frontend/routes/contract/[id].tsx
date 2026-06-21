import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import {
  ROLE_NAMES,
  STAGE_NAMES,
  STAGE_ORDER,
  STATUS_NAMES,
  STATUS_COLORS,
  RISK_NAMES,
  RISK_COLORS,
  USERS,
  formatDate,
  getDaysRemaining,
  ACTION_NAMES,
  REQUIRED_EVIDENCES_BY_STAGE,
  STAGES,
  STATUSES,
} from "../../lib/constants.ts";
import type {
  ContractForm,
  Evidence,
  OperationLog,
} from "../../lib/api.ts";

interface Data {
  user: { id: number; name: string; role: string };
  form: ContractForm;
}

async function fetchJson<T>(url: string, userId: number, userRole: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "X-User-Id": String(userId),
      "X-User-Role": userRole,
    },
  });
  return res.json();
}

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const userId = parseInt(url.searchParams.get("userId") || "2");
    const user = USERS.find((u) => u.id === userId) || USERS[1];
    const id = ctx.params.id;

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:8005/api";
    const form = await fetchJson<ContractForm>(
      `${apiBase}/contracts/${id}`,
      user.id,
      user.role,
    );

    return ctx.render({ user, form });
  },
};

export default function ContractDetail(props: PageProps<Data>) {
  const { user, form } = props.data;
  const daysRemaining = getDaysRemaining(form.deadline);
  const isOverdue = form.status === STATUSES.OVERDUE;
  const isUrgent = daysRemaining !== null && daysRemaining <= 1 && !isOverdue;
  const currentStageIdx = STAGE_ORDER.indexOf(form.stage as typeof STAGES[keyof typeof STAGES]);

  const canAct = form.current_handler_id === user.id && form.current_role === user.role;
  const isRegister = user.role === "REGISTER";
  const isAuditor = user.role === "AUDITOR";
  const isReviewer = user.role === "REVIEWER";

  const showSubmit = canAct && isRegister &&
    (form.status === STATUSES.DRAFT || form.status === STATUSES.NEEDS_CORRECTION);
  const showApprove = canAct && (isAuditor || isReviewer) && form.status === STATUSES.PENDING;
  const showReturn = canAct && (isAuditor || isReviewer) && form.status === STATUSES.PENDING;
  const showReject = canAct && isAuditor && form.status === STATUSES.PENDING;
  const showArchive = canAct && isReviewer && form.status === STATUSES.PENDING &&
    form.stage === STAGES.PERFORM;

  const evidencesByStage: Record<string, Evidence[]> = {};
  if (form.evidences) {
    for (const ev of form.evidences) {
      if (!evidencesByStage[ev.stage]) evidencesByStage[ev.stage] = [];
      evidencesByStage[ev.stage].push(ev);
    }
  }

  return (
    <div class="min-h-screen bg-gray-50">
      <Head>
        <title>{form.form_no} - 签约服务单详情</title>
      </Head>

      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <a
              href={`/?userId=${user.id}`}
              class="text-gray-500 hover:text-gray-700"
            >
              ← 返回列表
            </a>
            <div class="h-5 w-px bg-gray-200" />
            <h1 class="text-lg font-semibold text-gray-900">
              {form.form_no}
            </h1>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
              style={{
                backgroundColor: `${RISK_COLORS[form.risk_level as keyof typeof RISK_COLORS]}15`,
                color: RISK_COLORS[form.risk_level as keyof typeof RISK_COLORS],
              }}
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: RISK_COLORS[form.risk_level as keyof typeof RISK_COLORS],
                }}
              />
              {RISK_NAMES[form.risk_level as keyof typeof RISK_NAMES]}
            </span>
            <span
              class="inline-block px-2 py-0.5 text-xs font-medium rounded"
              style={{
                backgroundColor: `${
                  STATUS_COLORS[form.status as keyof typeof STATUS_COLORS]
                }15`,
                color: STATUS_COLORS[form.status as keyof typeof STATUS_COLORS],
              }}
            >
              {STATUS_NAMES[form.status as keyof typeof STATUS_NAMES]}
            </span>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right text-sm">
              <span class="text-gray-500">当前角色：</span>
              <span class="font-medium text-gray-900">
                {user.name} · {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}
              </span>
            </div>
            <div class="flex gap-1">
              {USERS.map((u) => (
                <a
                  key={u.id}
                  href={`/contract/${form.id}?userId=${u.id}`}
                  class={`px-3 py-1 text-sm rounded-md transition-colors ${
                    u.id === user.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {u.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-6xl mx-auto px-4 py-6">
        <div class="flex gap-6">
          <div class="flex-1 space-y-6">
            <StageTimeline currentStage={form.stage} currentStatus={form.status} />

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100">
                <h2 class="text-base font-semibold text-gray-900">基本信息</h2>
              </div>
              <div class="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoItem label="居民姓名" value={form.resident_name} />
                <InfoItem label="身份证号" value={form.id_card} />
                <InfoItem label="联系电话" value={form.phone} />
                <InfoItem label="居住地址" value={form.address} />
                <InfoItem label="家庭医生" value={form.doctor_name} />
                <InfoItem label="服务团队" value={form.team_name} />
                <InfoItem
                  label="风险等级"
                  value={RISK_NAMES[form.risk_level as keyof typeof RISK_NAMES]}
                  valueStyle={{
                    color: RISK_COLORS[form.risk_level as keyof typeof RISK_COLORS],
                    fontWeight: 500,
                  }}
                />
                <InfoItem
                  label="处理时限"
                  value={form.deadline
                    ? `${formatDate(form.deadline)} (${
                      isOverdue
                        ? `已逾期 ${Math.abs(daysRemaining || 0)} 天`
                        : daysRemaining !== null
                        ? `剩 ${daysRemaining} 天`
                        : ""
                    })`
                    : "-"}
                  valueStyle={{
                    color: isOverdue
                      ? "#dc2626"
                      : isUrgent
                      ? "#f97316"
                      : "#111827",
                  }}
                />
                <InfoItem
                  label="当前处理人"
                  value={form.current_role
                    ? `${form.last_handler_name || ""} · ${
                      ROLE_NAMES[form.current_role as keyof typeof ROLE_NAMES]
                    }`
                    : "无"}
                />
                <InfoItem label="版本号" value={`v${form.version}`} />
                <InfoItem label="创建时间" value={formatDate(form.created_at)} />
                <InfoItem label="更新时间" value={formatDate(form.updated_at)} />
              </div>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100">
                <h2 class="text-base font-semibold text-gray-900">服务内容</h2>
              </div>
              <div class="divide-y divide-gray-100">
                <StageContentBlock
                  stage={STAGES.SIGN}
                  isActive={form.stage === STAGES.SIGN}
                  isPast={currentStageIdx > 0}
                  title="家庭医生签约"
                  content={form.sign_content}
                  required={REQUIRED_EVIDENCES_BY_STAGE.SIGN}
                  evidences={evidencesByStage.SIGN || []}
                  canAdd={isRegister && form.stage === STAGES.SIGN && canAct}
                  formId={form.id}
                />
                <StageContentBlock
                  stage={STAGES.PLAN}
                  isActive={form.stage === STAGES.PLAN}
                  isPast={currentStageIdx > 1}
                  title="服务计划"
                  content={form.plan_content}
                  required={REQUIRED_EVIDENCES_BY_STAGE.PLAN}
                  evidences={evidencesByStage.PLAN || []}
                  canAdd={isRegister && form.stage === STAGES.PLAN && canAct}
                  formId={form.id}
                />
                <StageContentBlock
                  stage={STAGES.PERFORM}
                  isActive={form.stage === STAGES.PERFORM}
                  isPast={false}
                  title="履约确认"
                  content={form.perform_content}
                  required={REQUIRED_EVIDENCES_BY_STAGE.PERFORM}
                  evidences={evidencesByStage.PERFORM || []}
                  canAdd={isRegister && form.stage === STAGES.PERFORM && canAct}
                  formId={form.id}
                />
              </div>
            </div>

            {form.last_opinion && (
              <div class="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-blue-600 font-medium">
                    {form.last_handler_name}
                  </span>
                  <span class="text-blue-400 text-sm">·</span>
                  <span class="text-blue-400 text-sm">
                    {form.last_result}
                  </span>
                </div>
                <p class="text-blue-800">{form.last_opinion}</p>
              </div>
            )}
          </div>

          <div class="w-80 space-y-6 flex-shrink-0">
            {canAct && (
              <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 class="text-sm font-semibold text-gray-900 mb-4">办理操作</h3>

                <div class="space-y-3">
                  {showSubmit && (
                    <ActionButton
                      primary
                      label="提交审核"
                      description="提交给下一环节处理"
                      formId={form.id}
                      action="submit"
                      version={form.version}
                    />
                  )}
                  {showApprove && (
                    <ActionButton
                      primary
                      label="审核通过"
                      description={isReviewer && form.stage === STAGES.PERFORM
                        ? "复核通过并归档"
                        : "通过审核，进入下一阶段"}
                      formId={form.id}
                      action="approve"
                      version={form.version}
                    />
                  )}
                  {showReturn && (
                    <ActionButton
                      warning
                      label="退回补正"
                      description="退回给登记员补充材料"
                      formId={form.id}
                      action="return-correction"
                      version={form.version}
                    />
                  )}
                  {showReject && (
                    <ActionButton
                      danger
                      label="不予通过"
                      description="驳回申请，终止流程"
                      formId={form.id}
                      action="reject"
                      version={form.version}
                    />
                  )}
                  {showArchive && (
                    <ActionButton
                      success
                      label="复核归档"
                      description="完成履约确认，归档结案"
                      formId={form.id}
                      action="archive"
                      version={form.version}
                    />
                  )}
                  {!canAct ||
                    (!showSubmit && !showApprove && !showReturn && !showReject && !showArchive && (
                      <p class="text-sm text-gray-400 text-center py-4">
                        当前状态无可用操作
                      </p>
                    ))}
                </div>
              </div>
            )}

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100">
                <h3 class="text-sm font-semibold text-gray-900">操作记录</h3>
              </div>
              <div class="max-h-96 overflow-y-auto">
                {(form.logs || []).length === 0
                  ? (
                    <div class="px-5 py-8 text-center text-sm text-gray-400">
                      暂无操作记录
                    </div>
                  )
                  : (
                    <div class="divide-y divide-gray-50">
                      {(form.logs || []).map((log) => (
                        <LogItem key={log.id} log={log} />
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoItem(
  { label, value, valueStyle }: {
    label: string;
    value: string | null | undefined;
    valueStyle?: React.CSSProperties;
  },
) {
  return (
    <div>
      <p class="text-sm text-gray-500 mb-1">{label}</p>
      <p class="text-gray-900" style={valueStyle}>
        {value || "-"}
      </p>
    </div>
  );
}

function StageTimeline({ currentStage, currentStatus }: {
  currentStage: string;
  currentStatus: string;
}) {
  const currentIdx = STAGE_ORDER.indexOf(
    currentStage as typeof STAGES[keyof typeof STAGES],
  );

  return (
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div class="flex items-center justify-between">
        {STAGE_ORDER.map((stage, idx) => {
          const isActive = idx === currentIdx;
          const isPast = idx < currentIdx;
          const stageName = STAGE_NAMES[stage as keyof typeof STAGE_NAMES];

          return (
            <div key={stage} class="flex-1 flex flex-col items-center relative">
              {idx < STAGE_ORDER.length - 1 && (
                <div
                  class={`absolute top-4 left-1/2 w-full h-0.5 ${
                    isPast ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
              <div
                class={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : isPast
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {isPast ? "✓" : idx + 1}
              </div>
              <p
                class={`mt-2 text-sm font-medium ${
                  isActive ? "text-blue-600" : isPast ? "text-green-600" : "text-gray-400"
                }`}
              >
                {stageName}
              </p>
              {isActive && (
                <p class="text-xs text-gray-500 mt-0.5">
                  {STATUS_NAMES[currentStatus as keyof typeof STATUS_NAMES]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageContentBlock(
  { stage, isActive, isPast, title, content, required, evidences, canAdd, formId }: {
    stage: string;
    isActive: boolean;
    isPast: boolean;
    title: string;
    content: string | null;
    required: string[];
    evidences: Evidence[];
    canAdd: boolean;
    formId: number;
  },
) {
  return (
    <div
      class={`px-6 py-4 ${isActive ? "bg-blue-50/30" : ""}`}
    >
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div
            class={`w-2 h-2 rounded-full ${
              isActive ? "bg-blue-500" : isPast ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <h3 class="font-medium text-gray-900">{title}</h3>
          {isActive && (
            <span class="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
              当前阶段
            </span>
          )}
        </div>
      </div>

      <div class="pl-4 space-y-3">
        <div>
          <p class="text-xs text-gray-500 mb-1">内容描述</p>
          <p class="text-sm text-gray-700 whitespace-pre-wrap">
            {content || "（暂无内容）"}
          </p>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs text-gray-500">
              证据材料
              <span class="text-gray-400 ml-1">
                ({evidences.filter((e) => e.is_required).length}/{required.length} 必需)
              </span>
            </p>
          </div>
          {evidences.length === 0
            ? (
              <p class="text-sm text-gray-400">暂无证据材料</p>
            )
            : (
              <div class="space-y-1.5">
                {evidences.map((ev) => (
                  <div
                    key={ev.id}
                    class="flex items-center gap-2 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <span class="text-gray-400">📄</span>
                    <span class="text-gray-700 flex-1">{ev.name}</span>
                    {ev.is_required
                      ? (
                        <span class="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                          必需
                        </span>
                      )
                      : (
                        <span class="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                          补充
                        </span>
                      )}
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function ActionButton(
  { primary, warning, danger, success, label, description, formId, action, version }: {
    primary?: boolean;
    warning?: boolean;
    danger?: boolean;
    success?: boolean;
    label: string;
    description: string;
    formId: number;
    action: string;
    version: number;
  },
) {
  const colorClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    warning: "bg-orange-500 hover:bg-orange-600 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
  };

  const color = primary
    ? "primary"
    : warning
    ? "warning"
    : danger
    ? "danger"
    : success
    ? "success"
    : "primary";

  const handleClick = () => {
    const opinion = window.prompt("请输入办理意见：");
    if (opinion === null) return;

    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId") || "2";
    const user = {
      id: parseInt(userId),
      role: "",
    };

    const actionMap: Record<string, string> = {
      "submit": "submit",
      "approve": "approve",
      "return-correction": "return-correction",
      "reject": "reject",
      "archive": "archive",
    };

    const endpoint = actionMap[action];
    if (!endpoint) return;

    const apiBase = window.API_BASE_URL || "http://localhost:8005/api";
    fetch(`${apiBase}/contracts/${formId}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": String(userId),
      },
      body: JSON.stringify({ opinion, version }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e) => Promise.reject(e));
        return res.json();
      })
      .then(() => {
        window.location.reload();
      })
      .catch((err) => {
        alert("操作失败：" + (err.error || err.message || "未知错误"));
      });
  };

  return (
    <button
      onclick={handleClick}
      class={`w-full px-4 py-3 rounded-lg text-left transition-colors ${colorClasses[color]}`}
    >
      <p class="font-medium">{label}</p>
      <p class="text-sm opacity-80">{description}</p>
    </button>
  );
}

function LogItem({ log }: { log: OperationLog }) {
  return (
    <div class="px-5 py-3">
      <div class="flex items-center gap-2 text-sm">
        <span class="font-medium text-gray-900">
          {log.operator_name || "系统"}
        </span>
        <span class="text-gray-400 text-xs">
          {log.operator_role || ""}
        </span>
      </div>
      <p class="text-sm text-gray-700 mt-1">
        {ACTION_NAMES[log.action as keyof typeof ACTION_NAMES] || log.action}
        {log.from_status && log.to_status && log.from_status !== log.to_status && (
          <span class="text-gray-400">
            ：{STATUS_NAMES[log.from_status as keyof typeof STATUS_NAMES] || log.from_status}
            {" → "}
            {STATUS_NAMES[log.to_status as keyof typeof STATUS_NAMES] || log.to_status}
          </span>
        )}
      </p>
      {log.opinion && (
        <p class="text-sm text-gray-500 mt-1 bg-gray-50 px-2 py-1 rounded">
          意见：{log.opinion}
        </p>
      )}
      {log.result && !log.opinion && (
        <p class="text-xs text-gray-400 mt-0.5">{log.result}</p>
      )}
      <p class="text-xs text-gray-400 mt-1">{formatDate(log.created_at)}</p>
    </div>
  );
}
