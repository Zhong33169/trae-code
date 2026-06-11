import { createSignal, onMount, For } from 'solid-js';
import { useParams, useNavigate } from '../router/index.js';
import { expenseApi } from '../api/expenseApi';
import { useToast } from '../stores/toastStore';
import { useAuth } from '../stores/authStore';
import AuditLogList from '../components/AuditLogList.jsx';
import ActionModal from '../components/ActionModal.jsx';

function ExpenseDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { userInfo } = useAuth();

  const [expense, setExpense] = createSignal(null);
  const [auditLogs, setAuditLogs] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);
  const [actionModal, setActionModal] = createSignal({ visible: false, type: '', title: '' });
  const [activeTab, setActiveTab] = createSignal('info');

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await expenseApi.getDetail(params.id);
      if (res.success) {
        setExpense(res.data);
      }
    } catch (err) {
      toast.error(err.message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await expenseApi.getAuditLogs(params.id);
      if (res.success) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error('加载审计记录失败:', err);
    }
  };

  onMount(() => {
    loadDetail();
    loadAuditLogs();
  });

  const refresh = () => {
    loadDetail();
    loadAuditLogs();
  };

  const openActionModal = (type, title) => {
    setActionModal({ visible: true, type, title });
  };

  const closeActionModal = () => {
    setActionModal({ visible: false, type: '', title: '' });
  };

  const handleAction = async (type, data) => {
    if (!expense()) return;

    setSubmitting(true);
    try {
      let res;
      const version = expense().version;

      switch (type) {
        case 'submit':
          res = await expenseApi.submit(params.id, version);
          break;
        case 'startVerify':
          res = await expenseApi.startVerify(params.id, version);
          break;
        case 'passVerify':
          res = await expenseApi.passVerify(params.id, { ...data, version });
          break;
        case 'rejectVerify':
          res = await expenseApi.rejectVerify(params.id, { ...data, version });
          break;
        case 'requestSupplement':
          res = await expenseApi.requestSupplement(params.id, { ...data, version });
          break;
        case 'passReview':
          res = await expenseApi.passReview(params.id, { ...data, version });
          break;
        case 'rejectReview':
          res = await expenseApi.rejectReview(params.id, { ...data, version });
          break;
        default:
          return;
      }

      if (res.success) {
        toast.success('操作成功');
        closeActionModal();
        refresh();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAmount = (amount) => {
    return '¥' + Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
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

  const canSubmit = () => {
    if (!expense() || !userInfo()) return false;
    return expense().status === 'draft' && userInfo().role === 'clerk' && expense().creator === userInfo().id;
  };

  const canStartVerify = () => {
    if (!expense() || !userInfo()) return false;
    return expense().status === 'submitted' && userInfo().role === 'accountant';
  };

  const canPassVerify = () => {
    if (!expense() || !userInfo()) return false;
    return expense().status === 'verifying' && userInfo().role === 'accountant' && expense().currentHandler === userInfo().id;
  };

  const canRejectVerify = () => canPassVerify();
  const canRequestSupplement = () => canPassVerify();

  const canPassReview = () => {
    if (!expense() || !userInfo()) return false;
    return expense().status === 'pending_review' && userInfo().role === 'manager';
  };

  const canRejectReview = () => canPassReview();

  if (loading()) {
    return <div class="loading">加载中...</div>;
  }

  if (!expense()) {
    return <div class="empty-state">报销申请不存在</div>;
  }

  const statusTag = getStatusTag(expense().status);
  const deadlineInfo = expense().deadlineInfo;

  return (
    <div class="expense-detail">
      <style>{`
        .expense-detail { }
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .back-btn {
          margin-bottom: 16px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #595959;
          cursor: pointer;
          font-size: 14px;
        }
        .back-btn:hover { color: #1890ff; }
        .detail-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .detail-title h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }
        .detail-sub {
          color: #8c8c8c;
          font-size: 13px;
        }
        .detail-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .detail-body {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 20px;
        }
        @media (max-width: 1024px) {
          .detail-body { grid-template-columns: 1fr; }
        }
        .main-panel { }
        .side-panel { display: flex; flex-direction: column; gap: 16px; }
        .info-card {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .info-card-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .info-item { }
        .info-label {
          font-size: 12px;
          color: #8c8c8c;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 14px;
          color: #262626;
          font-weight: 500;
        }
        .info-value.amount {
          color: #ff4d4f;
          font-size: 18px;
          font-weight: 600;
        }
        .deadline-card {
          background: #fff;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .deadline-card.overdue { border-left: 4px solid #ff4d4f; }
        .deadline-card.warning { border-left: 4px solid #faad14; }
        .deadline-card.normal { border-left: 4px solid #52c41a; }
        .deadline-title {
          font-size: 13px;
          color: #595959;
          margin-bottom: 8px;
        }
        .deadline-value {
          font-size: 14px;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .deadline-status {
          font-size: 16px;
          font-weight: 600;
        }
        .deadline-status.overdue { color: #ff4d4f; }
        .deadline-status.warning { color: #faad14; }
        .deadline-status.normal { color: #52c41a; }
        .handler-card {
          background: #fff;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .handler-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .handler-row:last-child { margin-bottom: 0; }
        .handler-label {
          font-size: 12px;
          color: #8c8c8c;
        }
        .handler-info {
          text-align: right;
        }
        .handler-name {
          font-weight: 500;
          color: #262626;
        }
        .handler-dept {
          font-size: 12px;
          color: #8c8c8c;
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid #f0f0f0;
          margin-bottom: 16px;
        }
        .tab-item {
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          color: #595959;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }
        .tab-item.active {
          color: #1890ff;
          border-bottom-color: #1890ff;
          font-weight: 500;
        }
        .opinion-section {
          margin-top: 16px;
          padding: 16px;
          background: #fafafa;
          border-radius: 8px;
        }
        .opinion-title {
          font-size: 13px;
          font-weight: 600;
          color: #595959;
          margin-bottom: 8px;
        }
        .opinion-content {
          font-size: 14px;
          color: #262626;
          line-height: 1.6;
        }
        .exception-banner {
          background: #fff2f0;
          border: 1px solid #ffccc7;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          color: #ff4d4f;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .exception-icon { font-size: 18px; }
      `}</style>

      <div class="back-btn" onClick={() => navigate('/expenses')}>
        ← 返回列表
      </div>

      <div class="detail-header">
        <div>
          <div class="detail-title">
            <h2>{expense().title}</h2>
            <span class={`tag ${statusTag.class}`}>{statusTag.text}</span>
          </div>
          <div class="detail-sub">
            编号：{expense().id} · 创建于 {formatDate(expense().createdAt)}
          </div>
        </div>
        <div class="detail-actions">
          <button class="btn btn-sm" onClick={refresh}>🔄 刷新</button>
          {canSubmit() && (
            <button class="btn btn-primary btn-sm" onClick={() => openActionModal('submit', '提交报销申请')}>
              提交申请
            </button>
          )}
          {canStartVerify() && (
            <button class="btn btn-primary btn-sm" onClick={() => openActionModal('startVerify', '开始核验')}>
              开始核验
            </button>
          )}
          {canPassVerify() && (
            <>
              <button class="btn btn-success btn-sm" onClick={() => openActionModal('passVerify', '核验通过')}>
                核验通过
              </button>
              <button class="btn btn-warning btn-sm" onClick={() => openActionModal('requestSupplement', '要求补材料')}>
                要求补材料
              </button>
              <button class="btn btn-danger btn-sm" onClick={() => openActionModal('rejectVerify', '核验驳回')}>
                核验驳回
              </button>
            </>
          )}
          {canPassReview() && (
            <>
              <button class="btn btn-success btn-sm" onClick={() => openActionModal('passReview', '复核通过')}>
                复核通过
              </button>
              <button class="btn btn-danger btn-sm" onClick={() => openActionModal('rejectReview', '复核驳回')}>
                复核驳回
              </button>
            </>
          )}
        </div>
      </div>

      {expense().exceptionReason && (
        <div class="exception-banner">
          <span class="exception-icon">⚠️</span>
          <div>
            <div style={{ fontWeight: 500, 'margin-bottom': '4px' }}>异常情况</div>
            <div>{expense().exceptionReason}</div>
          </div>
        </div>
      )}

      <div class="detail-body">
        <div class="main-panel">
          <div class="info-card">
            <div class="tabs">
              <div
                class={`tab-item ${activeTab() === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                基本信息
              </div>
              <div
                class={`tab-item ${activeTab() === 'materials' ? 'active' : ''}`}
                onClick={() => setActiveTab('materials')}
              >
                材料清单
              </div>
              <div
                class={`tab-item ${activeTab() === 'opinions' ? 'active' : ''}`}
                onClick={() => setActiveTab('opinions')}
              >
                处理意见
              </div>
            </div>

            {activeTab() === 'info' && (
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">申请人</div>
                  <div class="info-value">{expense().applicant || '-'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">所属部门</div>
                  <div class="info-value">{expense().applicantDept || '-'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">报销类型</div>
                  <div class="info-value">{expense().expenseTypeLabel || '-'}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">报销金额</div>
                  <div class="info-value amount">{formatAmount(expense().amount)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">创建时间</div>
                  <div class="info-value">{formatDate(expense().createdAt)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">更新时间</div>
                  <div class="info-value">{formatDate(expense().updatedAt)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">数据版本</div>
                  <div class="info-value">v{expense().version}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">当前状态</div>
                  <div class="info-value">
                    <span class={`tag ${statusTag.class}`}>{statusTag.text}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab() === 'materials' && (
              <div>
                {expense().materials && expense().materials.length > 0 ? (
                  <ul style={{ 'padding-left': '20px' }}>
                    <For each={expense().materials}>
                      {(material) => (
                        <li style={{ 'margin-bottom': '8px' }}>{material}</li>
                      )}
                    </For>
                  </ul>
                ) : (
                  <div class="empty-state" style={{ padding: '40px' }}>
                    暂无材料清单
                  </div>
                )}
              </div>
            )}

            {activeTab() === 'opinions' && (
              <div>
                {expense().verifyOpinion && (
                  <div class="opinion-section">
                    <div class="opinion-title">💡 核验意见（{expense().lastHandlerName || '费用会计'}）</div>
                    <div class="opinion-content">{expense().verifyOpinion}</div>
                  </div>
                )}
                {expense().reviewOpinion && (
                  <div class="opinion-section" style={{ 'margin-top': '12px' }}>
                    <div class="opinion-title">📋 复核意见（财务经理）</div>
                    <div class="opinion-content">{expense().reviewOpinion}</div>
                  </div>
                )}
                {!expense().verifyOpinion && !expense().reviewOpinion && (
                  <div class="empty-state" style={{ padding: '40px' }}>
                    暂无处理意见
                  </div>
                )}
              </div>
            )}
          </div>

          <div class="info-card">
            <div class="info-card-title">🔍 审计记录</div>
            <AuditLogList logs={auditLogs()} />
          </div>
        </div>

        <div class="side-panel">
          <div class={`deadline-card ${deadlineInfo.isOverdue ? 'overdue' : deadlineInfo.isWarning ? 'warning' : 'normal'}`}>
            <div class="deadline-title">⏰ 截止时间</div>
            <div class="deadline-value">{formatDate(expense().deadline)}</div>
            <div class={`deadline-status ${deadlineInfo.isOverdue ? 'overdue' : deadlineInfo.isWarning ? 'warning' : 'normal'}`}>
              {deadlineInfo.isOverdue ? '🔴 ' : deadlineInfo.isWarning ? '🟡 ' : '🟢 '}
              {deadlineInfo.text}
            </div>
          </div>

          <div class="handler-card">
            <div class="handler-row">
              <span class="handler-label">当前处理人</span>
              <div class="handler-info">
                <div class="handler-name">{expense().currentHandlerName || '-'}</div>
                <div class="handler-dept">{expense().currentHandlerDept || ''}</div>
              </div>
            </div>
            <div class="handler-row">
              <span class="handler-label">最近处理人</span>
              <div class="handler-info">
                <div class="handler-name">{expense().lastHandlerName || '-'}</div>
                <div class="handler-dept">{formatDate(expense().lastHandleTime)}</div>
              </div>
            </div>
            <div class="handler-row">
              <span class="handler-label">最近处理结果</span>
              <div class="handler-info">
                <div class="handler-name" style={{ 'font-size': '13px', 'font-weight': 'normal' }}>
                  {expense().lastResult || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ActionModal
        visible={actionModal().visible}
        title={actionModal().title}
        type={actionModal().type}
        onClose={closeActionModal}
        onSubmit={(data) => handleAction(actionModal().type, data)}
        submitting={submitting()}
      />
    </div>
  );
}

export default ExpenseDetail;
