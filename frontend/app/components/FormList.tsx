'use client';

import { useState, useEffect } from 'react';
import { MerchantOnboardingForm, FormStatus, statusLabels, ActionType } from '../types';
import { getForms, getCurrentUser, batchProcess } from '../lib/api';
import Link from 'next/link';

interface TabConfig {
  title: string;
  description: string;
  roles: string[];
  statuses: string[];
}

interface FormListProps {
  tabKey: string;
  tabConfig: TabConfig;
}

export default function FormList({ tabKey, tabConfig }: FormListProps) {
  const [forms, setForms] = useState<MerchantOnboardingForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'queue' | 'all'>('queue');
  const [filters, setFilters] = useState({
    status: 'ALL',
    hasException: false,
    isOverdue: false,
    keyword: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState('');
  const [batchReason, setBatchReason] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const statusClassMap: Record<FormStatus, string> = {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'reviewing',
    MATERIALS_MISSING: 'materials-missing',
    QUALIFIED: 'qualified',
    REJECTED: 'rejected',
    STORE_OPENED: 'store-opened',
    ARCHIVED: 'archived',
  };

  const batchActionsByTab: Record<string, Array<{ value: string; label: string; roles: string[] }>> = {
    onboarding: [
      { value: 'SUBMIT', label: '批量提交审核', roles: ['CLERK'] },
      { value: 'RESUBMIT', label: '批量补正重提', roles: ['CLERK'] },
    ],
    review: [
      { value: 'START_REVIEW', label: '批量开始审核', roles: ['SUPERVISOR'] },
      { value: 'REQUEST_MATERIALS', label: '批量退回补正', roles: ['SUPERVISOR'] },
      { value: 'APPROVE_QUALIFICATION', label: '批量通过资质', roles: ['SUPERVISOR'] },
      { value: 'REJECT', label: '批量驳回', roles: ['SUPERVISOR'] },
    ],
    store: [
      { value: 'OPEN_STORE', label: '批量开通店铺', roles: ['REVIEWER'] },
      { value: 'ARCHIVE', label: '批量复核归档', roles: ['REVIEWER'] },
    ],
  };

  useEffect(() => {
    loadData();
  }, [filters, viewMode, tabKey]);

  useEffect(() => {
    getCurrentUser().then((res) => {
      if (res.success) setCurrentUser(res.data);
    });
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params: any = {
        keyword: filters.keyword || undefined,
      };

      if (filters.status !== 'ALL') {
        params.status = filters.status;
      }

      if (filters.hasException) {
        params.hasException = true;
      }
      if (filters.isOverdue) {
        params.isOverdue = true;
      }

      const res = await getForms(params);
      if (res.success) {
        let allForms = res.data.items;

        if (viewMode === 'queue' && currentUser) {
          allForms = allForms.filter((f: any) =>
            f.currentRole === currentUser.role || f.hasException
          );
        }

        allForms = allForms.filter((f: any) =>
          tabConfig.statuses.includes(f.status) || f.hasException
        );

        allForms.sort((a: any, b: any) => {
          if (a.hasException !== b.hasException) return a.hasException ? -1 : 1;
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        setForms(allForms);
      }
    } catch (err) {
      console.error('Failed to load forms:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(id: string, checked: boolean) {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(
        forms.filter((f) => !f.hasException && tabConfig.roles.includes(currentUser?.role) && f.currentRole === currentUser?.role)
          .map((f) => f.id)
      ));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function handleBatchProcess() {
    if (!batchAction || selectedIds.size === 0) return;

    try {
      const batchNo = `BATCH-${Date.now()}`;
      const selectedForms = forms.filter((f) => selectedIds.has(f.id));

      const res = await batchProcess({
        batchNo,
        forms: selectedForms.map((f) => ({ id: f.id, merchantName: f.merchantName })),
        action: batchAction,
        reason: batchReason || undefined,
      });

      if (res.success) {
        setBatchResult(res.data);
        if (res.data.success) {
          setMessage({ type: 'success', text: `批量处理成功：${res.data.processed}/${res.data.total} 条` });
        } else {
          setMessage({ type: 'error', text: `批量处理完成：成功 ${res.data.processed} 条，失败 ${res.data.failed} 条` });
        }
        setSelectedIds(new Set());
        loadData();
      }
    } catch (err) {
      console.error('Batch process failed:', err);
      setMessage({ type: 'error', text: '批量处理失败' });
    }
  }

  const filteredBatchActions = (batchActionsByTab[tabKey] || []).filter((a) =>
    currentUser?.role ? a.roles.includes(currentUser.role) : false
  );

  const selectedForms = forms.filter((f) => selectedIds.has(f.id));

  const queueCount = forms.filter((f) => currentUser && f.currentRole === currentUser.role).length;
  const exceptionCount = forms.filter((f) => f.hasException).length;
  const overdueCount = forms.filter((f) => f.isOverdue).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '20px', margin: 0, color: '#111827' }}>{tabConfig.title}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{tabConfig.description}</p>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'queue' ? 'active' : ''}`}
            onClick={() => setViewMode('queue')}
          >
            待办队列
            {queueCount > 0 && <span className="toggle-badge">{queueCount}</span>}
          </button>
          <button
            className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            全部单据
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card stat-primary">
          <div className="stat-count">{queueCount}</div>
          <div className="stat-label">待我处理</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-count">{overdueCount}</div>
          <div className="stat-label">已超时</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-count">{exceptionCount}</div>
          <div className="stat-label">异常单</div>
        </div>
        <div className="stat-card stat-neutral">
          <div className="stat-count">{forms.length}</div>
          <div className="stat-label">本页签总计</div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-item">
          <label>状态：</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="ALL">全部状态</option>
            {tabConfig.statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s as FormStatus]}
              </option>
            ))}
          </select>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={filters.hasException}
              onChange={(e) => setFilters({ ...filters, hasException: e.target.checked })}
            />
            仅显示异常
          </label>
          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={filters.isOverdue}
              onChange={(e) => setFilters({ ...filters, isOverdue: e.target.checked })}
            />
            仅显示超时
          </label>
        </div>

        <div className="filter-item">
          <input
            type="text"
            placeholder="搜索商家名称、批次号、联系人..."
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          />
        </div>

        <button className="btn btn-secondary" onClick={loadData}>
          刷新
        </button>

        {tabKey === 'onboarding' && currentUser?.role === 'CLERK' && (
          <Link href="/create" className="btn btn-primary">
            新建入驻单
          </Link>
        )}

        {selectedIds.size > 0 && filteredBatchActions.length > 0 && (
          <button className="btn btn-success" onClick={() => setShowBatchModal(true)}>
            批量处理 ({selectedIds.size})
          </button>
        )}
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setMessage(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="queue-header">
        <div className="queue-title">
          {viewMode === 'queue' ? '待处理队列' : '全部单据'}
          {currentUser && viewMode === 'queue' && (
            <span className="queue-count">{currentUser.roleLabel}</span>
          )}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280' }}>
          共 {forms.length} 条记录
          {selectedIds.size > 0 && `，已选择 ${selectedIds.size} 条`}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">加载中...</div>
      ) : forms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div>暂无{viewMode === 'queue' ? '待处理的' : ''}入驻单</div>
        </div>
      ) : (
        <div className="queue-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === forms.filter((f) =>
                        !f.hasException && currentUser &&
                        tabConfig.roles.includes(currentUser.role) &&
                        f.currentRole === currentUser.role
                      ).length &&
                      forms.filter((f) =>
                        !f.hasException && currentUser &&
                        tabConfig.roles.includes(currentUser.role) &&
                        f.currentRole === currentUser.role
                      ).length > 0
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th>批次号</th>
                <th>商家名称</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th>当前状态</th>
                <th>处理角色</th>
                <th>创建时间</th>
                <th>截止时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => (
                <tr
                  key={form.id}
                  className={`${form.hasException ? 'exception' : ''} ${form.isOverdue ? 'overdue' : ''}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(form.id)}
                      onChange={(e) => handleSelect(form.id, e.target.checked)}
                      disabled={form.hasException || form.currentRole !== currentUser?.role}
                    />
                  </td>
                  <td>
                    {form.batchNo}
                    {form.hasException && <span className="tag tag-exception">异常</span>}
                    {form.isOverdue && <span className="tag tag-overdue">超时</span>}
                  </td>
                  <td>{form.merchantName}</td>
                  <td>{form.contact}</td>
                  <td>{form.phone}</td>
                  <td>
                    <span className={`status-badge ${statusClassMap[form.status]}`}>
                      {statusLabels[form.status]}
                    </span>
                  </td>
                  <td>{(form as any).currentRoleLabel || form.currentRole}</td>
                  <td>{new Date(form.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td>{form.deadline ? new Date(form.deadline).toLocaleDateString('zh-CN') : '-'}</td>
                  <td>
                    <Link
                      href={`/forms/${form.id}`}
                      className="btn btn-primary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      {form.hasException ? '查看/处理异常' : '处理'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>批量处理</h3>
            <p style={{ marginBottom: '16px', fontSize: '13px', color: '#6b7280' }}>
              已选择 {selectedIds.size} 条入驻单
            </p>

            <div className="form-item">
              <label>选择操作</label>
              <select value={batchAction} onChange={(e) => setBatchAction(e.target.value)}>
                <option value="">请选择操作</option>
                {filteredBatchActions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {(batchAction === 'REQUEST_MATERIALS' || batchAction === 'REJECT') && (
              <div className="form-item" style={{ marginTop: '12px' }}>
                <label>原因说明</label>
                <textarea
                  value={batchReason}
                  onChange={(e) => setBatchReason(e.target.value)}
                  placeholder="请输入原因..."
                />
              </div>
            )}

            <div style={{ marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px' }}>将处理以下入驻单：</div>
              {selectedForms.map((f) => (
                <div key={f.id} style={{ padding: '4px 0' }}>
                  • {f.merchantName}（{statusLabels[f.status]}）
                </div>
              ))}
            </div>

            {batchResult && (
              <div className="batch-results">
                {batchResult.results.map((r: any, i: number) => (
                  <div key={i} className={`batch-result-item ${r.success ? 'success' : 'failed'}`}>
                    {r.merchantName}：{r.message}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowBatchModal(false); setBatchResult(null); }}>
                关闭
              </button>
              {!batchResult && (
                <button
                  className="btn btn-primary"
                  onClick={handleBatchProcess}
                  disabled={!batchAction}
                >
                  确认批量处理
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
