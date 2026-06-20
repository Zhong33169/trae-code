import { component$, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useNavigate, routeLoader$ } from "@builder.io/qwik-city";
import type {
  Booking,
  ModuleType,
  OperationLog,
  AuditLog,
  Attachment,
  OfflineRecord,
  ValidateResponse,
} from "~/types";
import { bookingsApi } from "~/api";
import { useAuth } from "~/store/auth";
import { StatusBadge, getStatusColor } from "~/components/StatusBadge";
import { Button, InputField, SelectField, Modal, EmptyState } from "~/components/UI";

export interface BookingDetailProps {
  module: ModuleType;
  id: number;
}

type TabKey = 'basic' | 'attachments' | 'operations' | 'audit' | 'offline';
type ActionKey =
  | 'submit'
  | 'review-pass'
  | 'review-reject'
  | 'book-confirm'
  | 'book-fail'
  | 'correct'
  | 'resubmit'
  | 'review-archive'
  | 'loading-arrange'
  | 'loading-confirm'
  | 'loading-fail'
  | 'bl-issue'
  | 'bl-collect'
  | 'offline-fill'
  | 'audit-note'
  | 'edit';

const moduleBackPath: Record<ModuleType, string> = {
  booking: '/booking',
  loading: '/loading',
  bl: '/bl',
};

const tabDefs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'basic', label: '基本信息', icon: '📝' },
  { key: 'attachments', label: '附件资料', icon: '📎' },
  { key: 'operations', label: '操作记录', icon: '📜' },
  { key: 'audit', label: '审计日志', icon: '🔍' },
  { key: 'offline', label: '离线台账', icon: '📊' },
];

export const BookingDetail = component$<BookingDetailProps>(({ module, id }) => {
  const auth = useAuth();
  const nav = useNavigate();
  const backPath = moduleBackPath[module];

  const s = useStore<any>({
    booking: null as Booking | null,
    loading: true,
    tab: 'basic' as TabKey,

    operations: [] as OperationLog[],
    audits: [] as AuditLog[],
    attachments: [] as Attachment[],
    offlineRecords: [] as OfflineRecord[],

    validation: null as ValidateResponse | null,

    // 模态框
    showActionModal: false,
    actionType: '' as ActionKey | '',
    formRemark: '',
    formFailReason: '',
    formResultNote: '',

    // 编辑
    showEditModal: false,
    editForm: {} as Record<string, any>,

    // 上传
    showUploadModal: false,
    uploadCategory: 'booking_doc',
    uploadFile: null as File | null,
    uploadLoading: false,

    // 离线回填
    showOfflineModal: false,
    offlineField: 'offline_booking_status',
    offlineValue: '',
    offlineSource: '',
    offlineRemark: '',

    // 审计备注
    showAuditNoteModal: false,
    auditNoteRemark: '',

    executing: false,
    toast: '' as string,
  });

  const fetchAll = async () => {
    s.loading = true;
    try {
      const [booking, ops, audits, atts, offs, val] = await Promise.all([
        bookingsApi.get(id),
        bookingsApi.operationLogs(id),
        bookingsApi.auditLogs(id),
        bookingsApi.attachments(id),
        bookingsApi.offlineRecords(id),
        bookingsApi.validate({ form_no: (s.booking as any)?.form_no, batch_no: (s.booking as any)?.batch_no, exclude_id: id }).catch(() => ({ valid: true, errors: [], warnings: [] })),
      ]);
      s.booking = booking as Booking;
      s.operations = (ops as any[]) || [];
      s.audits = (audits as any[]) || [];
      s.attachments = (atts as any[]) || [];
      s.offlineRecords = (offs as any[]) || [];

      // 重新校验（需要 booking 的 form_no 和 batch_no）
      try {
        const val2: any = await bookingsApi.validate({
          form_no: (booking as Booking).form_no,
          batch_no: (booking as Booking).batch_no,
          exclude_id: id,
        });
        s.validation = val2;
      } catch {
        s.validation = { valid: true, errors: [], warnings: [] };
      }
    } catch (e: any) {
      console.error('fetch detail error:', e);
    } finally {
      s.loading = false;
    }
  };

  useVisibleTask$(() => {
    fetchAll();
  });

  const role = auth.user?.role || '';
  const can = (actionRole: string[]) => actionRole.includes(role);

  // 操作按钮配置：UI 仅决定显示，权限实际由后端 ROLE_PERMISSIONS 强制校验（越权返回403）
  // roles: 哪些角色可见此按钮
  // condition: 当前状态下是否可执行（空则默认显示，仍由后端二次校验）
  const actions: Array<{
    key: ActionKey;
    label: string;
    variant: 'primary' | 'success' | 'warning' | 'danger' | 'default' | 'info';
    roles: string[];
    needFailReason?: boolean;
    isDanger?: boolean;
    condition?: (b: Booking) => boolean;
  }> = [
    {
      key: 'edit', label: '编辑基本信息', variant: 'default',
      roles: ['registrar', 'supervisor', 'admin'],
      condition: (b: Booking) => ['draft', 'correcting', 'returned', 'booking_failed'].includes(b.booking_status),
    },
    {
      key: 'submit', label: '提交审核', variant: 'primary',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => ['draft', 'correcting'].includes(b.booking_status),
    },
    {
      key: 'resubmit', label: '补正后重新提交', variant: 'primary',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => b.booking_status === 'correcting',
    },
    {
      key: 'correct', label: '开始补正资料', variant: 'info',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => ['returned', 'booking_failed'].includes(b.booking_status),
    },
    {
      key: 'review-pass', label: '审核通过', variant: 'success',
      roles: ['supervisor', 'admin'],
      condition: (b: Booking) => b.booking_status === 'pending_review',
    },
    {
      key: 'review-reject', label: '审核退回', variant: 'danger',
      roles: ['supervisor', 'admin'],
      needFailReason: true,
      condition: (b: Booking) => b.booking_status === 'pending_review',
    },
    {
      key: 'book-confirm', label: '订舱确认（SO已下）', variant: 'success',
      roles: ['supervisor', 'admin'],
      condition: (b: Booking) => b.booking_status === 'review_passed',
    },
    {
      key: 'book-fail', label: '标为订舱失败', variant: 'danger',
      roles: ['supervisor', 'admin'],
      needFailReason: true,
      condition: (b: Booking) => b.booking_status === 'review_passed',
    },
    {
      key: 'loading-arrange', label: '安排装柜', variant: 'primary',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => b.loading_status === 'not_arranged',
    },
    {
      key: 'loading-confirm', label: '装柜确认/完成装柜', variant: 'success',
      roles: ['supervisor', 'admin'],
      condition: (b: Booking) => ['pending_confirm', 'confirmed'].includes(b.loading_status),
    },
    {
      key: 'loading-fail', label: '装柜失败', variant: 'danger',
      roles: ['supervisor', 'admin'],
      needFailReason: true,
      condition: (b: Booking) => ['pending_confirm', 'confirmed'].includes(b.loading_status),
    },
    {
      key: 'bl-issue', label: '提单出单', variant: 'primary',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => b.bl_status === 'not_issued',
    },
    {
      key: 'bl-collect', label: '提单回收', variant: 'success',
      roles: ['registrar', 'admin'],
      condition: (b: Booking) => b.bl_status === 'pending_collect',
    },
    {
      key: 'review-archive', label: '复核归档', variant: 'success',
      roles: ['reviewer', 'admin'],
      condition: (b: Booking) => b.booking_status === 'booked' && b.bl_status === 'collected',
    },
    {
      key: 'audit-note', label: '添加审计备注', variant: 'warning',
      roles: ['registrar', 'supervisor', 'reviewer', 'admin'],
    },
    {
      key: 'offline-fill', label: '离线台账回填', variant: 'default',
      roles: ['registrar', 'supervisor', 'reviewer', 'admin'],
    },
  ];

  const openAction = (key: ActionKey) => {
    s.actionType = key;
    s.formRemark = '';
    s.formFailReason = '';
    s.formResultNote = '';
    if (key === 'edit') {
      s.editForm = { ...(s.booking || {}) };
      s.showEditModal = true;
    } else if (key === 'audit-note') {
      s.auditNoteRemark = '';
      s.showAuditNoteModal = true;
    } else if (key === 'offline-fill') {
      s.offlineField = 'offline_booking_status';
      s.offlineValue = '';
      s.offlineSource = '';
      s.offlineRemark = '';
      s.showOfflineModal = true;
    } else {
      s.showActionModal = true;
    }
  };

  const executeAction = async () => {
    s.executing = true;
    try {
      const a = s.actionType;
      const payload: any = {};
      if (s.formRemark) payload.remark = s.formRemark;
      if (s.formResultNote) payload.result_note = s.formResultNote;

      let res: any;
      if (a === 'submit') res = await bookingsApi.submit(id, payload);
      else if (a === 'review-pass') res = await bookingsApi.reviewPass(id, payload);
      else if (a === 'review-reject') {
        if (!s.formFailReason) { alert('请填写退回原因'); s.executing = false; return; }
        res = await bookingsApi.reviewReject(id, { fail_reason: s.formFailReason, ...payload });
      }
      else if (a === 'book-confirm') res = await bookingsApi.bookConfirm(id, payload);
      else if (a === 'book-fail') {
        if (!s.formFailReason) { alert('请填写失败原因'); s.executing = false; return; }
        res = await bookingsApi.bookFail(id, { fail_reason: s.formFailReason, ...payload });
      }
      else if (a === 'correct') res = await bookingsApi.correct(id, payload);
      else if (a === 'resubmit') res = await bookingsApi.resubmit(id, payload);
      else if (a === 'review-archive') res = await bookingsApi.reviewArchive(id, payload);
      else if (a === 'loading-arrange') res = await bookingsApi.loadingArrange(id, payload);
      else if (a === 'loading-confirm') res = await bookingsApi.loadingConfirm(id, payload);
      else if (a === 'loading-fail') {
        if (!s.formFailReason) { alert('请填写失败原因'); s.executing = false; return; }
        res = await bookingsApi.loadingFail(id, { fail_reason: s.formFailReason, ...payload });
      }
      else if (a === 'bl-issue') res = await bookingsApi.blIssue(id, payload);
      else if (a === 'bl-collect') res = await bookingsApi.blCollect(id, payload);

      s.toast = '操作成功';
      setTimeout(() => (s.toast = ''), 2500);
      s.showActionModal = false;
      fetchAll();
    } catch (e: any) {
      alert('操作失败：' + (e.message || '未知错误'));
    } finally {
      s.executing = false;
    }
  };

  const saveEdit = async () => {
    s.executing = true;
    try {
      await bookingsApi.update(id, s.editForm);
      s.showEditModal = false;
      s.toast = '保存成功';
      setTimeout(() => (s.toast = ''), 2500);
      fetchAll();
    } catch (e: any) {
      alert('保存失败：' + (e.message || '未知错误'));
    } finally {
      s.executing = false;
    }
  };

  const doUpload = async () => {
    if (!s.uploadFile) { alert('请选择文件'); return; }
    s.uploadLoading = true;
    try {
      await bookingsApi.uploadAttachment(id, s.uploadFile, s.uploadCategory);
      s.showUploadModal = false;
      s.uploadFile = null;
      s.toast = '上传成功';
      setTimeout(() => (s.toast = ''), 2500);
      fetchAll();
    } catch (e: any) {
      alert('上传失败：' + (e.message || '未知错误'));
    } finally {
      s.uploadLoading = false;
    }
  };

  const deleteAttachment = async (attId: number) => {
    if (!confirm('确认删除该附件？')) return;
    try {
      await bookingsApi.deleteAttachment(id, attId);
      fetchAll();
    } catch (e: any) {
      alert('删除失败：' + (e.message || '未知错误'));
    }
  };

  const saveOffline = async () => {
    if (!s.offlineValue) { alert('请填写新值'); return; }
    s.executing = true;
    try {
      await bookingsApi.offlineFill(id, {
        field_name: s.offlineField,
        new_value: s.offlineValue,
        source: s.offlineSource || undefined,
        remark: s.offlineRemark || undefined,
      });
      s.showOfflineModal = false;
      s.toast = '回填成功';
      setTimeout(() => (s.toast = ''), 2500);
      fetchAll();
    } catch (e: any) {
      alert('回填失败：' + (e.message || '未知错误'));
    } finally {
      s.executing = false;
    }
  };

  const saveAuditNote = async () => {
    if (!s.auditNoteRemark) { alert('请输入审计备注'); return; }
    s.executing = true;
    try {
      await bookingsApi.auditNote(id, { remark: s.auditNoteRemark });
      s.showAuditNoteModal = false;
      s.toast = '添加成功';
      setTimeout(() => (s.toast = ''), 2500);
      fetchAll();
    } catch (e: any) {
      alert('添加失败：' + (e.message || '未知错误'));
    } finally {
      s.executing = false;
    }
  };

  const getActionTitle = (key: string) => {
    const a = actions.find((x) => x.key === key);
    return a?.label || key;
  };

  const b = s.booking;
  const hasValidationError = s.validation && (s.validation.errors?.length > 0 || s.validation.warnings?.length > 0);
  const hasStatusMismatch = b?.status_mismatch && b.status_mismatch.length > 0;

  if (s.loading) {
    return (
      <div class="py-20 text-center">
        <div class="inline-block w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-gray-400 mt-4">加载中...</p>
      </div>
    );
  }

  if (!b) {
    return (
      <div class="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
        <p class="text-gray-500">未找到记录</p>
        <Link href={backPath} class="inline-block mt-4 text-blue-600 hover:underline">返回列表</Link>
      </div>
    );
  }

  return (
    <div class="space-y-5">
      {s.toast && (
        <div class="fixed top-20 right-6 z-50 px-5 py-3 bg-green-600 text-white rounded-xl shadow-xl animate-pulse">
          ✓ {s.toast}
        </div>
      )}

      <div class="flex items-center justify-between">
        <Link href={backPath} class="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-xl border border-gray-200 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          返回列表
        </Link>
        <div class="flex items-center gap-2 flex-wrap justify-end max-w-[70%]">
          {(() => {
            // 按角色 + 状态条件过滤按钮
            const filtered = actions.filter(
              (a) => can(a.roles) && (!a.condition || (b && a.condition(b)))
            );
            // 按 variant 分组排列，主操作放前面
            const order: Record<string, number> = {
              primary: 1, success: 2, info: 3,
              warning: 4, default: 5, danger: 6,
            };
            filtered.sort((x, y) => (order[x.variant] ?? 9) - (order[y.variant] ?? 9));
            if (filtered.length === 0) {
              return (
                <div class="px-3 py-2 text-xs text-gray-400 bg-gray-50 rounded-lg">
                  当前角色无可用操作
                </div>
              );
            }
            return filtered.map((a) => (
              <Button
                key={a.key}
                variant={a.variant}
                size="sm"
                onClick$={() => openAction(a.key)}
              >
                {a.label}
              </Button>
            ));
          })()}
        </div>
      </div>

      {(hasValidationError || hasStatusMismatch || b.is_exception) && (
        <div class="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-5 shadow-sm">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse">
              <svg class="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="flex-1 space-y-2">
              <h3 class="font-bold text-red-900 text-base">异常检测警告</h3>
              {b.is_exception && (
                <div class="text-red-700 text-sm">
                  <span class="font-medium">异常标记：</span>
                  <span class="inline-block px-2 py-0.5 bg-red-200/60 rounded text-red-800 text-xs ml-1">
                    {b.exception_type || '已标记异常'}
                  </span>
                  {b.exception_note && <span class="ml-2">({b.exception_note})</span>}
                </div>
              )}
              {hasStatusMismatch && (
                <div class="text-red-700 text-sm">
                  <span class="font-medium">状态不一致：</span>
                  {b.status_mismatch?.map((m, i) => (
                    <span key={i} class="inline-block bg-white/70 px-2 py-0.5 rounded text-xs ml-1 border border-red-200">
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {s.validation?.errors && s.validation.errors.length > 0 && (
                <div class="text-red-700 text-sm">
                  <span class="font-medium">校验错误：</span>
                  <ul class="list-disc ml-6 mt-1 space-y-0.5">
                    {s.validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {s.validation?.warnings && s.validation.warnings.length > 0 && (
                <div class="text-orange-700 text-sm">
                  <span class="font-medium">警告提示：</span>
                  <ul class="list-disc ml-6 mt-1 space-y-0.5">
                    {s.validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-5">
            <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
              {module === 'booking' ? '📋' : module === 'loading' ? '🚛' : '📄'}
            </div>
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold text-gray-900">{b.form_no || `#${b.id}`}</h1>
                <span class="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                  批次: {b.batch_no || '-'}
                </span>
              </div>
              <div class="text-sm text-gray-500 mt-2">客户: <span class="text-gray-700 font-medium">{b.customer || '-'}</span></div>
              <div class="mt-3 flex flex-wrap gap-2">
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs">
                  <span class="text-gray-500">订舱:</span>
                  <StatusBadge label={b.booking_status_label || '-'} type={getStatusColor(b.booking_status)} />
                </div>
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-xs">
                  <span class="text-gray-500">装柜:</span>
                  <StatusBadge label={b.loading_status_label || '-'} type={getStatusColor(b.loading_status)} />
                </div>
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 text-xs">
                  <span class="text-gray-500">提单:</span>
                  <StatusBadge label={b.bl_status_label || '-'} type={getStatusColor(b.bl_status)} />
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-6 text-sm">
            <div class="text-center p-3 bg-gray-50 rounded-xl">
              <div class="text-gray-400 text-xs">提交人</div>
              <div class="font-medium text-gray-900 mt-1">{b.submitter_name || '-'}</div>
              <div class="text-gray-400 text-xs mt-1">{b.submitted_at ? new Date(b.submitted_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-xl">
              <div class="text-gray-400 text-xs">审核人</div>
              <div class="font-medium text-gray-900 mt-1">{b.reviewer_name || '-'}</div>
              <div class="text-gray-400 text-xs mt-1">{b.reviewed_at ? new Date(b.reviewed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</div>
            </div>
            <div class="text-center p-3 bg-gray-50 rounded-xl">
              <div class="text-gray-400 text-xs">归档人</div>
              <div class="font-medium text-gray-900 mt-1">{b.archivist_name || '-'}</div>
              <div class="text-gray-400 text-xs mt-1">{b.archived_at ? new Date(b.archived_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="flex border-b border-gray-100 px-2 pt-2 bg-gray-50/50">
          {tabDefs.map((t) => (
            <button
              key={t.key}
              onClick$={() => (s.tab = t.key)}
              class={
                'px-5 py-3 text-sm font-medium rounded-t-xl transition-all -mb-px border-b-2 ' +
                (s.tab === t.key
                  ? 'text-blue-600 bg-white border-blue-500 shadow-[0_-2px_8px_rgba(59,130,246,0.05)]'
                  : 'text-gray-500 hover:text-gray-700 border-transparent')
              }
            >
              <span class="mr-2">{t.icon}</span>
              {t.label}
              {t.key === 'attachments' && s.attachments.length > 0 && (
                <span class="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{s.attachments.length}</span>
              )}
              {t.key === 'operations' && s.operations.length > 0 && (
                <span class="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{s.operations.length}</span>
              )}
            </button>
          ))}
        </div>

        <div class="p-6">
          {s.tab === 'basic' && (
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <InfoCard title="基础信息" icon="📝" items={[
                { label: '单号', value: b.form_no },
                { label: '批次号', value: b.batch_no },
                { label: '客户', value: b.customer },
                { label: '货代', value: b.forwarder },
                { label: '截止时间', value: b.deadline },
              ]} />
              <InfoCard title="物流信息" icon="🚢" items={[
                { label: '起运港', value: b.port_of_loading },
                { label: '卸货港', value: b.port_of_discharge },
                { label: '船名航次', value: b.vessel },
                { label: 'SO号', value: b.so_no },
                { label: '提单号', value: b.bl_no },
              ]} />
              <InfoCard title="时间节点" icon="📅" items={[
                { label: '预计开船', value: b.etd },
                { label: '预计到港', value: b.eta },
                { label: '创建时间', value: b.created_at ? new Date(b.created_at).toLocaleString('zh-CN') : '-' },
                { label: '更新时间', value: b.updated_at ? new Date(b.updated_at).toLocaleString('zh-CN') : '-' },
              ]} />
              <InfoCard title="货物信息" icon="📦" items={[
                { label: '箱型', value: b.container_type },
                { label: '箱量', value: b.container_qty?.toString() },
                { label: '货物描述', value: b.cargo_desc },
                { label: '重量', value: b.weight },
                { label: '体积', value: b.volume },
              ]} />
              <InfoCard title="状态流转" icon="🔄" items={[
                { label: '订舱状态', value: b.booking_status_label, badge: b.booking_status, badgeType: getStatusColor(b.booking_status) },
                { label: '装柜状态', value: b.loading_status_label, badge: b.loading_status, badgeType: getStatusColor(b.loading_status) },
                { label: '提单状态', value: b.bl_status_label, badge: b.bl_status, badgeType: getStatusColor(b.bl_status) },
                { label: '异常标记', value: b.is_exception ? (b.exception_type || '是') : '否', danger: b.is_exception },
              ]} />
              <InfoCard title="备注信息" icon="💬" items={[
                { label: '异常说明', value: b.exception_note, danger: !!b.exception_note },
                { label: '退回原因', value: b.return_reason, danger: !!b.return_reason },
                { label: '结果说明', value: b.result_note },
                { label: '审计备注', value: b.audit_remark },
              ]} />

              {b.offline_booking_status || b.offline_loading_status || b.offline_bl_status ? (
                <InfoCard title="离线台账" icon="📊" items={[
                  { label: '离线订舱', value: b.offline_booking_status },
                  { label: '离线装柜', value: b.offline_loading_status },
                  { label: '离线提单', value: b.offline_bl_status },
                ]} />
              ) : null}
            </div>
          )}

          {s.tab === 'attachments' && (
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="text-sm text-gray-500">共 {s.attachments.length} 个附件</div>
                <Button variant="primary" size="sm" onClick$={() => { s.uploadFile = null; s.uploadCategory = 'booking_doc'; s.showUploadModal = true; }}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  上传附件
                </Button>
              </div>
              {s.attachments.length === 0 ? (
                <EmptyState text="暂无附件，点击上方按钮上传" />
              ) : (
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {s.attachments.map((att: Attachment) => (
                    <div key={att.id} class="p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                      <div class="flex items-start gap-3">
                        <div class="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center text-2xl border border-blue-100">
                          📎
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between">
                            <div class="font-medium text-gray-900 truncate pr-2">{att.file_name}</div>
                            <button
                              onClick$={() => deleteAttachment(att.id)}
                              class="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                          <div class="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                            <span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">{att.category_label}</span>
                            <span>{att.file_size ? formatFileSize(att.file_size) : '-'}</span>
                          </div>
                          <div class="text-xs text-gray-400 mt-2 flex items-center justify-between">
                            <span>{att.uploader_name} · {new Date(att.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                            {att.file_url && (
                              <a href={att.file_url.startsWith('http') ? att.file_url : `http://localhost:8005${att.file_url}`} target="_blank" class="text-blue-600 hover:underline">
                                下载
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {s.tab === 'operations' && (
            <TimelineView
              items={s.operations.map((op: OperationLog) => ({
                title: op.action_label,
                user: op.operator_name,
                role: op.role_label,
                time: op.created_at,
                remark: op.remark,
                tag: `${op.from_status || '-'} → ${op.to_status || '-'}`,
                tagColor: 'primary',
                fieldChanged: op.field_changed,
                oldValue: op.old_value,
                newValue: op.new_value,
              }))}
              emptyText="暂无操作记录"
            />
          )}

          {s.tab === 'audit' && (
            <TimelineView
              items={s.audits.map((au: AuditLog) => ({
                title: au.audit_type_label,
                user: au.auditor_name,
                role: '',
                time: au.created_at,
                remark: au.remark,
                tag: au.result_label,
                tagColor: (au.result === 'pass' || au.result_label?.includes('通过') ? 'success' : 'danger') as any,
                failReason: au.fail_reason,
              }))}
              emptyText="暂无审计日志"
            />
          )}

          {s.tab === 'offline' && (
            <div class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <InfoCard title="离线订舱状态" icon="📋" items={[{ label: '当前值', value: b.offline_booking_status || '-' }]} />
                <InfoCard title="离线装柜状态" icon="🚛" items={[{ label: '当前值', value: b.offline_loading_status || '-' }]} />
                <InfoCard title="离线提单状态" icon="📄" items={[{ label: '当前值', value: b.offline_bl_status || '-' }]} />
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 mb-3">回填记录（{s.offlineRecords.length}）</h4>
                {s.offlineRecords.length === 0 ? (
                  <EmptyState text="暂无回填记录" />
                ) : (
                  <div class="border border-gray-100 rounded-xl overflow-hidden">
                    <table class="w-full text-sm">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">时间</th>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">回填字段</th>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">新值</th>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">来源</th>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">操作人</th>
                          <th class="px-4 py-3 text-left font-medium text-gray-600">备注</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-50">
                        {s.offlineRecords.map((r: any) => (
                          <tr key={r.id}>
                            <td class="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                            <td class="px-4 py-3 text-gray-700 font-medium">{r.field_name}</td>
                            <td class="px-4 py-3 text-blue-600">{r.new_value}</td>
                            <td class="px-4 py-3 text-gray-500">{r.source || '-'}</td>
                            <td class="px-4 py-3 text-gray-700">{r.operator_name}</td>
                            <td class="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{r.remark || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 执行操作模态框 */}
      <Modal
        open={s.showActionModal}
        title={getActionTitle(s.actionType)}
        onClose$={() => (s.showActionModal = false)}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick$={() => (s.showActionModal = false)} disabled={s.executing}>取消</Button>
            <Button variant={actions.find((a) => a.key === s.actionType)?.variant || 'primary'} onClick$={executeAction} disabled={s.executing}>
              {s.executing ? '处理中...' : '确认执行'}
            </Button>
          </>
        }
      >
        <div class="space-y-4">
          {s.actionType && actions.find((a) => a.key === s.actionType)?.needFailReason && (
            <InputField
              label="失败/退回原因"
              value={s.formFailReason}
              onChange$={(v) => (s.formFailReason = v)}
              placeholder="请输入原因"
              rows={3}
              required
            />
          )}
          <InputField
            label="结果说明"
            value={s.formResultNote}
            onChange$={(v) => (s.formResultNote = v)}
            placeholder="请输入结果说明（选填）"
            rows={2}
          />
          <InputField
            label="操作备注"
            value={s.formRemark}
            onChange$={(v) => (s.formRemark = v)}
            placeholder="请输入备注（选填）"
            rows={2}
          />
        </div>
      </Modal>

      {/* 编辑基本信息 */}
      <Modal
        open={s.showEditModal}
        title="编辑基本信息"
        onClose$={() => (s.showEditModal = false)}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick$={() => (s.showEditModal = false)} disabled={s.executing}>取消</Button>
            <Button variant="primary" onClick$={saveEdit} disabled={s.executing}>
              {s.executing ? '保存中...' : '保存修改'}
            </Button>
          </>
        }
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField label="单号" value={s.editForm.form_no || ''} onChange$={(v) => (s.editForm.form_no = v)} />
          <InputField label="批次号" value={s.editForm.batch_no || ''} onChange$={(v) => (s.editForm.batch_no = v)} />
          <InputField label="客户" value={s.editForm.customer || ''} onChange$={(v) => (s.editForm.customer = v)} />
          <InputField label="货代" value={s.editForm.forwarder || ''} onChange$={(v) => (s.editForm.forwarder = v)} />
          <InputField label="起运港" value={s.editForm.port_of_loading || ''} onChange$={(v) => (s.editForm.port_of_loading = v)} />
          <InputField label="卸货港" value={s.editForm.port_of_discharge || ''} onChange$={(v) => (s.editForm.port_of_discharge = v)} />
          <InputField label="箱型" value={s.editForm.container_type || ''} onChange$={(v) => (s.editForm.container_type = v)} />
          <InputField label="箱量" value={s.editForm.container_qty?.toString() || ''} onChange$={(v) => (s.editForm.container_qty = Number(v) || 0)} />
          <InputField label="货物描述" value={s.editForm.cargo_desc || ''} onChange$={(v) => (s.editForm.cargo_desc = v)} />
          <InputField label="重量" value={s.editForm.weight || ''} onChange$={(v) => (s.editForm.weight = v)} />
          <InputField label="体积" value={s.editForm.volume || ''} onChange$={(v) => (s.editForm.volume = v)} />
          <InputField label="预计开船ETD" value={s.editForm.etd || ''} onChange$={(v) => (s.editForm.etd = v)} />
          <InputField label="预计到港ETA" value={s.editForm.eta || ''} onChange$={(v) => (s.editForm.eta = v)} />
          <InputField label="船名航次" value={s.editForm.vessel || ''} onChange$={(v) => (s.editForm.vessel = v)} />
          <InputField label="SO号" value={s.editForm.so_no || ''} onChange$={(v) => (s.editForm.so_no = v)} />
          <InputField label="提单号" value={s.editForm.bl_no || ''} onChange$={(v) => (s.editForm.bl_no = v)} />
        </div>
      </Modal>

      {/* 上传附件 */}
      <Modal
        open={s.showUploadModal}
        title="上传附件"
        onClose$={() => (s.showUploadModal = false)}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick$={() => (s.showUploadModal = false)} disabled={s.uploadLoading}>取消</Button>
            <Button variant="primary" onClick$={doUpload} disabled={s.uploadLoading}>
              {s.uploadLoading ? '上传中...' : '上传'}
            </Button>
          </>
        }
      >
        <div class="space-y-4">
          <SelectField
            label="附件类别"
            value={s.uploadCategory}
            onChange$={(v) => (s.uploadCategory = v)}
            options={[
              { value: 'booking_doc', label: '订舱资料' },
              { value: 'loading_doc', label: '装柜单据' },
              { value: 'bl_doc', label: '提单文件' },
              { value: 'certificate', label: '证明文件' },
              { value: 'other', label: '其他' },
            ]}
            required
          />
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">选择文件</label>
            <label class="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
              <svg class="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <div class="text-sm text-gray-600">{s.uploadFile?.name || '点击选择文件'}</div>
              <div class="text-xs text-gray-400 mt-1">支持所有文件格式</div>
              <input
                type="file"
                class="hidden"
                onChange$={(e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files[0]) s.uploadFile = files[0];
                }}
              />
            </label>
          </div>
        </div>
      </Modal>

      {/* 离线台账回填 */}
      <Modal
        open={s.showOfflineModal}
        title="离线台账回填"
        onClose$={() => (s.showOfflineModal = false)}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick$={() => (s.showOfflineModal = false)} disabled={s.executing}>取消</Button>
            <Button variant="primary" onClick$={saveOffline} disabled={s.executing}>
              {s.executing ? '处理中...' : '确认回填'}
            </Button>
          </>
        }
      >
        <div class="space-y-4">
          <SelectField
            label="回填字段"
            value={s.offlineField}
            onChange$={(v) => (s.offlineField = v)}
            options={[
              { value: 'offline_booking_status', label: '离线订舱状态' },
              { value: 'offline_loading_status', label: '离线装柜状态' },
              { value: 'offline_bl_status', label: '离线提单状态' },
              { value: 'so_no', label: 'SO号' },
              { value: 'bl_no', label: '提单号' },
              { value: 'vessel', label: '船名航次' },
              { value: 'etd', label: 'ETD预计开船' },
              { value: 'eta', label: 'ETA预计到港' },
            ]}
            required
          />
          <InputField label="新值" value={s.offlineValue} onChange$={(v) => (s.offlineValue = v)} placeholder="请输入新值" required />
          <InputField label="来源（选填）" value={s.offlineSource} onChange$={(v) => (s.offlineSource = v)} placeholder="如：邮件/电话/系统截图等" />
          <InputField label="备注（选填）" value={s.offlineRemark} onChange$={(v) => (s.offlineRemark = v)} rows={2} />
        </div>
      </Modal>

      {/* 添加审计备注 */}
      <Modal
        open={s.showAuditNoteModal}
        title="添加审计备注"
        onClose$={() => (s.showAuditNoteModal = false)}
        width="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick$={() => (s.showAuditNoteModal = false)} disabled={s.executing}>取消</Button>
            <Button variant="warning" onClick$={saveAuditNote} disabled={s.executing}>
              {s.executing ? '处理中...' : '添加'}
            </Button>
          </>
        }
      >
        <InputField label="审计备注内容" value={s.auditNoteRemark} onChange$={(v) => (s.auditNoteRemark = v)} placeholder="请输入审计备注信息" rows={4} required />
      </Modal>
    </div>
  );
});

// 辅助组件
const InfoCard = component$<{
  title: string;
  icon: string;
  items: Array<{ label: string; value: string | number | undefined | null; badge?: string; badgeType?: any; danger?: boolean }>;
}>(({ title, icon, items }) => (
  <div class="bg-gray-50/60 border border-gray-100 rounded-xl p-5">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">{icon}</span>
      <h3 class="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
    <dl class="space-y-3">
      {items.map((item, i) => (
        <div key={i} class="flex items-start justify-between gap-3 text-sm">
          <dt class="text-gray-500 flex-shrink-0 min-w-[72px]">{item.label}</dt>
          <dd class="text-right flex-1">
            {item.badge ? (
              <StatusBadge label={item.value?.toString() || '-'} type={item.badgeType || 'gray'} />
            ) : (
              <span class={
                'font-medium ' +
                (item.danger ? 'text-red-600' : 'text-gray-800')
              }>
                {item.value || '-'}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  </div>
));

const TimelineView = component$<{
  items: Array<{
    title: string;
    user: string;
    role: string;
    time: string;
    remark?: string | null;
    tag?: string;
    tagColor?: any;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    failReason?: string | null;
  }>;
  emptyText: string;
}>(({ items, emptyText }) => {
  if (!items || items.length === 0) return <EmptyState text={emptyText} />;
  return (
    <ol class="relative border-l-2 border-gray-100 ml-3 space-y-5">
      {items.map((item, idx) => (
        <li key={idx} class="ml-6">
          <span class="absolute -left-[9px] flex w-4 h-4 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-white shadow-sm"></span>
          <div class="bg-gray-50/60 border border-gray-100 rounded-xl p-4 hover:border-blue-200 transition-colors">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="font-semibold text-gray-900">{item.title}</h4>
                  {item.tag && <StatusBadge label={item.tag} type={item.tagColor || 'gray'} />}
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    {item.user}
                  </span>
                  {item.role && <span>· {item.role}</span>}
                  <span class="flex items-center gap-1 ml-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {new Date(item.time).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </div>
            {item.fieldChanged && (
              <div class="mt-3 p-3 bg-white rounded-lg border border-gray-100 text-xs">
                <span class="text-gray-500 mr-2">字段变更:</span>
                <span class="font-medium text-gray-700">{item.fieldChanged}</span>
                <span class="mx-2 text-gray-300">→</span>
                <span class="text-red-600 line-through mr-2">{item.oldValue || '-'}</span>
                <svg class="inline w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                <span class="text-green-600 ml-2">{item.newValue || '-'}</span>
              </div>
            )}
            {item.failReason && (
              <div class="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                <span class="font-medium mr-1">原因:</span>{item.failReason}
              </div>
            )}
            {item.remark && (
              <div class="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                <span class="font-medium mr-1">备注:</span>{item.remark}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
});

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
