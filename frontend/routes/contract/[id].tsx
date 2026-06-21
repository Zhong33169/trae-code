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
import ContentEditor from "../../islands/ContentEditor.tsx";
import EvidenceManager from "../../islands/EvidenceManager.tsx";
import ActionPanel from "../../islands/ActionPanel.tsx";

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
                {STAGE_ORDER.map((stage, idx) => {
                  const isActive = form.stage === stage;
                  const isPast = idx < currentStageIdx;
                  const title = STAGE_NAMES[stage as keyof typeof STAGE_NAMES];
                  const required = REQUIRED_EVIDENCES_BY_STAGE[stage as keyof typeof REQUIRED_EVIDENCES_BY_STAGE];
                  const evidences = evidencesByStage[stage] || [];

                  return (
                    <div
                      key={stage}
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
                        <ContentEditor
                          form={form}
                          stage={stage}
                          userId={user.id}
                          userRole={user.role}
                        />
                        <EvidenceManager
                          form={form}
                          stage={stage}
                          evidences={evidences}
                          userId={user.id}
                          userRole={user.role}
                        />
                      </div>
                    </div>
                  );
                })}
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
            <ActionPanel form={form} userId={user.id} userRole={user.role} />

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
