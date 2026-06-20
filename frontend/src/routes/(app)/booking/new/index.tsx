import { component$, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import type { ValidateResponse, Attachment } from "~/types";
import { bookingsApi } from "~/api";
import { useAuth } from "~/store/auth";
import { Button, InputField, SelectField } from "~/components/UI";

export default component$(() => {
  const auth = useAuth();
  const nav = useNavigate();

  const s = useStore<any>({
    loading: false,
    submitting: false,
    createdId: null as number | null,

    form: {
      form_no: '',
      batch_no: '',
      customer: '',
      forwarder: '',
      port_of_loading: '',
      port_of_discharge: '',
      container_type: '',
      container_qty: 1,
      cargo_desc: '',
      weight: 0,
      volume: 0,
      etd: '',
      eta: '',
      bl_no: '',
      vessel: '',
      so_no: '',
      deadline: '',
      offline_booking_status: 'draft',
      offline_loading_status: 'not_arranged',
      offline_bl_status: 'not_issued',
    },

    validation: null as ValidateResponse | null,
    validating: false,
    validateTimer: null as any,

    attachments: [] as Attachment[],
    showUpload: false,
    uploadCategory: 'booking_doc',
    uploadFile: null as File | null,
    uploadLoading: false,

    toast: '',
  });

  // 实时校验
  const scheduleValidate = () => {
    if (!s.form.form_no && !s.form.batch_no) return;
    if (s.validateTimer) clearTimeout(s.validateTimer);
    s.validateTimer = setTimeout(async () => {
      s.validating = true;
      try {
        const res = await bookingsApi.validate({
          form_no: s.form.form_no || undefined,
          batch_no: s.form.batch_no || undefined,
        });
        s.validation = res;
      } catch (e: any) {
        console.error(e);
      } finally {
        s.validating = false;
      }
    }, 400);
  };

  // 当前用户必须是 registrar 或 admin
  useVisibleTask$(() => {
    const role = auth.user?.role || '';
    if (role && role !== 'registrar' && role !== 'admin') {
      alert('只有订舱登记员（registrar）可以发起订舱申请，请切换角色后再试。');
      nav('/booking');
    }
  });

  const isFormValid = () => {
    if (!s.form.form_no.trim()) return '请填写订舱单号';
    if (!s.form.batch_no.trim()) return '请填写批次号';
    if (!s.form.customer.trim()) return '请填写客户名称';
    if (s.validation?.errors && s.validation.errors.length > 0) {
      return s.validation.errors.join('；');
    }
    return '';
  };

  const submit = async (asDraft: boolean) => {
    const err = asDraft ? (s.form.form_no ? '' : '请填写订舱单号') : isFormValid();
    if (err) {
      alert(err);
      return;
    }
    s.submitting = true;
    try {
      const payload: any = { ...s.form };
      if (!payload.customer) payload.customer = '(未填写)';
      if (!payload.forwarder) payload.forwarder = '';
      if (!payload.container_qty) payload.container_qty = 1;
      if (!payload.etd) delete payload.etd;
      if (!payload.eta) delete payload.eta;
      if (!payload.deadline) delete payload.deadline;

      const res = await bookingsApi.create(payload);
      const id = res.id;
      s.toast = asDraft ? '草稿保存成功' : '订舱申请创建成功';
      // 如果已经上传了附件，再创建后重新关联（需要后端支持，暂时提示）
      setTimeout(() => {
        nav(`/booking/${id}`);
      }, 600);
    } catch (e: any) {
      alert('创建失败：' + (e.message || '未知错误'));
    } finally {
      s.submitting = false;
    }
  };

  const hasErrors = s.validation?.errors && s.validation.errors.length > 0;
  const hasWarnings = s.validation?.warnings && s.validation.warnings.length > 0;

  return (
    <div class="space-y-5 pb-20">
      {s.toast && (
        <div class="fixed top-20 right-6 z-50 px-5 py-3 bg-green-600 text-white rounded-xl shadow-xl animate-pulse">
          ✓ {s.toast}
        </div>
      )}

      {/* 顶部操作条 */}
      <div class="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl p-6 border border-gray-100 shadow-sm flex-wrap flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <Link href="/booking" class="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-xl border border-gray-200 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            返回列表
          </Link>
          <div class="w-12 h-12 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center text-2xl">
            📝
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-900">新建订舱申请</h1>
            <p class="text-sm text-gray-500 mt-0.5">
              订舱登记员发起 — 当前角色：<span class="font-medium text-gray-900">{auth.user?.role_label || '-'}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="default" onClick$={() => nav('/booking')} disabled={s.submitting}>
            取消
          </Button>
          <Button variant="info" onClick$={() => submit(true)} disabled={s.submitting}>
            保存为草稿
          </Button>
          <Button variant="primary" onClick$={() => submit(false)} disabled={s.submitting || hasErrors || s.validating}>
            {s.submitting ? '创建中...' : '创建并提交'}
          </Button>
        </div>
      </div>

      {/* 校验提示 */}
      {(hasErrors || hasWarnings) && (
        <div class={
          'border rounded-2xl p-5 shadow-sm ' +
          (hasErrors
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
            : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200')
        }>
          <div class="flex items-start gap-4">
            <div class={
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' +
              (hasErrors ? 'bg-red-100 animate-pulse' : 'bg-amber-100')
            }>
              <svg
                class={'w-5 h-5 ' + (hasErrors ? 'text-red-600' : 'text-amber-600')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="space-y-1">
              <h3 class={'font-bold text-base ' + (hasErrors ? 'text-red-900' : 'text-amber-900')}>
                {hasErrors ? '校验不通过（系统将拦截提交）' : '存在风险提示（提交前请确认）'}
              </h3>
              {hasErrors && (
                <ul class="list-disc ml-6 space-y-0.5 text-red-700 text-sm">
                  {s.validation!.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {hasWarnings && (
                <ul class="list-disc ml-6 space-y-0.5 text-amber-700 text-sm">
                  {s.validation!.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {s.validating && <div class="text-xs text-gray-500 mt-2">校验中...</div>}
            </div>
          </div>
        </div>
      )}

      {/* 表单主体 */}
      <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 class="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <span class="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          基础信息（* 为必填）
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <InputField
            label="订舱单号 *"
            value={s.form.form_no}
            onChange$={(v) => { s.form.form_no = v; scheduleValidate(); }}
            placeholder="例如：PK-2026-009"
            required
            hint="建议规则：PK + 年份 + 4位序号"
          />
          <InputField
            label="批次号 *"
            value={s.form.batch_no}
            onChange$={(v) => { s.form.batch_no = v; scheduleValidate(); }}
            placeholder="例如：BATCH-2026-009"
            required
            hint="⚠️ 相同批次号会被判定为重复录入"
          />
          <InputField
            label="客户名称 *"
            value={s.form.customer}
            onChange$={(v) => (s.form.customer = v)}
            placeholder="例如：上海华盛进出口贸易有限公司"
            required
          />
          <InputField
            label="货代 / 船公司"
            value={s.form.forwarder}
            onChange$={(v) => (s.form.forwarder = v)}
            placeholder="例如：中远海运 / MSC / 马士基"
          />
          <InputField
            label="起运港"
            value={s.form.port_of_loading}
            onChange$={(v) => (s.form.port_of_loading = v)}
            placeholder="例如：上海 / 深圳 / 宁波"
          />
          <InputField
            label="目的港"
            value={s.form.port_of_discharge}
            onChange$={(v) => (s.form.port_of_discharge = v)}
            placeholder="例如：洛杉矶 / 汉堡 / 新加坡"
          />
          <SelectField
            label="柜型"
            value={s.form.container_type}
            onChange$={(v) => (s.form.container_type = v)}
            options={[
              { value: '20GP', label: '20GP 小柜' },
              { value: '40GP', label: '40GP 平柜' },
              { value: '40HQ', label: '40HQ 高柜' },
              { value: '45HQ', label: '45HQ 高柜' },
              { value: '20RF', label: '20RF 冷藏柜' },
              { value: '40RF', label: '40RF 冷藏柜' },
            ]}
          />
          <InputField
            label="柜量"
            value={s.form.container_qty?.toString() || '1'}
            onChange$={(v) => (s.form.container_qty = Number(v) || 1)}
            type="number"
          />
          <InputField
            label="办理时限"
            value={s.form.deadline}
            onChange$={(v) => (s.form.deadline = v)}
            type="datetime-local"
            hint="超时后系统自动标记异常"
          />
        </div>

        <h2 class="text-base font-semibold text-gray-800 mb-5 mt-8 flex items-center gap-2">
          <span class="w-1.5 h-5 bg-green-500 rounded-full"></span>
          货物与物流信息
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <InputField
            label="货物描述"
            value={s.form.cargo_desc}
            onChange$={(v) => (s.form.cargo_desc = v)}
            placeholder="例如：电子产品 - 智能手机配件"
            rows={2}
          />
          <InputField
            label="重量（吨）"
            value={s.form.weight?.toString() || '0'}
            onChange$={(v) => (s.form.weight = Number(v) || 0)}
            type="number"
          />
          <InputField
            label="体积（立方）"
            value={s.form.volume?.toString() || '0'}
            onChange$={(v) => (s.form.volume = Number(v) || 0)}
            type="number"
          />
          <InputField
            label="预计开船日（ETD）"
            value={s.form.etd}
            onChange$={(v) => (s.form.etd = v)}
            type="date"
          />
          <InputField
            label="预计到港日（ETA）"
            value={s.form.eta}
            onChange$={(v) => (s.form.eta = v)}
            type="date"
          />
          <InputField
            label="船名航次"
            value={s.form.vessel}
            onChange$={(v) => (s.form.vessel = v)}
            placeholder="例如：COSCO SHIPPING / 045E"
          />
          <InputField
            label="SO号（订舱确认后必填）"
            value={s.form.so_no}
            onChange$={(v) => (s.form.so_no = v)}
            placeholder="例如：SO-SHA-2026-xxxxx"
          />
          <InputField
            label="提单号（提单出单后填写）"
            value={s.form.bl_no}
            onChange$={(v) => (s.form.bl_no = v)}
            placeholder="例如：COSU6xxxxxx"
          />
        </div>

        <h2 class="text-base font-semibold text-gray-800 mb-5 mt-8 flex items-center gap-2">
          <span class="w-1.5 h-5 bg-purple-500 rounded-full"></span>
          离线台账初始值（可稍后再回填）
        </h2>
        <div class="p-4 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 mb-4">
          离线台账状态用于与线上系统对账。如台账已有进度，可先录入后与线上同步；若不一致会在详情页红色警报。
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <SelectField
            label="离线-订舱状态"
            value={s.form.offline_booking_status}
            onChange$={(v) => (s.form.offline_booking_status = v)}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'pending_review', label: '待审核' },
              { value: 'review_passed', label: '审核通过' },
              { value: 'booked', label: '已订舱' },
              { value: 'booking_failed', label: '订舱失败' },
              { value: 'returned', label: '已退回' },
              { value: 'correcting', label: '补正中' },
              { value: 'archived', label: '已归档' },
            ]}
          />
          <SelectField
            label="离线-装柜状态"
            value={s.form.offline_loading_status}
            onChange$={(v) => (s.form.offline_loading_status = v)}
            options={[
              { value: 'not_arranged', label: '未安排' },
              { value: 'pending_confirm', label: '待确认' },
              { value: 'confirmed', label: '已确认' },
              { value: 'loaded', label: '已装柜' },
              { value: 'load_failed', label: '装柜失败' },
            ]}
          />
          <SelectField
            label="离线-提单状态"
            value={s.form.offline_bl_status}
            onChange$={(v) => (s.form.offline_bl_status = v)}
            options={[
              { value: 'not_issued', label: '未出单' },
              { value: 'pending_collect', label: '待回收' },
              { value: 'collected', label: '已回收' },
              { value: 'archived', label: '已归档' },
            ]}
          />
        </div>

        <div class="mt-10 pt-6 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div class="text-xs text-gray-400">
            创建后可在详情页继续上传附件、提交审核、流转状态
          </div>
          <div class="flex items-center gap-2">
            <Button variant="default" onClick$={() => nav('/booking')} disabled={s.submitting}>
              取消
            </Button>
            <Button variant="info" onClick$={() => submit(true)} disabled={s.submitting}>
              保存为草稿
            </Button>
            <Button
              variant="primary"
              onClick$={() => submit(false)}
              disabled={s.submitting || hasErrors || s.validating}
            >
              {s.submitting ? '创建中...' : '创建并提交'}
              <svg class="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
