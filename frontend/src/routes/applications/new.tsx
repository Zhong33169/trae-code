import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { api } from "../lib/api";

export default function NewApp() {
  const nav = useNavigate();
  const user = () => { try { return JSON.parse(localStorage.getItem("credit_user") || "null"); } catch { return null; } };
  const [form, setForm] = createSignal({
    company_name: "", credit_line: "", applicant: "", contact_phone: "", business_type: ""
  });
  const [saving, setSaving] = createSignal(false);
  const [err, setErr] = createSignal("");

  const update = (k, v) => setForm(f => ({...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const f = form();
    if (!f.company_name) { setErr("请填写企业名称"); return; }
    if (!f.credit_line) { setErr("请填写授信额度"); return; }
    if (parseFloat(f.credit_line) <= 0) { setErr("授信额度需大于0"); return; }
    setSaving(true); setErr("");
    try {
      const r = await api.createApp({
        company_name: f.company_name, credit_line: parseFloat(f.credit_line),
        applicant: f.applicant, contact_phone: f.contact_phone, business_type: f.business_type,
      });
      if (r.ok) { nav("/applications/" + r.data.id); }
      else { setErr(r.msg || "创建失败"); }
    } catch { setErr("网络错误，请检查后端服务"); }
    setSaving(false);
  };

  if (user()?.role !== "registrar") {
    return (
      <div style="padding:40px; text-align:center">
        <div class="page-title" style="margin-bottom:20px">无权限</div>
        <div style="color:#6b7280">仅授信登记员可新建授信申请。</div>
        <button class="btn btn-primary" style="margin-top:24px" onClick={() => nav("/")}>返回工作台</button>
      </div>
    );
  }

  return (
    <div>
      <div class="page-header">
        <div>
          <button class="btn btn-default btn-sm" style="margin-right:12px" onClick={() => nav(-1)}>← 返回</button>
          <span class="page-title">新建授信申请</span>
          <div style="font-size:13px; color:#6b7280; margin-left:98px; margin-top:6px">
            创建后默认状态为「草稿」，登记员补充证据后再提交审核
          </div>
        </div>
      </div>
      <div class="page-content">
        <div class="card" style="max-width:760px; margin:0 auto">
          <form onSubmit={submit}>
            <div class="card-body">
              <div class="detail-grid">
                <div class="form-group">
                  <label class="form-label">企业名称 *</label>
                  <input class="form-input" placeholder="请输入企业全称"
                    value={form().company_name} onInput={e => update("company_name", e.target.value)} />
                </div>
                <div class="form-group">
                  <label class="form-label">业务类型</label>
                  <input class="form-input" placeholder="如：电子产品批发"
                    value={form().business_type} onInput={e => update("business_type", e.target.value)} />
                </div>
                <div class="form-group">
                  <label class="form-label">申请授信额度（元）*</label>
                  <input class="form-input" type="number" min="0" step="10000" placeholder="如：500000"
                    value={form().credit_line} onInput={e => update("credit_line", e.target.value)} />
                  <div style="font-size:11px; color:#9ca3af; margin-top:4px">
                    {form().credit_line ? ("≈ " + (parseFloat(form().credit_line)/10000).toFixed(1) + " 万元") : ""}
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">申请人</label>
                  <input class="form-input" placeholder="企业联系人"
                    value={form().applicant} onInput={e => update("applicant", e.target.value)} />
                </div>
                <div class="form-group" style={{gridColumn: "1 / -1"}}>
                  <label class="form-label">联系电话</label>
                  <input class="form-input" placeholder="联系人手机或固定电话"
                    value={form().contact_phone} onInput={e => update("contact_phone", e.target.value)} />
                </div>
              </div>

              <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 16px; margin-top:8px; font-size:13px; color:#166534; line-height:1.7">
                <strong>📌 提示：</strong><br />
                1. 申请创建后将自动分配草稿状态与 6 类证据模板：营业执照、税务登记证、法人身份证、近一年财务报表、近3个月银行流水（必填）以及主要业务合同（选填）。<br />
                2. 请在详情页中补充证据并提交给审核主管审核。
              </div>

              <div class="form-error">{err()}</div>
            </div>
            <div style="border-top:1px solid #e5e7eb; padding:16px 20px; background:#f9fafb; display:flex; justify-content:flex-end; gap:10px; border-radius:0 0 12px 12px">
              <button type="button" class="btn btn-default" onClick={() => nav(-1)} disabled={saving()}>取消</button>
              <button type="submit" class="btn btn-primary" disabled={saving()}>
                {saving() ? "创建中..." : "创建申请"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
