import { createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "~/lib/auth";
import { apiFetch } from "~/lib/api";

interface Corporate {
  id: string;
  company_name: string;
  credit_code: string;
  legal_representative: string;
}

export default function NewForm() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [corporates, setCorporates] = createSignal<Corporate[]>([]);
  const [form, setForm] = createSignal({
    corporate_id: "",
    corporate_name: "",
    year: new Date().getFullYear(),
    business_license: "",
    annual_report: "",
    tax_certificate: "",
    other_materials: "",
  });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(() => {
    if (!isLoading() && !user()) {
      navigate("/login");
      return;
    }
    if (user()?.role !== "registrar") {
      navigate("/forms");
      return;
    }
    loadCorporates();
  });

  const loadCorporates = async () => {
    try {
      const data = await apiFetch("/api/corporates");
      setCorporates(data);
    } catch (err) {
      console.error("Failed to load corporates:", err);
    }
  };

  const handleCorporateChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    const id = target.value;
    const corp = corporates().find((c) => c.id === id);
    setForm({
      ...form(),
      corporate_id: id,
      corporate_name: corp?.company_name || "",
    });
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (!form().corporate_id) {
      setError("请选择企业");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/forms", {
        method: "POST",
        body: JSON.stringify(form()),
      });
      navigate(`/forms/${data.id}`);
    } catch (err: any) {
      setError(err.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div class="mb-4">
        <h1 class="text-xl font-semibold">新建年检单</h1>
      </div>

      <div class="card">
        <form onSubmit={handleSubmit}>
          <div class="card-body">
            <Show when={error()}>
              <div class="alert alert-error">{error()}</div>
            </Show>

            <div class="grid grid-2">
              <div class="form-group">
                <label class="form-label required">企业名称</label>
                <select
                  class="form-select"
                  value={form().corporate_id}
                  onChange={handleCorporateChange}
                  required
                >
                  <option value="">请选择企业</option>
                  {corporates().map((corp) => (
                    <option value={corp.id}>{corp.company_name}</option>
                  ))}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label required">年检年度</label>
                <input
                  type="number"
                  class="form-input"
                  value={form().year}
                  onInput={(e) => setForm({ ...form(), year: parseInt(e.target.value) || 0 })}
                  min="2000"
                  max="2100"
                  required
                />
              </div>
            </div>

            <div class="divider"></div>
            <h3 class="section-title">年检资料</h3>

            <div class="form-group">
              <label class="form-label">营业执照</label>
              <textarea
                class="form-textarea"
                value={form().business_license}
                onInput={(e) => setForm({ ...form(), business_license: e.target.value })}
                placeholder="请输入营业执照相关信息"
                rows={2}
              />
            </div>

            <div class="form-group">
              <label class="form-label">年度报告</label>
              <textarea
                class="form-textarea"
                value={form().annual_report}
                onInput={(e) => setForm({ ...form(), annual_report: e.target.value })}
                placeholder="请输入年度报告相关信息"
                rows={2}
              />
            </div>

            <div class="form-group">
              <label class="form-label">税务证明</label>
              <textarea
                class="form-textarea"
                value={form().tax_certificate}
                onInput={(e) => setForm({ ...form(), tax_certificate: e.target.value })}
                placeholder="请输入税务证明相关信息"
                rows={2}
              />
            </div>

            <div class="form-group">
              <label class="form-label">其他资料</label>
              <textarea
                class="form-textarea"
                value={form().other_materials}
                onInput={(e) => setForm({ ...form(), other_materials: e.target.value })}
                placeholder="请输入其他资料信息"
                rows={2}
              />
            </div>
          </div>

          <div class="card-footer flex justify-between">
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => navigate("/forms")}
            >
              取消
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={loading()}
            >
              {loading() ? "创建中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
