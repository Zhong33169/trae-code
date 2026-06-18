import { component$, useSignal, useTask$, $, useComputed$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { useAuthCheck } from '../layout';
import type { Application, Statistics } from '~/types';
import {
  getApplications,
  getStatistics,
  batchAction,
  statusLabels,
  formatDate,
  getOverdueNextAction,
} from '~/utils/api';
import type { BatchItem } from '~/utils/api';

export default component$(() => {
  const nav = useNavigate();
  const auth = useAuthCheck();

  const applications = useSignal<Application[]>([]);
  const total = useSignal(0);
  const statistics = useSignal<Statistics | null>(null);
  const loading = useSignal(false);

  const page = useSignal(1);
  const pageSize = useSignal(10);
  const statusFilter = useSignal('');
  const overdueFilter = useSignal(false);
  const keyword = useSignal('');

  const selectedIds = useSignal<number[]>([]);
  const showBatchModal = useSignal(false);
  const batchActionType = useSignal('');
  const batchRemark = useSignal('');

  const message = useSignal<{ type: string; text: string } | null>(null);

  const user = auth.value.user;
  const role = user?.role || 'registrar';

  const showMessage = $((type: string, text: string) => {
    message.value = { type, text };
    setTimeout(() => (message.value = null), 3000);
  });

  const loadData = $(async () => {
    if (!auth.value.isLoggedIn) return;
    loading.value = true;
    try {
      const [apps, stats] = await Promise.all([
        getApplications({
          page: page.value,
          page_size: pageSize.value,
          status: statusFilter.value || undefined,
          is_overdue: overdueFilter.value ? true : undefined,
          keyword: keyword.value || undefined,
        }),
        getStatistics(),
      ]);
      applications.value = apps.items;
      total.value = apps.total;
      statistics.value = stats;
    } catch (e: any) {
      showMessage('error', e.message || '加载失败');
    } finally {
      loading.value = false;
    }
  });

  useTask$(({ track }) => {
    track(() => page.value);
    track(() => statusFilter.value);
    track(() => overdueFilter.value);
    track(() => auth.value.isLoggedIn);
    loadData();
  });

  const selectedHasOverdue = useComputed$(() =>
    applications.value.some((a) => selectedIds.value.includes(a.id) && a.is_overdue)
  );

  const selectedOverdueCount = useComputed$(() =>
    applications.value.filter((a) => selectedIds.value.includes(a.id) && a.is_overdue).length
  );

  const getBatchActions = (): Array<{ value: string; label: string }> => {
    if (role === 'audit_supervisor') {
      return [
        { value: 'start_audit', label: '批量开始审核' },
        { value: 'audit_pass', label: '批量审核通过' },
      ];
    }
    if (role === 'review_leader') {
      return [
        { value: 'review_pass', label: '批量复核通过' },
        { value: 'archive', label: '批量归档' },
      ];
    }
    return [];
  };

  const canBatch = useComputed$(
    () =>
      (role === 'audit_supervisor' || role === 'review_leader') &&
      selectedIds.value.length > 0
  );

  const toggleSelectOne = $((id: number, checked: boolean) => {
    if (checked) {
      selectedIds.value = [...selectedIds.value, id];
    } else {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
    }
  });

  const toggleSelectAll = $(async (checked: boolean) => {
    if (checked) {
      selectedIds.value = applications.value.map((a) => a.id);
    } else {
      selectedIds.value = [];
    }
  });

  const batchResult = useSignal<{ success: number[]; failed: Array<{ id: number; code?: string; reason: string }> } | null>(null);

  const handleBatchSubmit = $(async () => {
    if (!batchActionType.value) {
      showMessage('error', '请选择批量操作');
      return;
    }

    if (selectedHasOverdue.value && !batchRemark.value.trim()) {
      showMessage('error', '选中的申请中包含逾期项，请填写逾期处理说明');
      return;
    }

    const items: BatchItem[] = applications.value
      .filter((a) => selectedIds.value.includes(a.id))
      .map((a) => ({ id: a.id, version: a.version }));

    try {
      const result = await batchAction(
        items,
        batchActionType.value,
        batchRemark.value || undefined
      );
      batchResult.value = result;
      const successCount = result.success.length;
      const failCount = result.failed.length;
      let msg = `批量操作完成：成功 ${successCount} 条`;
      if (failCount > 0) msg += `，失败 ${failCount} 条`;
      showMessage(failCount > 0 ? 'warning' : 'success', msg);
      if (failCount === 0) {
        showBatchModal.value = false;
        batchActionType.value = '';
        batchRemark.value = '';
        selectedIds.value = [];
      }
      loadData();
    } catch (e: any) {
      showMessage('error', e.message || '批量操作失败');
    }
  });

  const statCards = useComputed$(() => {
    if (!statistics.value || !user) return [];
    const stats = statistics.value;
    const r = role;
    const cards: Array<{
      label: string;
      value: number;
      type: string;
      status?: string;
      isOverdue?: boolean;
    }> = [];

    if (r === 'registrar') {
      cards.push({ label: '草稿', value: stats.draft, type: 'default', status: 'draft' });
      cards.push({ label: '待审核', value: stats.pending_audit, type: 'info', status: 'submitted' });
      cards.push({ label: '待补正', value: stats.pending_correction, type: 'warning', status: 'correction_requested' });
      cards.push({ label: '已通过', value: stats.passed, type: 'success' });
    } else if (r === 'audit_supervisor') {
      cards.push({ label: '待审核', value: stats.pending_audit, type: 'warning', status: 'submitted' });
      cards.push({ label: '审核中', value: stats.under_review, type: 'info', status: 'under_review' });
      cards.push({ label: '待补正', value: stats.pending_correction, type: 'danger', status: 'correction_requested' });
      cards.push({ label: '逾期处理', value: stats.overdue, type: 'danger', isOverdue: true });
    } else if (r === 'review_leader') {
      cards.push({ label: '待复核', value: stats.pending_review, type: 'warning', status: 'audit_passed' });
      cards.push({ label: '复核通过', value: stats.review_passed, type: 'success', status: 'review_passed' });
      cards.push({ label: '已归档', value: stats.archived, type: 'default', status: 'archived' });
      cards.push({ label: '逾期复核', value: stats.review_overdue, type: 'danger', status: 'audit_passed', isOverdue: true });
    }

    return cards;
  });

  const handleStatClick = $((card: { status?: string; isOverdue?: boolean }) => {
    if (card.isOverdue) {
      overdueFilter.value = true;
      statusFilter.value = '';
    } else if (card.status) {
      statusFilter.value = card.status;
      overdueFilter.value = false;
    }
    page.value = 1;
  });

  const totalPages = useComputed$(() => Math.ceil(total.value / pageSize.value) || 1);

  return (
    <div>
      {message.value && (
        <div class={`message message-${message.value.type}`}>{message.value.text}</div>
      )}

      <div class="stat-cards">
        {statCards.value.map((card, idx) => (
          <div
            key={idx}
            class={`stat-card ${card.type}`}
            onClick$={() => handleStatClick(card)}
          >
            <div class="stat-label">{card.label}</div>
            <div class="stat-value">{card.value}</div>
          </div>
        ))}
      </div>

      <div class="card">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="filter-group">
              <select
                class="select"
                value={statusFilter.value}
                onChange$={(e) => {
                  statusFilter.value = (e.target as HTMLSelectElement).value;
                  page.value = 1;
                }}
              >
                <option value="">全部状态</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={overdueFilter.value}
                  onChange$={(e) => {
                    overdueFilter.value = (e.target as HTMLInputElement).checked;
                    page.value = 1;
                  }}
                />
                只看逾期
              </label>
            </div>
          </div>

          <div class="toolbar-right">
            {role === 'registrar' && (
              <button
                class="btn btn-success"
                onClick$={() => nav('/applications/new')}
              >
                + 新建申请
              </button>
            )}
            {canBatch.value && (
              <button
                class="btn btn-primary"
                onClick$={() => {
                  showBatchModal.value = true;
                  batchActionType.value = '';
                  batchRemark.value = '';
                  batchResult.value = null;
                }}
              >
                批量处理 ({selectedIds.value.length})
              </button>
            )}
          </div>
        </div>

        {loading.value ? (
          <div class="empty-state">加载中...</div>
        ) : (
          <table class="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  {canBatch.value && (
                    <input
                      type="checkbox"
                      class="checkbox"
                      checked={
                        selectedIds.value.length === applications.value.length &&
                        applications.value.length > 0
                      }
                      onChange$={(e) =>
                        toggleSelectAll((e.target as HTMLInputElement).checked)
                      }
                    />
                  )}
                </th>
                <th>申请编号</th>
                <th>公司名称</th>
                <th>联系人</th>
                <th>展位类型</th>
                <th>状态</th>
                <th>状态变更时间</th>
                <th style={{ width: '80px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {applications.value.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div class="empty-state">暂无数据</div>
                  </td>
                </tr>
              ) : (
                applications.value.map((app) => (
                  <>
                    <tr key={app.id}>
                      <td rowSpan={app.is_overdue ? 2 : 1}>
                        {canBatch.value && (
                          <input
                            type="checkbox"
                            class="checkbox"
                            checked={selectedIds.value.includes(app.id)}
                            onChange$={(e) =>
                              toggleSelectOne(app.id, (e.target as HTMLInputElement).checked)
                            }
                          />
                        )}
                      </td>
                      <td rowSpan={app.is_overdue ? 2 : 1} style={{ fontFamily: 'monospace' }}>
                        {app.application_no}
                      </td>
                      <td>
                        {app.company_name}
                        {app.is_overdue && <span class="overdue-tag">逾期</span>}
                      </td>
                      <td>{app.contact_person}</td>
                      <td>{app.booth_type || '-'}</td>
                      <td>
                        <span class={`status-tag status-${app.status}`}>
                          {statusLabels[app.status] || app.status}
                        </span>
                      </td>
                      <td style={{ color: '#666', fontSize: '13px' }}>
                        {formatDate(app.status_changed_at)}
                      </td>
                      <td rowSpan={app.is_overdue ? 2 : 1}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            class="btn btn-primary btn-sm"
                            onClick$={() => nav(`/applications/${app.id}`)}
                          >
                            查看
                          </button>
                          {role === 'registrar' && (app.status === 'draft' || app.status === 'correction_requested') && (
                            <button
                              class="btn btn-default btn-sm"
                              onClick$={() => nav(`/applications/${app.id}/edit`)}
                            >
                              {app.status === 'correction_requested' ? '补正' : '编辑'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {app.is_overdue && (
                      <tr style={{ background: '#fff7e6' }}>
                        <td
                          colSpan={6}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #ffe58f',
                          }}
                        >
                          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                            <span style={{ color: '#cf1322', fontWeight: 600 }}>逾期原因：</span>
                            <span style={{ color: '#873800' }}>
                              {app.overdue_reason || '原因未知'}
                            </span>
                            <span style={{ marginLeft: '12px', color: '#1890ff', fontWeight: 600 }}>
                              下一步：
                            </span>
                            <span style={{ color: '#0050b3' }}>
                              {getOverdueNextAction(app.status, app.is_overdue)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        )}

        <div class="pagination">
          <span style={{ marginRight: '12px', color: '#666' }}>共 {total.value} 条</span>
          <button
            class="page-btn"
            disabled={page.value <= 1}
            onClick$={() => {
              if (page.value > 1) page.value--;
            }}
          >
            上一页
          </button>
          <span style={{ margin: '0 8px' }}>
            第 {page.value} / {totalPages.value} 页
          </span>
          <button
            class="page-btn"
            disabled={page.value >= totalPages.value}
            onClick$={() => {
              if (page.value < totalPages.value) page.value++;
            }}
          >
            下一页
          </button>
        </div>
      </div>

      {showBatchModal.value && (
        <div
          class="modal-overlay"
          onClick$={() => (showBatchModal.value = false)}
        >
          <div
            class="modal"
            style={{ width: '460px' }}
            onClick$={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <span class="modal-title">批量操作</span>
              <span class="modal-close" onClick$={() => (showBatchModal.value = false)}>
                ×
              </span>
            </div>
            <div class="modal-body">
              {batchResult.value && batchResult.value.failed.length > 0 && (
                <div
                  class="alert alert-error"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>失败明细：</strong>
                  {batchResult.value.failed.map((f) => (
                    <div key={f.id} style={{ marginTop: '4px' }}>
                      申请 #{f.id}：{f.reason}
                      {f.code === 'VERSION_CONFLICT' && (
                        <span style={{ color: '#999', marginLeft: '4px' }}>(已被修改，请刷新)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p style={{ marginBottom: '12px' }}>
                已选择 <strong>{selectedIds.value.length}</strong> 条申请进行批量处理
              </p>
              {selectedHasOverdue.value && (
                <div
                  class="alert alert-warning"
                  style={{ marginBottom: '16px', fontSize: '13px' }}
                >
                  <strong>⚠ 注意：</strong>
                  选中的 <strong style={{ color: '#cf1322' }}>{selectedOverdueCount.value}</strong>{' '}
                  条申请已逾期，必须在下方填写逾期处理说明后才能推进。
                </div>
              )}
              <div class="form-item">
                <label class="form-label">操作类型</label>
                <select
                  class="select"
                  style={{ width: '100%' }}
                  value={batchActionType.value}
                  onChange$={(e) =>
                    (batchActionType.value = (e.target as HTMLSelectElement).value)
                  }
                >
                  <option value="">请选择操作</option>
                  {getBatchActions().map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div class="form-item">
                <label class="form-label">
                  处理说明
                  {selectedHasOverdue.value && (
                    <span style={{ color: '#ff4d4f' }}> *（逾期必填）</span>
                  )}
                </label>
                <textarea
                  class="form-input form-textarea"
                  value={batchRemark.value}
                  onInput$={(e) =>
                    (batchRemark.value = (e.target as HTMLTextAreaElement).value)
                  }
                  placeholder={
                    selectedHasOverdue.value
                      ? '请填写逾期处理说明（必填）...'
                      : '可选，填写批量处理备注'
                  }
                  rows={selectedHasOverdue.value ? 4 : 3}
                />
              </div>
            </div>
            <div class="modal-footer">
              <button
                class="btn btn-default"
                onClick$={() => (showBatchModal.value = false)}
              >
                取消
              </button>
              <button class="btn btn-primary" onClick$={handleBatchSubmit}>
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head = {
  title: '申请列表 - 展商申请管理系统',
};
