import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import {
  ROLE_NAMES,
  STAGE_NAMES,
  STATUS_NAMES,
  STATUS_COLORS,
  RISK_NAMES,
  RISK_COLORS,
  USERS,
  formatDate,
  getDaysRemaining,
  STAGES,
} from "../lib/constants.ts";
import { API_BASE_URL } from "../lib/constants.ts";
import type {
  ContractForm,
  ListResponse,
  StatsResponse,
} from "../lib/api.ts";

interface Data {
  user: { id: number; name: string; role: string };
  stats: StatsResponse;
  contracts: ListResponse;
  activeStage?: string;
  activeStatus?: string;
  activeRisk?: string;
  keyword?: string;
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
    const activeStage = url.searchParams.get("stage") || "";
    const activeStatus = url.searchParams.get("status") || "";
    const activeRisk = url.searchParams.get("riskLevel") || "";
    const keyword = url.searchParams.get("keyword") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");

    const apiBase = Deno.env.get("API_BASE_URL") || "http://localhost:8005/api";

    const [stats, contracts] = await Promise.all([
      fetchJson<StatsResponse>(`${apiBase}/contracts/stats?role=${user.role}`, user.id, user.role),
      fetchJson<ListResponse>(
        `${apiBase}/contracts?role=${user.role}&page=${page}&pageSize=${pageSize}` +
          (activeStage ? `&stage=${activeStage}` : "") +
          (activeStatus ? `&status=${activeStatus}` : "") +
          (activeRisk ? `&riskLevel=${activeRisk}` : "") +
          (keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""),
        user.id,
        user.role,
      ),
    ]);

    return ctx.render({
      user,
      stats,
      contracts,
      activeStage,
      activeStatus,
      activeRisk,
      keyword,
    });
  },
};

export default function Home(props: PageProps<Data>) {
  const { user, stats, contracts, activeStage, activeStatus, activeRisk, keyword } = props.data;
  const currentPage = contracts.page;
  const totalPages = Math.ceil(contracts.total / contracts.pageSize);

  return (
    <div class="min-h-screen bg-gray-50">
      <Head>
        <title>签约服务单 - {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}</title>
      </Head>

      <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold">签</span>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">签约服务单管理系统</h1>
              <p class="text-sm text-gray-500">社区卫生服务中心 · 家庭医生签约服务</p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="text-sm text-gray-500">当前角色</p>
              <p class="font-medium text-gray-900">
                {user.name} · {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}
              </p>
            </div>
            <div class="flex gap-1">
              {USERS.map((u) => (
                <a
                  key={u.id}
                  href={`/?userId=${u.id}`}
                  class={`px-3 py-1.5 text-sm rounded-md transition-colors ${
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

      <main class="max-w-7xl mx-auto px-4 py-6">
        <div class="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            title="待办总数"
            value={stats.pending}
            color="blue"
            subtitle={`共 ${stats.total} 条记录`}
          />
          <StatCard
            title="高风险"
            value={stats.highRisk}
            color="red"
            subtitle="需优先处理"
          />
          <StatCard
            title="已逾期"
            value={stats.overdue}
            color="orange"
            subtitle="超时未处理"
          />
          <StatCard
            title="已归档"
            value={stats.byStatus.ARCHIVED || 0}
            color="green"
            subtitle="完成归档"
          />
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div class="px-6 py-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-semibold text-gray-900">签约服务单队列</h2>
                {user.role === "REGISTER" && (
                  <button
                    class="ml-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    onclick="alert('创建功能请在详情页操作')"
                  >
                    + 新建签约单
                  </button>
                )}
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="搜索单据号/居民姓名"
                  value={keyword || ""}
                  class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onkeydown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value;
                      window.location.search =
                        `?userId=${user.id}&keyword=${encodeURIComponent(val)}`;
                    }
                  }}
                />
              </div>
            </div>

            <div class="flex items-center gap-4 mt-4">
              <div class="flex items-center gap-1">
                <span class="text-sm text-gray-500 mr-2">阶段：</span>
                <FilterTab
                  active={!activeStage}
                  href={`/?userId=${user.id}` +
                    (activeStatus ? `&status=${activeStatus}` : "") +
                    (activeRisk ? `&riskLevel=${activeRisk}` : "") +
                    (keyword ? `&keyword=${encodeURIComponent(keyword)}` : "")}
                >
                  全部
                </FilterTab>
                {Object.entries(STAGE_NAMES).map(([key, name]) => (
                  <FilterTab
                    key={key}
                    active={activeStage === key}
                    href={`/?userId=${user.id}&stage=${key}` +
                      (activeStatus ? `&status=${activeStatus}` : "") +
                      (activeRisk ? `&riskLevel=${activeRisk}` : "") +
                      (keyword ? `&keyword=${encodeURIComponent(keyword)}` : "")}
                  >
                    {name}
                    <span class="ml-1 text-xs text-gray-400">
                      ({stats.byStage[key] || 0})
                    </span>
                  </FilterTab>
                ))}
              </div>

              <div class="flex items-center gap-1 ml-4">
                <span class="text-sm text-gray-500 mr-2">风险：</span>
                <FilterTab
                  small
                  active={!activeRisk}
                  href={`/?userId=${user.id}` +
                    (activeStage ? `&stage=${activeStage}` : "") +
                    (activeStatus ? `&status=${activeStatus}` : "") +
                    (keyword ? `&keyword=${encodeURIComponent(keyword)}` : "")}
                >
                  全部
                </FilterTab>
                {Object.entries(RISK_NAMES).map(([key, name]) => (
                  <FilterTab
                    key={key}
                    small
                    active={activeRisk === key}
                    href={`/?userId=${user.id}&riskLevel=${key}` +
                      (activeStage ? `&stage=${activeStage}` : "") +
                      (activeStatus ? `&status=${activeStatus}` : "") +
                      (keyword ? `&keyword=${encodeURIComponent(keyword)}` : "")}
                  >
                    <span
                      class="inline-block w-2 h-2 rounded-full mr-1"
                      style={{ backgroundColor: RISK_COLORS[key as keyof typeof RISK_COLORS] }}
                    />
                    {name}
                  </FilterTab>
                ))}
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-100">
            {contracts.list.length === 0 ? (
              <div class="py-12 text-center text-gray-400">
                暂无签约服务单
              </div>
            ) : (
              contracts.list.map((form) => (
                <ContractRow
                  key={form.id}
                  form={form}
                  userId={user.id}
                />
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span class="text-sm text-gray-500">
                共 {contracts.total} 条，第 {currentPage} / {totalPages} 页
              </span>
              <div class="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <a
                      key={page}
                      href={`/?userId=${user.id}&page=${page}` +
                        (activeStage ? `&stage=${activeStage}` : "") +
                        (activeStatus ? `&status=${activeStatus}` : "") +
                        (activeRisk ? `&riskLevel=${activeRisk}` : "") +
                        (keyword ? `&keyword=${encodeURIComponent(keyword)}` : "")}
                      class={`px-3 py-1 text-sm rounded ${
                        page === currentPage
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {page}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard(
  { title, value, color, subtitle }: {
    title: string;
    value: number;
    color: "blue" | "red" | "green" | "orange";
    subtitle: string;
  },
) {
  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    red: "text-red-600 bg-red-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
  };

  return (
    <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p class="text-sm text-gray-500 mb-1">{title}</p>
      <p class={`text-2xl font-bold ${colorClasses[color].split(" ")[0]}`}>
        {value}
      </p>
      <p class="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function FilterTab(
  { active, href, children, small }: {
    active: boolean;
    href: string;
    children: React.ReactNode;
    small?: boolean;
  },
) {
  return (
    <a
      href={href}
      class={`${small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} rounded-md transition-colors ${
        active
          ? "bg-blue-100 text-blue-700 font-medium"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </a>
  );
}

function ContractRow({ form, userId }: { form: ContractForm; userId: number }) {
  const daysRemaining = getDaysRemaining(form.deadline);
  const isUrgent = daysRemaining !== null && daysRemaining <= 1;
  const isOverdue = form.status === "OVERDUE";

  return (
    <a
      href={`/contract/${form.id}?userId=${userId}`}
      class="block px-6 py-4 hover:bg-gray-50 transition-colors"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-start gap-4 flex-1">
          <div
            class={`w-1 h-14 rounded-full ${
              form.risk_level === "HIGH"
                ? "bg-red-500"
                : form.risk_level === "MEDIUM"
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
          />

          <div class="flex-1">
            <div class="flex items-center gap-3 mb-1">
              <span class="font-medium text-gray-900">{form.form_no}</span>
              <span class="text-gray-400">·</span>
              <span class="text-gray-700">{form.resident_name}</span>
              <RiskBadge level={form.risk_level} />
              <StatusBadge status={form.status} />
            </div>
            <div class="flex items-center gap-4 text-sm text-gray-500">
              <span>
                {STAGE_NAMES[form.stage as keyof typeof STAGE_NAMES]}
              </span>
              <span>·</span>
              <span>{form.doctor_name || "未分配医生"}</span>
              <span>·</span>
              <span>{form.team_name || "未分配团队"}</span>
              <span>·</span>
              <span class="flex items-center gap-1">
                证据 {form.evidence_submitted}/{form.evidence_required}
              </span>
            </div>
            {form.last_opinion && (
              <div class="mt-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg inline-block">
                <span class="text-gray-400">{form.last_handler_name}：</span>
                {form.last_result} - {form.last_opinion}
              </div>
            )}
          </div>
        </div>

        <div class="text-right ml-6">
          <div
            class={`text-sm font-medium ${
              isOverdue ? "text-red-600" : isUrgent ? "text-orange-600" : "text-gray-600"
            }`}
          >
            {isOverdue
              ? `已逾期 ${Math.abs(daysRemaining || 0)} 天`
              : daysRemaining !== null
              ? `剩 ${daysRemaining} 天`
              : "无限期"}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            优先级 {form.priority_score}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {formatDate(form.updated_at)}
          </div>
        </div>
      </div>
    </a>
  );
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
      style={{
        backgroundColor: `${RISK_COLORS[level as keyof typeof RISK_COLORS]}15`,
        color: RISK_COLORS[level as keyof typeof RISK_COLORS],
      }}
    >
      <span
        class="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: RISK_COLORS[level as keyof typeof RISK_COLORS] }}
      />
      {RISK_NAMES[level as keyof typeof RISK_NAMES]}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#6b7280";
  return (
    <span
      class="inline-block px-2 py-0.5 text-xs font-medium rounded"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {STATUS_NAMES[status as keyof typeof STATUS_NAMES]}
    </span>
  );
}
