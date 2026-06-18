import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, statusLabels, formatDate } from '../utils/api';
import type { Application, Statistics, User, Role } from '../types';

interface ApplicationListProps {
  user: User;
}

export default function ApplicationList({ user }: ApplicationListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOverdue, setFilterOverdue] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState('');
  const [batchRemark, setBatchRemark] = useState('');

  const [newAppForm, setNewAppForm] = useState({
    company_name: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    booth_type: '',
    booth_size: '',
    expected_area: '',
    industry: '',
    product_description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const statusFromUrl = searchParams.get('status') || '';
      const overdueFromUrl = searchParams.get('is_overdue') || '';
      const searchFromUrl = searchParams.get('search') || '';
      const pageFromUrl = parseInt(searchParams.get('page') || '1');

      if (statusFromUrl) setFilterStatus(statusFromUrl);
      if (overdueFromUrl) setFilterOverdue(overdueFromUrl);
      if (searchFromUrl) setSearchKeyword(searchFromUrl);
      setPage(pageFromUrl);

      const [listResult, statsResult] = await Promise.all([
        api.getApplications({
          page: pageFromUrl,
          page_size: pageSize,
          status: statusFromUrl || undefined,
          is_overdue: overdueFromUrl ? overdueFromUrl === 'true' : undefined,
          search: searchFromUrl || undefined,
        }),
        api.getStatistics(),
      ]);

      setApplications(listResult.items);
      setTotal(listResult.total);
      setStatistics(statsResult);
      setSelectedIds([]);
    } catch (e: any) {
      showMessage('error', e.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const totalPages = Math.ceil(total / pageSize);

  const handleFilterChange = () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterOverdue) params.is_overdue = filterOverdue;
    if (searchKeyword) params.search = searchKeyword;
    params.page = '1';
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterOverdue) params.is_overdue = filterOverdue;
    if (searchKeyword) params.search = searchKeyword;
    params.page = String(newPage);
    setSearchParams(params);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(applications.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const isAllSelected = useMemo(() => {
    return applications.length > 0 && selectedIds.length === applications.length;
  }, [selectedIds, applications]);

  const getStatusOptions = () => {
    const role = user.role as Role;
    const options: { value: string; label: string }[] = [{ value: '', label: '全部状态' }];

    if (role === 'registrar') {
      options.push(
        { value: 'draft', label: '草稿' },
        { value: 'submitted', label: '待审核' },
        { value: 'under_review', label: '审核中' },
        { value: 'correction_requested', label: '待补正' },
        { value: 'corrected', label: '已补正' },
        { value: 'audit_passed', label: '待复核' },
        { value: 'rejected', label: '已拒绝' },
        { value: 'review_passed', label: '复核通过' },
        { value: 'archived', label: '已归档' }
      );
    } else if (role === 'audit_supervisor') {
      options.push(
        { value: 'submitted', label: '待审核' },
        { value: 'corrected', label: '已补正' },
        { value: 'under_review', label: '审核中' },
        { value: 'correction_requested', label: '待补正（已发）' },
        { value: 'audit_passed', label: '审核通过' },
        { value: 'rejected', label: '已拒绝' }
      );
    } else if (role === 'review_leader') {
      options.push(
        { value: 'audit_passed', label: '待复核' },
        { value: 'review_passed', label: '复核通过' },
        { value: 'archived', label: '已归档' }
      );
    }

    return options;
  };

  const getBatchActions = () => {
    const role = user.role as Role;
    const actions: { value: string; label: string; type: string }[] = [];

    if (role === 'audit_supervisor') {
      actions.push({ value: 'start_audit', label: '批量开始审核', type: 'primary' });
      actions.push({ value: 'audit_pass', label: '批量审核通过', type: 'success' });
    } else if (role === 'review_leader') {
      actions.push({ value: 'review_pass', label: '批量复核通过', type: 'success' });
      actions.push({ value: 'archive', label: '批量归档', type: 'default' });
    }

    return actions;
  };

  const handleStatClick = (status: string, isOverdue?: boolean) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (isOverdue !== undefined) params.is_overdue = String(isOverdue);
    params.page = '1';
    setSearchParams(params);
  };

  const handleCreateSubmit = async () => {
    if (!newAppForm.company_name || !newAppForm.contact_person || !newAppForm.contact_phone) {
      showMessage('error', '请填写必填项（公司名称、联系人、联系电话）');
      return;
    }

    try {
      const data: any = {
        company_name: newAppForm.company_name,
        contact_person: newAppForm.contact_person,
        contact_phone: newAppForm.contact_phone,
      };
      if (newAppForm.contact_email) data.contact_email = newAppForm.contact_email;
      if (newAppForm.booth_type) data.booth_type = newAppForm.booth_type;
      if (newAppForm.booth_size) data.booth_size = newAppForm.booth_size;
      if (newAppForm.expected_area) data.expected_area = parseFloat(newAppForm.expected_area);
      if (newAppForm.industry) data.industry = newAppForm.industry;
      if (newAppForm.product_description) data.product_description = newAppForm.product_description;

      await api.createApplication(data);
      setShowCreateModal(false);
      setNewAppForm({
        company_name: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        booth_type: '',
        booth_size: '',
        expected_area: '',
        industry: '',
        product_description: '',
      });
      showMessage('success', '创建成功');
      loadData();
    } catch (e: any) {
      showMessage('error', e.message || '创建失败');
    }
  };

  const handleBatchSubmit = async () => {
    if (!batchAction) {
      showMessage('error', '请选择批量操作');
      return;
    }

    try {
      const result = await api.batchAction(selectedIds, batchAction, batchRemark || undefined);
      const successCount = result.success.length;
      const failCount = result.failed.length;
      let msg = `批量操作完成：成功 ${successCount} 条`;
      if (failCount > 0) msg += `，失败 ${failCount} 条`;
      showMessage(failCount > 0 ? 'warning' : 'success', msg);
      setShowBatchModal(false);
      setBatchAction('');
      setBatchRemark('');
      loadData();
    } catch (e: any) {
      showMessage('error', e.message || '批量操作失败');
    }
  };

  const canCreate = user.role === 'registrar';
  const canBatch =
    (user.role === 'audit_supervisor' || user.role === 'review_leader') && selectedIds.length > 0;

  const statCards = useMemo(() => {
    if (!statistics) return [];
    const stats = statistics;
    const role = user.role as Role;
    const cards: Array<{ label: string; value: number; type: string; status?: string; isOverdue?: boolean }> = [];

    if (role === 'registrar') {
      cards.push({ label: '全部申请', value: stats.total, type: 'primary', status: '' });
      cards.push({ label: '草稿', value: stats.draft, type: 'default', status: 'draft' });
      cards.push({ label: '待审核', value: stats.pending_audit, type: 'warning', status: 'submitted' });
      cards.push({ label: '待补正', value: stats.pending_correction, type: 'danger', status: 'correction_requested' });
      cards.push({ label: '待复核', value: stats.pending_review, type: 'warning', status: 'audit_passed' });
      cards.push({ label: '已通过', value: stats.passed, type: 'success', status: 'review_passed' });
    } else if (role === 'audit_supervisor') {
      cards.push({ label: '待处理', value: stats.pending_audit, type: 'warning', status: 'submitted' });
      cards.push({ label: '审核中', value: stats.under_review, type: 'primary', status: 'under_review' });
      cards.push({ label: '待补正', value: stats.pending_correction, type: 'danger', status: 'correction_requested' });
      cards.push({ label: '逾期申请', value: stats.overdue, type: 'danger', status: '', isOverdue: true });
      cards.push({ label: '已通过', value: stats.pending_review, type: 'success', status: 'audit_passed' });
      cards.push({ label: '已拒绝', value: stats.rejected, type: 'default', status: 'rejected' });
    } else if (role === 'review_leader') {
      cards.push({ label: '待复核', value: stats.pending_review, type: 'warning', status: 'audit_passed' });
      cards.push({ label: '复核通过', value: stats.review_passed, type: 'success', status: 'review_passed' });
      cards.push({ label: '已归档', value: stats.archived, type: 'default', status: 'archived' });
      cards.push({ label: '逾期复核', value: stats.review_overdue, type: 'danger', status: 'audit_passed', isOverdue: true });
    }

    return cards;
  }, [statistics, user.role]);

  const handleSearchKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilterChange();
    }
  };

  return (
    <div>
      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '16px' }}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">展商申请列表</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 新建申请
            </button>
          )}
          <button className="btn btn-default" onClick={loadData} disabled={loading}>
            刷新
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            className="stat-card"
            onClick={() => handleStatClick(card.status || '', card.isOverdue)}
          >
            <div className={`stat-number stat-${card.type}`}>{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        ))}
      </div>

      {canBatch && (
        <div className="batch-bar">
          <span>
            已选择 <strong>{selectedIds.length}</strong> 条申请
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {getBatchActions().map((action) => (
              <button
                key={action.value}
                className={`btn btn-${action.type} btn-sm`}
                onClick={() => {
                  setBatchAction(action.value);
                  setShowBatchModal(true);
                }}
              >
                {action.label}
              </button>
            ))}
            <button className="btn btn-default btn-sm" onClick={() => setSelectedIds([])}>
              取消选择
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <div className="filter-item">
            <label>状态：</label>
            <select
              className="select"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setTimeout(handleFilterChange, 0);
              }}
            >
              {getStatusOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>逾期：</label>
            <select
              className="select"
              value={filterOverdue}
              onChange={(e) => {
                setFilterOverdue(e.target.value);
                setTimeout(handleFilterChange, 0);
              }}
            >
              <option value="">全部</option>
              <option value="true">仅逾期</option>
              <option value="false">未逾期</option>
            </select>
          </div>
          <div className="filter-item" style={{ flex: 1, maxWidth: '300px' }}>
            <input
              className="form-input"
              type="text"
              placeholder="搜索申请编号、公司名称、联系人..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyUp={handleSearchKeyUp}
            />
          </div>
          <button className="btn btn-primary" onClick={handleFilterChange}>
            搜索
          </button>
        </div>

        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : applications.length === 0 ? (
          <div className="empty-state">暂无数据</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    {canBatch && (
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                      />
                    )}
                  </th>
                  <th>申请编号</th>
                  <th>公司名称</th>
                  <th>联系人</th>
                  <th>联系电话</th>
                  <th>展位类型</th>
                  <th>状态</th>
                  <th>状态变更时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>
                      {canBatch && (
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.includes(app.id)}
                          onChange={(e) => toggleSelectOne(app.id, e.target.checked)}
                        />
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{app.application_no}</td>
                    <td>
                      {app.company_name}
                      {app.is_overdue && <span className="overdue-tag">逾期</span>}
                    </td>
                    <td>{app.contact_person}</td>
                    <td>{app.contact_phone}</td>
                    <td>{app.booth_type || '-'}</td>
                    <td>
                      <span className={`status-tag status-${app.status}`}>
                        {statusLabels[app.status]}
                      </span>
                    </td>
                    <td style={{ color: '#666', fontSize: '13px' }}>
                      {formatDate(app.status_changed_at)}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/applications/${app.id}`)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span style={{ marginRight: '12px', color: '#666' }}>共 {total} 条</span>
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                上一页
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`page-btn ${page === pageNum ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">新建展商申请</span>
              <span className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </span>
            </div>
            <div className="modal-body">
              <div className="form-item">
                <label className="form-label">公司名称 *</label>
                <input
                  className="form-input"
                  type="text"
                  value={newAppForm.company_name}
                  onChange={(e) => setNewAppForm({ ...newAppForm, company_name: e.target.value })}
                  placeholder="请输入公司名称"
                />
              </div>
              <div className="form-item">
                <label className="form-label">联系人 *</label>
                <input
                  className="form-input"
                  type="text"
                  value={newAppForm.contact_person}
                  onChange={(e) => setNewAppForm({ ...newAppForm, contact_person: e.target.value })}
                  placeholder="请输入联系人姓名"
                />
              </div>
              <div className="form-item">
                <label className="form-label">联系电话 *</label>
                <input
                  className="form-input"
                  type="text"
                  value={newAppForm.contact_phone}
                  onChange={(e) => setNewAppForm({ ...newAppForm, contact_phone: e.target.value })}
                  placeholder="请输入联系电话"
                />
              </div>
              <div className="form-item">
                <label className="form-label">邮箱</label>
                <input
                  className="form-input"
                  type="email"
                  value={newAppForm.contact_email}
                  onChange={(e) => setNewAppForm({ ...newAppForm, contact_email: e.target.value })}
                  placeholder="请输入邮箱"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-item">
                  <label className="form-label">展位类型</label>
                  <select
                    className="select"
                    style={{ width: '100%' }}
                    value={newAppForm.booth_type}
                    onChange={(e) => setNewAppForm({ ...newAppForm, booth_type: e.target.value })}
                  >
                    <option value="">请选择</option>
                    <option value="标准展位">标准展位</option>
                    <option value="光地展位">光地展位</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">展位尺寸</label>
                  <input
                    className="form-input"
                    type="text"
                    value={newAppForm.booth_size}
                    onChange={(e) => setNewAppForm({ ...newAppForm, booth_size: e.target.value })}
                    placeholder="如：3m×3m"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-item">
                  <label className="form-label">预计面积(㎡)</label>
                  <input
                    className="form-input"
                    type="number"
                    value={newAppForm.expected_area}
                    onChange={(e) => setNewAppForm({ ...newAppForm, expected_area: e.target.value })}
                    placeholder="请输入面积"
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">所属行业</label>
                  <input
                    className="form-input"
                    type="text"
                    value={newAppForm.industry}
                    onChange={(e) => setNewAppForm({ ...newAppForm, industry: e.target.value })}
                    placeholder="请输入行业"
                  />
                </div>
              </div>
              <div className="form-item">
                <label className="form-label">产品/服务描述</label>
                <textarea
                  className="form-input form-textarea"
                  value={newAppForm.product_description}
                  onChange={(e) => setNewAppForm({ ...newAppForm, product_description: e.target.value })}
                  placeholder="请简要描述产品或服务"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreateSubmit}>
                创建草稿
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => setShowBatchModal(false)}>
          <div className="modal" style={{ width: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">批量操作</span>
              <span className="modal-close" onClick={() => setShowBatchModal(false)}>
                ×
              </span>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                已选择 <strong>{selectedIds.length}</strong> 条申请进行批量处理
              </p>
              <div className="form-item">
                <label className="form-label">操作类型</label>
                <select
                  className="select"
                  style={{ width: '100%' }}
                  value={batchAction}
                  onChange={(e) => setBatchAction(e.target.value)}
                >
                  <option value="">请选择操作</option>
                  {getBatchActions().map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-item">
                <label className="form-label">备注</label>
                <textarea
                  className="form-input form-textarea"
                  value={batchRemark}
                  onChange={(e) => setBatchRemark(e.target.value)}
                  placeholder="可选，填写批量处理备注"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowBatchModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleBatchSubmit}>
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
