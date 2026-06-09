import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { useNavigate } from '../router';
import { useUser } from '../contexts/UserContext';
import { api } from '../services/api';
import {
  TreatmentPlan,
  TreatmentPlanStatus,
  UrgencyLevel,
  statusLabels,
  urgencyLabels,
  UserRole,
} from '../types';
import './PlanList.css';
import CreatePlanModal from '../components/CreatePlanModal';
import BatchOperationModal from '../components/BatchOperationModal';

const PlanList = () => {
  const navigate = useNavigate();
  const { currentUser, hasRole } = useUser();
  const [plans, setPlans] = createSignal<TreatmentPlan[]>([]);
  const [total, setTotal] = createSignal(0);
  const [stats, setStats] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(false);
  const [statusFilter, setStatusFilter] = createSignal<string>('');
  const [urgencyFilter, setUrgencyFilter] = createSignal<string>('');
  const [keyword, setKeyword] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal<string[]>([]);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showBatchModal, setShowBatchModal] = createSignal(false);
  const [batchAction, setBatchAction] = createSignal<string>('');

  const loadData = async () => {
    if (!currentUser()) return;
    setLoading(true);
    try {
      const data = await api.getPlans({
        status: statusFilter(),
        urgency: urgencyFilter(),
        keyword: keyword(),
        userId: currentUser()?.id,
        role: currentUser()?.role,
      });
      setPlans(data.list);
      setTotal(data.total);
      setStats(data.stats);
    } catch (e) {
      console.error('加载列表失败', e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  createEffect(() => {
    if (currentUser()) {
      loadData();
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getUrgencyClass = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case UrgencyLevel.OVERDUE: return 'urgency-overdue';
      case UrgencyLevel.WARNING: return 'urgency-warning';
      default: return 'urgency-normal';
    }
  };

  const getStatusClass = (status: TreatmentPlanStatus) => {
    switch (status) {
      case TreatmentPlanStatus.DRAFT: return 'status-draft';
      case TreatmentPlanStatus.PENDING_VERIFICATION: return 'status-pending';
      case TreatmentPlanStatus.VERIFICATION_REJECTED: return 'status-rejected';
      case TreatmentPlanStatus.PENDING_REVIEW: return 'status-pending';
      case TreatmentPlanStatus.REVIEW_REJECTED: return 'status-rejected';
      case TreatmentPlanStatus.ARCHIVED: return 'status-archived';
      default: return '';
    }
  };

  const handleRowClick = (id: string) => {
    navigate(`/plans/${id}`);
  };

  const toggleSelect = (id: string, e: Event) => {
    e.stopPropagation();
    const current = selectedIds();
    if (current.includes(id)) {
      setSelectedIds(current.filter(i => i !== id));
    } else {
      setSelectedIds([...current, id]);
    }
  };

  const toggleSelectAll = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.checked) {
      setSelectedIds(plans().map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const openBatchModal = (action: string) => {
    if (selectedIds().length === 0) return;
    setBatchAction(action);
    setShowBatchModal(true);
  };

  const handleBatchSuccess = () => {
    setSelectedIds([]);
    setShowBatchModal(false);
    loadData();
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadData();
  };

  const getQueueLabel = () => {
    if (!currentUser()) return '全部';
    switch (currentUser()!.role) {
      case UserRole.RECEPTIONIST: return '我的待办（前台）';
      case UserRole.DENTIST: return '我的待办（医生）';
      case UserRole.DIRECTOR: return '我的待办（院长）';
      default: return '全部';
    }
  };

  const canBatchSubmit = () => {
    if (!currentUser() || selectedIds().length === 0) return false;
    const selectedPlans = plans().filter(p => selectedIds().includes(p.id));
    return hasRole(UserRole.RECEPTIONIST) &&
      selectedPlans.every(p =>
        [TreatmentPlanStatus.DRAFT, TreatmentPlanStatus.VERIFICATION_REJECTED].includes(p.status)
      );
  };

  const canBatchVerify = () => {
    if (!currentUser() || selectedIds().length === 0) return false;
    const selectedPlans = plans().filter(p => selectedIds().includes(p.id));
    return hasRole(UserRole.DENTIST) &&
      selectedPlans.every(p => p.status === TreatmentPlanStatus.PENDING_VERIFICATION);
  };

  const canBatchReview = () => {
    if (!currentUser() || selectedIds().length === 0) return false;
    const selectedPlans = plans().filter(p => selectedIds().includes(p.id));
    return hasRole(UserRole.DIRECTOR) &&
      selectedPlans.every(p => p.status === TreatmentPlanStatus.PENDING_REVIEW);
  };

  return (
    <div class="plan-list-page">
      <div class="page-header">
        <h2 class="page-title">{getQueueLabel()}</h2>
        <div class="header-actions">
          <Show when={hasRole(UserRole.RECEPTIONIST)}>
            <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 新建计划单
            </button>
          </Show>
        </div>
      </div>

      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-value">{stats()?.total || 0}</div>
          <div class="stat-label">总计</div>
        </div>
        <div class="stat-card stat-warning">
          <div class="stat-value">{stats()?.warning || 0}</div>
          <div class="stat-label">临期</div>
        </div>
        <div class="stat-card stat-danger">
          <div class="stat-value">{stats()?.overdue || 0}</div>
          <div class="stat-label">逾期</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats()?.pendingVerification || 0}</div>
          <div class="stat-label">待核验</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats()?.pendingReview || 0}</div>
          <div class="stat-label">待复核</div>
        </div>
        <div class="stat-card stat-success">
          <div class="stat-value">{stats()?.archived || 0}</div>
          <div class="stat-label">已归档</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left">
          <div class="filter-item">
            <label>状态：</label>
            <select value={statusFilter()} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value={TreatmentPlanStatus.DRAFT}>草稿</option>
              <option value={TreatmentPlanStatus.PENDING_VERIFICATION}>待核验</option>
              <option value={TreatmentPlanStatus.VERIFICATION_REJECTED}>核验退回</option>
              <option value={TreatmentPlanStatus.PENDING_REVIEW}>待复核</option>
              <option value={TreatmentPlanStatus.REVIEW_REJECTED}>复核退回</option>
              <option value={TreatmentPlanStatus.ARCHIVED}>已归档</option>
            </select>
          </div>
          <div class="filter-item">
            <label>预警：</label>
            <select value={urgencyFilter()} onChange={(e) => setUrgencyFilter(e.target.value)}>
              <option value="">全部</option>
              <option value={UrgencyLevel.NORMAL}>正常</option>
              <option value={UrgencyLevel.WARNING}>临期</option>
              <option value={UrgencyLevel.OVERDUE}>逾期</option>
            </select>
          </div>
          <div class="filter-item">
            <input
              type="text"
              placeholder="搜索单号/患者姓名/电话"
              value={keyword()}
              onInput={(e) => setKeyword(e.target.value)}
              class="search-input"
            />
          </div>
          <button class="btn btn-default" onClick={loadData}>刷新</button>
        </div>
        <div class="filter-right">
          <span class="selected-count">已选 {selectedIds().length} 项</span>
          <Show when={canBatchSubmit()}>
            <button class="btn btn-primary btn-sm" onClick={() => openBatchModal('submit')}>
              批量提交核验
            </button>
          </Show>
          <Show when={canBatchVerify()}>
            <button class="btn btn-success btn-sm" onClick={() => openBatchModal('verify_pass')}>
              批量核验通过
            </button>
            <button class="btn btn-warning btn-sm" onClick={() => openBatchModal('verify_reject')}>
              批量核验退回
            </button>
          </Show>
          <Show when={canBatchReview()}>
            <button class="btn btn-success btn-sm" onClick={() => openBatchModal('review_pass')}>
              批量复核通过
            </button>
            <button class="btn btn-warning btn-sm" onClick={() => openBatchModal('review_reject')}>
              批量复核退回
            </button>
          </Show>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">
                <input
                  type="checkbox"
                  checked={selectedIds().length === plans().length && plans().length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>计划单号</th>
              <th>患者姓名</th>
              <th>联系电话</th>
              <th>门店</th>
              <th>状态</th>
              <th>到期预警</th>
              <th>截止日期</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <Show when={!loading() && plans().length > 0}>
              <For each={plans()}>
                {(plan) => (
                  <tr
                    class="table-row"
                    onClick={() => handleRowClick(plan.id)}
                    classList={{
                      'row-overdue': plan.urgencyLevel === UrgencyLevel.OVERDUE,
                      'row-warning': plan.urgencyLevel === UrgencyLevel.WARNING,
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds().includes(plan.id)}
                        onChange={(e) => toggleSelect(plan.id, e)}
                      />
                    </td>
                    <td class="plan-no">{plan.planNo}</td>
                    <td>{plan.patientName}</td>
                    <td>{plan.patientPhone}</td>
                    <td>{plan.store}</td>
                    <td>
                      <span class={`status-tag ${getStatusClass(plan.status)}`}>
                        {statusLabels[plan.status]}
                      </span>
                    </td>
                    <td>
                      <span class={`urgency-tag ${getUrgencyClass(plan.urgencyLevel)}`}>
                        {urgencyLabels[plan.urgencyLevel]}
                        <span class="days-text">
                          ({getDaysRemaining(plan.deadline) > 0
                            ? `剩${getDaysRemaining(plan.deadline)}天`
                            : `超${Math.abs(getDaysRemaining(plan.deadline))}天`})
                        </span>
                      </span>
                    </td>
                    <td>{formatDate(plan.deadline)}</td>
                    <td>{formatDate(plan.createdAt)}</td>
                    <td class="action-cell">
                      <button class="link-btn" onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/plans/${plan.id}`);
                      }}>
                        详情
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </Show>
            <Show when={!loading() && plans().length === 0}>
              <tr>
                <td colspan="10" class="empty-cell">暂无数据</td>
              </tr>
            </Show>
            <Show when={loading()}>
              <tr>
                <td colspan="10" class="empty-cell">加载中...</td>
              </tr>
            </Show>
          </tbody>
        </table>
      </div>

      <Show when={showCreateModal()}>
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </Show>

      <Show when={showBatchModal()}>
        <BatchOperationModal
          action={batchAction()}
          selectedIds={selectedIds()}
          onClose={() => setShowBatchModal(false)}
          onSuccess={handleBatchSuccess}
        />
      </Show>
    </div>
  );
};

export default PlanList;
