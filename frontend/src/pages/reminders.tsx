import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, formatDate } from "~/lib/api";

interface Reminder {
  id: string;
  corporate_id: string;
  year: number;
  due_date: string;
  is_sent: boolean;
  created_at: string;
  corporate_name?: string;
}

export default function Reminders() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [reminders, setReminders] = createSignal<Reminder[]>([]);
  const [corporates, setCorporates] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadData();
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [remindersData, corporatesData] = await Promise.all([
        apiFetch("/api/reminders"),
        apiFetch("/api/corporates"),
      ]);
      setCorporates(corporatesData);

      const remindersWithNames = (remindersData || []).map((r: Reminder) => {
        const corp = corporatesData.find((c: any) => c.id === r.corporate_id);
        return { ...r, corporate_name: corp?.company_name || "未知" };
      });
      setReminders(remindersWithNames);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div>
      <div class="mb-4">
        <h1 class="text-xl font-semibold">年检提醒</h1>
      </div>

      <div class="card">
        <div class="card-body p-0">
          <table class="table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>年检年度</th>
                <th>截止日期</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading() && reminders().length > 0} fallback={
                <tr><td colspan="5" class="text-center text-gray-500 py-8">
                  {loading() ? "加载中..." : "暂无数据"}
                </td></tr>
              }>
                {reminders().map((reminder) => (
                  <tr>
                    <td>{reminder.corporate_name}</td>
                    <td>{reminder.year}年</td>
                    <td>
                      <span class={isOverdue(reminder.due_date) ? "text-red-600 font-medium" : ""}>
                        {formatDate(reminder.due_date)}
                      </span>
                    </td>
                    <td>
                      <span class={`badge ${reminder.is_sent ? "badge-green" : "badge-yellow"}`}>
                        {reminder.is_sent ? "已发送" : "待发送"}
                      </span>
                      <Show when={isOverdue(reminder.due_date)}>
                        <span class="badge badge-red ml-2">已逾期</span>
                      </Show>
                    </td>
                    <td class="text-sm text-gray-500">{formatDate(reminder.created_at)}</td>
                  </tr>
                ))}
              </Show>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
