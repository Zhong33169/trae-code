import { component$, useStore, useTask$, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import type { Booking, ModuleType, EnumItem } from "~/types";
import { bookingsApi } from "~/api";
import { useMeta } from "~/store/meta";
import { useAuth } from "~/store/auth";
import { StatusBadge, getStatusColor } from "~/components/StatusBadge";
import { Button, InputField, SelectField, Modal, EmptyState } from "~/components/UI";

interface BookingListProps {
  module: ModuleType;
  moduleTitle: string;
}

const moduleTitles: Record<ModuleType, { title: string; desc: string; icon: string }> = {
  booking: { title: '订舱申请', desc: '管理订舱登记、审核与确认流程', icon: '📋' },
  loading: { title: '装柜确认', desc: '管理装柜安排与确认执行', icon: '🚛' },
  bl: { title: '提单回收', desc: '管理提单出单、回收与归档', icon: '📄' },
};

export const BookingList = component$<BookingListProps>(({ module }) => {
  const auth = useAuth();
  const meta = useMeta();
  const mt = moduleTitles[module];
  const nav = useNavigate();

  const state = useStore<any>({
    list: [] as Booking[],
    total: 0,
    loading: true,
    page: 1,
    size: 20,
    keyword: '',
    booking_status: '',
    loading_status: '',
    bl_status: '',
    is_exception: '',
    exception_type: '',
    selectedIds: new Set<number>(),
    batchAction: '',
    batchRemark: '',
    showBatchModal: false,
    batchResult: null as any,
    batchLoading: false,
    searchTimer: null as any,
  });

  const fetchList = async () => {
    state.loading = true;
    try {
      const params: Record<string, any> = {
        module,
        page: state.page,
        size: state.size,
      };
      if (state.keyword) params.keyword = state.keyword;
      if (state.booking_status) params.booking_status = state.booking_status;
      if (state.loading_status) params.loading_status = state.loading_status;
      if (state.bl_status) params.bl_status = state.bl_status;
      if (state.is_exception) params.is_exception = state.is_exception;
      if (state.exception_type) params.exception_type = state.exception_type;
      const res: any = await bookingsApi.list(params);
      state.list = res.items || [];
      state.total = res.total || 0;
    } catch (e: any) {
      console.error('fetch error:', e);
      state.list = [];
      state.total = 0;
    } finally {
      state.loading = false;
    }
  };

  useVisibleTask$(() => {
    fetchList();
  });

  const scheduleSearch = () => {
    if (state.searchTimer) clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.page = 1;
      fetchList();
    }, 400);
  };

  const toggleSelect = (id: number) => {
    if (state.selectedIds.has(id)) {
      state.selectedIds.delete(id);
    } else {
      state.selectedIds.add(id);
    }
  };

  const toggleSelectAll = () => {
    if (state.selectedIds.size === state.list.length && state.list.length > 0) {
      state.selectedIds.clear();
    } else {
      state.list.forEach((b: Booking) => state.selectedIds.add(b.id));
    }
  };

  const getEnumOptions = (key: string): EnumItem[] => {
    return (meta.enums as any)[key] || [];
  };

  const totalPages = Math.ceil(state.total / state.size);

  const openBatch = (action: string) => {
    if (state.selectedIds.size === 0) {
      alert('请先选择要操作的记录');
      return;
    }
    state.batchAction = action;
    state.batchRemark = '';
    state.batchResult = null;
    state.showBatchModal = true;
  };

  const executeBatch = async () => {
    state.batchLoading = true;
    state.batchResult = null;
    try {
      const res = await bookingsApi.batch({
        ids: Array.from(state.selectedIds),
        action: state.batchAction,
        remark: state.batchRemark || undefined,
      });
      state.batchResult = res;
      state.selectedIds.clear();
      fetchList();
    } catch (e: any) {
      alert('批量操作失败：' + (e.message || '未知错误'));
    } finally {
      state.batchLoading = false;
    }
  };

  return (
    <div class="space-y-5">
      <div class="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center text-2xl">
              {mt.icon}
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">{mt.title}</h1>
              <p class="text-sm text-gray-500 mt-0.5">{mt.desc}</p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <div class="text-right">
              <div class="text-gray-500">当前角色</div>
              <div class="font-medium text-gray-900">{auth.user?.role_label || '-'}</div>
            </div>
            <div class="h-10 w-px bg-gray-200"></div>
            <div class="text-right">
              <div class="text-gray-500">记录总数</div>
              <div class="font-bold text-blue-600">{state.total}</div>
            </div>
            {module === 'booking' && (auth.user?.role === 'registrar' || auth.user?.role === 'admin') && (
              <>
                <div class="h-10 w-px bg-gray-200"></div>
                <Button variant="primary" size="sm" onClick$={() => nav('/booking/new')}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                  新建订舱申请
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div class="xl:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">关键字搜索</label>
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={state.keyword}
                onInput$={(e) => { state.keyword = (e.target as HTMLInputElement).value; scheduleSearch(); }}
                placeholder="搜索单号、批次、客户..."
                class="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <SelectField
            label="订舱状态"
            value={state.booking_status}
            onChange$={(v) => { state.booking_status = v; state.page = 1; fetchList(); }}
            options={getEnumOptions('booking_status')}
          />
          <SelectField
            label="装柜状态"
            value={state.loading_status}
            onChange$={(v) => { state.loading_status = v; state.page = 1; fetchList(); }}
            options={getEnumOptions('loading_status')}
          />
          <SelectField
            label="提单状态"
            value={state.bl_status}
            onChange$={(v) => { state.bl_status = v; state.page = 1; fetchList(); }}
            options={getEnumOptions('bl_status')}
          />
          <SelectField
            label="异常标记"
            value={state.is_exception}
            onChange$={(v) => { state.is_exception = v; state.page = 1; fetchList(); }}
            options={[
              { value: 'true', label: '异常' },
              { value: 'false', label: '正常' },
            ]}
          />
          <SelectField
            label="异常类型"
            value={state.exception_type}
            onChange$={(v) => { state.exception_type = v; state.page = 1; fetchList(); }}
            options={getEnumOptions('exception_type')}
          />
        </div>

        {state.selectedIds.size > 0 && (
          <div class="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                {state.selectedIds.size}
              </div>
              <div>
                <div class="font-medium text-blue-900">已选择 {state.selectedIds.size} 条记录</div>
                <div class="text-xs text-blue-600">可执行批量操作</div>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <Button variant="success" size="sm" onClick$={() => openBatch('review_pass')}>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                批量审核通过
              </Button>
              <Button variant="primary" size="sm" onClick$={() => openBatch('book_confirm')}>
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                批量订舱确认
              </Button>
              <Button variant="ghost" size="sm" onClick$={() => state.selectedIds.clear()}>
                取消选择
              </Button>
            </div>
          </div>
        )}
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {state.loading ? (
          <div class="py-20 text-center">
            <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-gray-400 text-sm mt-3">加载中...</p>
          </div>
        ) : state.list.length === 0 ? (
          <EmptyState text="暂无数据，试试调整筛选条件" />
        ) : (
          <>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-100">
                    <th class="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={state.selectedIds.size === state.list.length && state.list.length > 0}
                        onChange$={toggleSelectAll}
                        class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">单号 / 批次</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">客户</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">订舱状态</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">装柜状态</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">提单状态</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">异常</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600">提交人 / 时间</th>
                    <th class="px-4 py-3 text-left font-medium text-gray-600 w-20">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  {state.list.map((b: Booking) => (
                    <tr key={b.id} class="hover:bg-blue-50/30 transition-colors">
                      <td class="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={state.selectedIds.has(b.id)}
                          onChange$={() => toggleSelect(b.id)}
                          class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td class="px-4 py-3.5">
                        <Link href={`/${module}/${b.id}`} class="block group">
                          <div class="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {b.form_no || '-'}
                          </div>
                          <div class="text-xs text-gray-400 mt-0.5">
                            批次: {b.batch_no || '-'}
                          </div>
                        </Link>
                      </td>
                      <td class="px-4 py-3.5 text-gray-700">{b.customer || '-'}</td>
                      <td class="px-4 py-3.5">
                        <StatusBadge label={b.booking_status_label || b.booking_status || '-'} type={getStatusColor(b.booking_status || b.booking_status_label || '')} />
                      </td>
                      <td class="px-4 py-3.5">
                        <StatusBadge label={b.loading_status_label || b.loading_status || '-'} type={getStatusColor(b.loading_status || b.loading_status_label || '')} />
                      </td>
                      <td class="px-4 py-3.5">
                        <StatusBadge label={b.bl_status_label || b.bl_status || '-'} type={getStatusColor(b.bl_status || b.bl_status_label || '')} />
                      </td>
                      <td class="px-4 py-3.5">
                        {b.is_exception ? (
                          <div class="flex items-center gap-1.5">
                            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100">
                              <svg class="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </span>
                            <span class="text-xs text-red-600 font-medium">{b.exception_type || '异常'}</span>
                          </div>
                        ) : (
                          <span class="text-xs text-gray-400">正常</span>
                        )}
                      </td>
                      <td class="px-4 py-3.5">
                        <div class="text-gray-700">{b.submitter_name || '-'}</div>
                        <div class="text-xs text-gray-400 mt-0.5">
                          {b.submitted_at ? new Date(b.submitted_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </td>
                      <td class="px-4 py-3.5">
                        <Link href={`/${module}/${b.id}`} class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          查看
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div class="text-sm text-gray-500">
                  共 <span class="font-medium text-gray-900">{state.total}</span> 条，第 <span class="font-medium text-gray-900">{state.page}</span> / {totalPages} 页
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    disabled={state.page <= 1}
                    onClick$={() => { state.page = Math.max(1, state.page - 1); fetchList(); }}
                  >
                    上一页
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5) {
                      if (state.page <= 3) pageNum = i + 1;
                      else if (state.page >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = state.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick$={() => { state.page = pageNum; fetchList(); }}
                        class={
                          'w-9 h-9 rounded-lg text-sm font-medium transition-colors ' +
                          (state.page === pageNum
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-white border border-transparent hover:border-gray-200')
                        }
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="default"
                    disabled={state.page >= totalPages}
                    onClick$={() => { state.page = Math.min(totalPages, state.page + 1); fetchList(); }}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={state.showBatchModal}
        title={state.batchAction === 'review_pass' ? '批量审核通过' : '批量订舱确认'}
        onClose$={() => { state.showBatchModal = false; state.batchResult = null; }}
        width="max-w-md"
        footer={
          !state.batchResult ? (
            <>
              <Button variant="ghost" onClick$={() => { state.showBatchModal = false; }}>取消</Button>
              <Button variant={state.batchAction === 'review_pass' ? 'success' : 'primary'} onClick$={executeBatch} disabled={state.batchLoading}>
                {state.batchLoading ? '处理中...' : '确认执行'}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick$={() => { state.showBatchModal = false; state.batchResult = null; }}>
              关闭
            </Button>
          )
        }
      >
        {!state.batchResult ? (
          <div class="space-y-4">
            <div class="p-4 bg-gray-50 rounded-xl space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">操作类型</span>
                <span class="font-medium text-gray-900">
                  {state.batchAction === 'review_pass' ? '批量审核通过' : '批量订舱确认'}
                </span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500">记录数量</span>
                <span class="font-medium text-blue-600">{state.selectedIds.size} 条</span>
              </div>
            </div>
            <InputField
              label="操作备注"
              value={state.batchRemark}
              onChange$={(v) => (state.batchRemark = v)}
              placeholder="请输入备注信息（选填）"
              rows={3}
            />
          </div>
        ) : (
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 bg-green-50 rounded-xl text-center">
                <div class="text-2xl font-bold text-green-600">{state.batchResult.success_count}</div>
                <div class="text-xs text-green-600 mt-1">成功</div>
              </div>
              <div class="p-4 bg-red-50 rounded-xl text-center">
                <div class="text-2xl font-bold text-red-600">{state.batchResult.fail_count}</div>
                <div class="text-xs text-red-600 mt-1">失败</div>
              </div>
            </div>
            {state.batchResult.results && state.batchResult.results.length > 0 && (
              <div class="border border-gray-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table class="w-full text-xs">
                  <thead class="bg-gray-50 sticky top-0">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">单号</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">结果</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">信息</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    {state.batchResult.results.map((r: any) => (
                      <tr key={r.id}>
                        <td class="px-3 py-2 text-gray-700">{r.form_no}</td>
                        <td class="px-3 py-2">
                          {r.success ? (
                            <span class="text-green-600 font-medium">成功</span>
                          ) : (
                            <span class="text-red-600 font-medium">失败</span>
                          )}
                        </td>
                        <td class="px-3 py-2 text-gray-500 truncate max-w-[180px]">{r.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
});
