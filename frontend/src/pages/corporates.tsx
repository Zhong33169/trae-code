import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch, formatDate } from "~/lib/api";

interface Corporate {
  id: string;
  company_name: string;
  credit_code: string;
  legal_representative: string;
  register_date: string;
  business_scope: string;
  created_at: string;
  updated_at: string;
}

export default function Corporates() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [corporates, setCorporates] = createSignal<Corporate[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()) {
      loadCorporates();
    }
  });

  const loadCorporates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/corporates");
      setCorporates(data || []);
    } catch (err) {
      console.error("Failed to load corporates:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div class="mb-4">
        <h1 class="text-xl font-semibold">对公资料</h1>
      </div>

      <div class="card">
        <div class="card-body p-0">
          <table class="table">
            <thead>
              <tr>
                <th>企业名称</th>
                <th>统一社会信用代码</th>
                <th>法定代表人</th>
                <th>成立日期</th>
                <th>经营范围</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <Show when={!loading() && corporates().length > 0} fallback={
                <tr><td colspan="6" class="text-center text-gray-500 py-8">
                  {loading() ? "加载中..." : "暂无数据"}
                </td></tr>
              }>
                {corporates().map((corp) => (
                  <tr>
                    <td class="font-medium">{corp.company_name}</td>
                    <td class="text-sm">{corp.credit_code}</td>
                    <td>{corp.legal_representative}</td>
                    <td class="text-sm text-gray-500">{formatDate(corp.register_date)}</td>
                    <td class="text-sm text-gray-600 max-w-xs truncate" title={corp.business_scope}>
                      {corp.business_scope}
                    </td>
                    <td class="text-sm text-gray-500">{formatDate(corp.updated_at)}</td>
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
