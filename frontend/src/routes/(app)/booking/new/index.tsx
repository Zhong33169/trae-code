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
    uploadCategory: 'booking_doc',
    uploadFile: null as File | null,
    uploadLoading: false,

    toast: '',
  });

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
      s.createdId = id;

      let uploadedCount = 0;
      if (s.attachments.length > 0) {
        for (const att of s.attachments) {
          if (att._file) {
            try {
              await bookingsApi.uploadAttachment(id, att._file, att.category);
              uploadedCount++;
            } catch (e: any) {
              console.error('附件上传失败：', att.file_name, e);
            }
          }
        }
      }

      let submitted = false;
      let submitFailReason = '';
      if (!asDraft) {
        s.toast = '订舱申请创建成功，正在提交审核...';
        try {
          await bookingsApi.submit(id, { remark: '订舱登记员创建并提交审核' });
          s.toast = uploadedCount > 0
            ? `订舱申请已创建并提交审核（同步上传 ${uploadedCount} 个附件）`
            : '订舱申请已创建并提交审核';
          submitted = true;
        } catch (submitErr: any) {
          submitFailReason = submitErr.message || '未知原因';
          s.toast = '订舱申请创建成功，但提交审核被拦截';
          submitted = false;
        }
      } else {
        s.toast = uploadedCount > 0
          ? `草稿保存成功（同步上传 ${uploadedCount} 个附件）`
          : '草稿保存成功';
      }

      setTimeout(() => {
        if (!asDraft && !submitted && submitFailReason) {
          alert(
            '订舱申请已创建（状态：草稿），但提交审核被拦截。\n\n' +
            '拦截原因：' + submitFailReason + '\n\n' +
            '附件已上传' + (uploadedCount > 0 ? `（${uploadedCount} 个）` : '（无）') + '，失败原因和操作记录已写入审计日志。\n\n' +
            '请前往详情页查看失败原因，解决问题后点击【提交审核】按钮手动重提。'
          );
        }
        nav(`/booking/${id}`);
      }, 800);
    } catch (e: any) {
      alert('操作失败：' + (e.message || '未知错误'));
    } finally {
      s.submitting = false;
    }
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('文件大小不能超过 20MB');
        input.value = '';
        return;
      }
      s.uploadFile = file;
    }
  };

  const addAttachment = () => {
    if (!s.uploadFile) {
      alert('请先选择文件');
      return;
    }
    const att: any = {
      id: Date.now(),
      file_name: s.uploadFile.name,
      file_size: s.uploadFile.size,
      category: s.uploadCategory,
      created_at: new Date().toISOString(),
      _file: s.uploadFile,
    };
    s.attachments = [...s.attachments, att];
    s.uploadFile = null;
    const input = document.getElementById('file-upload-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  const removeAttachment = (index: number) => {
    s.attachments = s.attachments.filter((_: any, i: number) => i !== index);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const categoryLabelMap: Record<string, string> = {
    booking_doc: '订舱资料',
    loading_doc: '装柜单据',
    bl_doc: '提单文件',
    certificate: '证明文件',
    other: '其他',
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
          <Button variant="default" onClick$={() => submit(true)} disabled={s.submitting}>
            保存为草稿
          </Button>
          <Button variant="primary" onClick$={() => submit(false)} disabled={s.submitting || hasErrors || s.validating}>
            {s.submitting ? '处理中...' : '创建并提交'}
            <svg class="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </Button>
        </div>
      </div>

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
                  {s.validation!.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {hasWarnings && (
                <ul class="list-disc ml-6 space-y-0.5 text-amber-700 text-sm">
                  {s.validation!.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {s.validating && <div class="text-xs text-gray-500 mt-2">校验中...</div>}
            </div>
          </div>
        </div>
      )}

      <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 class="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <span class="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          基础信息（* 为必填）
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <InputField
              label="订舱单号 *"
              value={s.form.form_no}
              onChange$={(v) => { s.form.form_no = v; scheduleValidate(); }}
              placeholder="例如：PK-2026-009"
              required
            />
            <div class="text-xs text-gray-400 mt-1">建议规则：PK + 年份 + 4位序号</div>
          </div>
          <div>
            <InputField
              label="批次号 *"
              value={s.form.batch_no}
              onChange$={(v) => { s.form.batch_no = v; scheduleValidate(); }}
              placeholder="例如：BATCH-2026-009"
              required
            />
            <div class="text-xs text-amber-600 mt-1">⚠️ 相同批次号会被判定为重复录入</div>
          </div>
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
          <div>
            <InputField
              label="办理时限"
              value={s.form.deadline}
              onChange$={(v) => (s.form.deadline = v)}
              type="datetime-local"
            />
            <div class="text-xs text-gray-400 mt-1">超时后系统自动标记异常</div>
          </div>
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
          附件上传
        </h2>
        <div class="border-2 border-dashed border-gray-200 rounded-xl p-5 bg-gray-50/50 space-y-4">
          {s.attachments.length > 0 && (
            <div class="space-y-2">
              {s.attachments.map((att: any, i: number) => (
                <div key={att.id} class="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-800">{att.file_name}</div>
                      <div class="text-xs text-gray-500">
                        {formatFileSize(att.file_size)} · {categoryLabelMap[att.category] || att.category}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick$={() => removeAttachment(i)}>
                    <svg class="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div class="flex items-end gap-3 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">选择文件</label>
              <input
                id="file-upload-input"
                type="file"
                class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 transition-colors"
                onChange$={handleFileSelect}
              />
              <div class="text-xs text-gray-400 mt-1">支持 PDF / JPG / PNG / Excel，单个文件 ≤ 20MB</div>
            </div>
            <SelectField
              label="文件类型"
              value={s.uploadCategory}
              onChange$={(v) => (s.uploadCategory = v)}
              options={[
                { value: 'booking_doc', label: '订舱资料' },
                { value: 'loading_doc', label: '装柜单据' },
                { value: 'bl_doc', label: '提单文件' },
                { value: 'certificate', label: '证明文件' },
                { value: 'other', label: '其他' },
              ]}
            />
            <Button variant="primary" size="md" onClick$={addAttachment} disabled={!s.uploadFile}>
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              添加
            </Button>
          </div>
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
            创建后可在详情页继续上传附件、流转状态
          </div>
          <div class="flex items-center gap-2">
            <Button variant="default" onClick$={() => nav('/booking')} disabled={s.submitting}>
              取消
            </Button>
            <Button variant="default" onClick$={() => submit(true)} disabled={s.submitting}>
              保存为草稿
            </Button>
            <Button
              variant="primary"
              onClick$={() => submit(false)}
              disabled={s.submitting || hasErrors || s.validating}
            >
              {s.submitting ? '处理中...' : '创建并提交'}
              <svg class="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
