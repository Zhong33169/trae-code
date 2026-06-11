import { createSignal, createEffect, onMount, For } from 'solid-js';
import { useNavigate } from '../router/index.js';
import { expenseApi } from '../api/expenseApi';
import { useToast } from '../stores/toastStore';
import { useAuth } from '../stores/authStore';
import { useStatsRefresh } from '../stores/statsRefreshStore';
import BatchActions from '../components/BatchActions.jsx';
import CreateModal from '../components/CreateModal.jsx';

function ExpenseList() {
  const [list, setList] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [statusFilter, setStatusFilter] = createSignal('');
  const [warningFilter, setWarningFilter] = createSignal('');
  const [keyword, setKeyword] = createSignal('');
  const [selectedIds, setSelectedIds] = createSignal([]);
  const [showCreate, setShowCreate] = createSignal(false);
  const [refetchKey, setRefetchKey] = createSignal(0);

  const navigate = useNavigate();
  const toast = useToast();
  const { userInfo } = useAuth();
  const { triggerStatsRefresh } = useStatsRefresh();

  const loadList = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter()) params.status = statusFilter();
      if (warningFilter()) params.warningLevel = warningFilter();
      if (keyword()) params.keyword = keyword();

      const res = await expenseApi.getList(params);
      if (res.success) {
        setList(res.data);
        const ids = res.data.map(item => item.id);
        setSelectedIds(prev => prev.filter(id => ids.includes(id)));
      }
    } catch (err) {
      toast.error(err.message || '加载列表失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(loadList);

  createEffect(() => {
    if (refetchKey() > 0) {
      loadList();
    }
  });

  const refresh = () => {
    setRefetchKey(prev => prev + 1);
    triggerStatsRefresh();
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setTimeout(loadList, 0);
  };

  const handleWarningChange = (level) => {
    setWarningFilter(prev => prev === level ? '' : level);
    setTimeout(loadList, 0);
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      loadList();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds().length === list().length && list().length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list().map(item => item.id));
    }
  };

  const getStatusTag = (status) => {
    const map = {
      draft: { class: 'tag-default', text: '草稿' },
      submitted: { class: 'tag-info', text: '待核验' },
      verifying: { class: 'tag-warning', text: '核验中' },
      pending_review: { class: 'tag-primary', text: '待复核' },
      approved: { class: 'tag-success', text: '已通过' },
      rejected: { class: 'tag-danger', text: '已驳回' },
      archived: { class: 'tag-default', text: '已归档' },
    };
    return map[status] || { class: 'tag-default', text: status };
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount) => {
    return '¥' + Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  };

  const canBatchVerify = () => {
    if (!userInfo() || userInfo().role !== 'accountant') return false;
    return selectedIds().some(id => {
      const item = list().find(i => i.id === id);
      return item && item.status === 'submitted';
    });
  };

  const canBatchReview = () => {
    if (!userInfo() || userInfo().role !== 'manager') return false;
    return selectedIds().some(id => {
      const item = list().find(i => i.id === id);
      return item && item.status === 'pending_review';
    });
  };

  return (
    <div class="expense-list">
      <style>{`
        .expense-list { }
        .filter-bar {
          background: #fff;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-label {
          font-size: 13px;
          color: #595959;
          white-space: nowrap;
        }
        .filter-select {
          padding: 6px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 13px;
          min-width: 120px;
        }
        .search-input {
          padding: 6px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 13px;
          width: 200px;
        }
        .warning-filters {
          display: flex;
          gap: 8px;
        }
        .warning-btn {
          padding: 6px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          background: #fff;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .warning-btn.active-overdue { background: #fff2f0; border-color: #ffccc7; color: #ff4d4f; }
        .warning-btn.active-warning { background: #fffbe6; border-color: #ffe58f; color: #faad14; }
        .warning-btn.active-normal { background: #f6ffed; border-color: #b7eb8f; color: #52c41a; }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .toolbar-left { display: flex; align-items: center; gap: 12px; }
        .selected-count { font-size: 13px; color: #595959; }
        .table-container {
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th {
          background: #fafafa;
          padding: 12px 12px;
          text-align: left;
          font-weight: 500;
          color: #595959;
          border-bottom: 1px solid #f0f0f0;
          white-space: nowrap;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          vertical-align: middle;
        }
        tr:hover { background: #fafafa; }
        tr.selected { background: #e6f7ff; }
        tr.overdue-row { background: #fff2f0; }
        tr.overdue-row:hover { background: #fff1f0; }
        tr.warning-row { background: #fffbe6; }
        tr.warning-row:hover { background: #fffbe6; }
        .checkbox-col { width: 40px; text-align: center; }
        .deadline-cell { white-space: nowrap; }
        .deadline-text { font-size: 12px; margin-top: 2px; }
        .deadline-overdue { color: #ff4d4f; font-weight: 500; }
        .deadline-warning { color: #faad14; font-weight: 500; }
        .deadline-normal { color: #52c41a; }
        .title-cell { font-weight: 500; color: #262626; cursor: pointer; }
        .title-cell:hover { color: #1890ff; }
        .sub-info { font-size: 12px; color: #8c8c8c; margin-top: 2px; }
        .amount-cell { font-weight: 600; color: #262626; white-space: nowrap; }
        .exception-text { font-size: 12px; color: #ff4d4f; }
        .last-result { font-size: 12px; color: #595959; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .handler-cell { white-space: nowrap; }
        .handler-name { font-weight: 500; }
        .handler-dept { font-size: 12px; color: #8c8c8c; }
        .action-cell { white-space: nowrap; }
        .material-cell { white-space: nowrap; }
        .material-complete { color: #52c41a; font-weight: 500; }
        .material-incomplete { color: #faad14; font-weight: 500; }
        .material-missing { font-size: 11px; color: #8c8c8c; margin-top: 2px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .link-btn {
          background: none;
          border: none;
          color: #1890ff;
          cursor: pointer;
          font-size: 13px;
          padding: 0;
        }
        .link-btn:hover { text-decoration: underline; }
        .empty-state { padding: 60px 20px; text-align: center; color: #8c8c8c; }
      `}</style>

      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">状态：</span>
          <select class="filter-select" value={statusFilter()} onChange={handleStatusChange}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="submitted">待核验</option>
            <option value="verifying">核验中</option>
            <option value="pending_review">待复核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">预警：</span>
          <div class="warning-filters">
            <button
              class={`warning-btn ${warningFilter() === 'overdue' ? 'active-overdue' : ''}`}
              onClick={() => handleWarningChange('overdue')}
            >
              🔴 已逾期
            </button>
            <button
              class={`warning-btn ${warningFilter() === 'warning' ? 'active-warning' : ''}`}
              onClick={() => handleWarningChange('warning')}
            >
              🟡 临期
            </button>
            <button
              class={`warning-btn ${warningFilter() === 'normal' ? 'active-normal' : ''}`}
              onClick={() => handleWarningChange('normal')}
            >
              🟢 正常
            </button>
          </div>
        </div>

        <div class="filter-group" style={{ 'margin-left': 'auto' }}>
          <input
            type="text"
            class="search-input"
            placeholder="搜索标题/申请人/编号"
            value={keyword()}
            onInput={(e) => setKeyword(e.target.value)}
            onKeyDown={handleSearch}
          />
          <button class="btn btn-primary btn-sm" onClick={loadList}>搜索</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <span class="selected-count">
            已选择 <strong>{selectedIds().length}</strong> / {list().length} 项
          </span>
          {selectedIds().length > 0 && (
            <button class="btn btn-sm" onClick={() => setSelectedIds([])}>
              取消选择
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {userInfo()?.role === 'clerk' && (
            <button class="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              + 新建报销申请
            </button>
          )}
          <button class="btn btn-sm" onClick={refresh}>
            🔄 刷新
          </button>
        </div>
      </div>

      <BatchActions
        selectedIds={selectedIds()}
        list={list()}
        onRefresh={refresh}
        canBatchVerify={canBatchVerify()}
        canBatchReview={canBatchReview()}
      />

      <div class="table-container">
        {loading() ? (
          <div class="empty-state">加载中...</div>
        ) : list().length === 0 ? (
          <div class="empty-state">暂无报销申请数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    checked={list().length > 0 && selectedIds().length === list().length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>标题/编号</th>
                <th>申请人</th>
                <th>金额</th>
                <th>类型</th>
                <th>状态</th>
                <th>当前处理人</th>
                <th>截止时间</th>
                <th>材料状态</th>
                <th>异常原因</th>
                <th>最近处理结果</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={list()}>
                {(item) => {
                  const statusTag = getStatusTag(item.status);
                  const isSelected = selectedIds().includes(item.id);
                  const rowClass = item.deadlineInfo.isOverdue
                    ? 'overdue-row'
                    : item.deadlineInfo.isWarning
                    ? 'warning-row'
                    : '';

                  return (
                    <tr class={`${isSelected ? 'selected' : ''} ${rowClass}`}>
                      <td class="checkbox-col">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td>
                        <div
                          class="title-cell"
                          onClick={() => navigate(`/expenses/${item.id}`)}
                        >
                          {item.title}
                        </div>
                        <div class="sub-info">编号：{item.id}</div>
                      </td>
                      <td>
                        <div>{item.applicant}</div>
                        <div class="sub-info">{item.applicantDept}</div>
                      </td>
                      <td class="amount-cell">{formatAmount(item.amount)}</td>
                      <td>{item.expenseTypeLabel}</td>
                      <td>
                        <span class={`tag ${statusTag.class}`}>
                          {statusTag.text}
                        </span>
                      </td>
                      <td class="handler-cell">
                        {item.currentHandlerName ? (
                          <>
                            <div class="handler-name">{item.currentHandlerName}</div>
                            <div class="handler-dept">{item.currentHandlerDept}</div>
                          </>
                        ) : (
                          <span style={{ color: '#bfbfbf' }}>-</span>
                        )}
                      </td>
                      <td class="deadline-cell">
                        <div>{formatDate(item.deadline)}</div>
                        <div
                          class={`deadline-text ${
                            item.deadlineInfo.isOverdue
                              ? 'deadline-overdue'
                              : item.deadlineInfo.isWarning
                              ? 'deadline-warning'
                              : 'deadline-normal'
                          }`}
                        >
                          {item.deadlineInfo.isOverdue ? '⚠️ ' : item.deadlineInfo.isWarning ? '⏰ ' : '✅ '}
                          {item.deadlineInfo.text}
                        </div>
                      </td>
                      <td class="material-cell">
                        {item.materialInfo?.isComplete ? (
                          <div class="material-complete">✅ 齐全</div>
                        ) : (
                          <>
                            <div class="material-incomplete">⚠️ 不全</div>
                            <div
                              class="material-missing"
                              title={(item.materialInfo?.missingLabels || []).join('、')}
                            >
                              缺：{(item.materialInfo?.missingLabels || []).slice(0, 2).join('、')}
                              {(item.materialInfo?.missingLabels?.length || 0) > 2 ? '...' : ''}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        {item.exceptionReason ? (
                          <div class="exception-text">{item.exceptionReason}</div>
                        ) : (
                          <span style={{ color: '#bfbfbf' }}>-</span>
                        )}
                      </td>
                      <td>
                        <div class="last-result" title={item.lastResult || ''}>
                          {item.lastResult || '-'}
                        </div>
                        {item.lastHandlerName && (
                          <div class="sub-info">
                            {item.lastHandlerName} · {formatDate(item.lastHandleTime)}
                          </div>
                        )}
                      </td>
                      <td class="action-cell">
                        <button
                          class="link-btn"
                          onClick={() => navigate(`/expenses/${item.id}`)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        )}
      </div>

      <CreateModal
        visible={showCreate()}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          setShowCreate(false);
          refresh();
          toast.success('创建成功');
        }}
      />
    </div>
  );
}

export default ExpenseList;
