import { createSignal, createEffect, onMount } from 'solid-js';
import { expenseApi } from '../api/expenseApi';
import { useAuth } from '../stores/authStore';
import { useToast } from '../stores/toastStore';
import { useNavigate, useParams } from '../router';
import AuditLogList from '../components/AuditLogList';
import ActionModal from '../components/ActionModal';

function ExpenseDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const { userInfo } = useAuth();
  const toast = useToast();

  const [expense, setExpense] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [auditLogs, setAuditLogs] = createSignal([]);
  const [materialConfig, setMaterialConfig] = createSignal(null);
  const [materialEditMode, setMaterialEditMode] = createSignal(false);
  const [editMaterials, setEditMaterials] = createSignal([]);

  const [modalType, setModalType] = createSignal('');
  const [modalVisible, setModalVisible] = createSignal(false);
  const [modalLoading, setModalLoading] = createSignal(false);

  const loadData = async () => {
    if (!params.id) return;
    setLoading(true);
    try {
      const [expenseRes, logsRes, configRes] = await Promise.all([
        expenseApi.getDetail(params.id),
        expenseApi.getAuditLogs(params.id),
        expenseApi.getMaterialConfig(),
      ]);
      if (expenseRes.success) {
        setExpense(expenseRes.data);
      }
      if (logsRes.success) {
        setAuditLogs(logsRes.data);
      }
      if (configRes.success) {
        setMaterialConfig(configRes.data);
      }
    } catch (err) {
      toast.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

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

  const canEditMaterials = () => {
    if (!expense() || !userInfo()) return false;
    return expense().status === 'draft' && userInfo().role === 'clerk' && expense().creator === userInfo().id;
  };

  const enterEditMaterial = () => {
    if (!canEditMaterials()) return;
    setEditMaterials([...expense().materials]);
    setMaterialEditMode(true);
  };

  const cancelEditMaterial = () => {
    setMaterialEditMode(false);
    setEditMaterials([]);
  };

  const toggleEditMaterial = (materialKey) => {
    setEditMaterials(prev => {
      if (prev.includes(materialKey)) {
        return prev.filter(m => m !== materialKey);
      }
      return [...prev, materialKey];
    });
  };

  const saveMaterials = async () => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.updateMaterials(expense().id, {
        materials: editMaterials(),
        version: expense().version,
      });
      if (res.success) {
        setExpense(res.data);
        setMaterialEditMode(false);
        toast.success('材料更新成功');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '保存失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.submit(expense().id, expense().version);
      if (res.success) {
        toast.success('提交成功');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '提交失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handleStartVerify = async () => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.startVerify(expense().id, expense().version);
      if (res.success) {
        toast.success('已开始核验');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handlePassVerify = async (opinion) => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.passVerify(expense().id, { opinion, version: expense().version });
      if (res.success) {
        toast.success('核验通过');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handleRejectVerify = async (reason) => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.rejectVerify(expense().id, { reason, version: expense().version });
      if (res.success) {
        toast.success('已驳回');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handleRequestSupplement = async (reason) => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.requestSupplement(expense().id, { reason, version: expense().version });
      if (res.success) {
        toast.success('已要求补材料');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handlePassReview = async (opinion) => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.passReview(expense().id, { opinion, version: expense().version });
      if (res.success) {
        toast.success('复核通过');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handleRejectReview = async (reason) => {
    if (!expense()) return;
    setModalLoading(true);
    try {
      const res = await expenseApi.rejectReview(expense().id, { reason, version: expense().version });
      if (res.success) {
        toast.success('已驳回');
        loadData();
      }
    } catch (err) {
      toast.error(err.message || '操作失败');
    } finally {
      setModalLoading(false);
      setModalVisible(false);
    }
  };

  const handleModalConfirm = (value) => {
    switch (modalType()) {
      case 'submit':
        handleSubmit();
        break;
      case 'startVerify':
        handleStartVerify();
        break;
      case 'passVerify':
        handlePassVerify(value);
        break;
      case 'rejectVerify':
        handleRejectVerify(value);
        break;
      case 'requestSupplement':
        handleRequestSupplement(value);
        break;
      case 'passReview':
        handlePassReview(value);
        break;
      case 'rejectReview':
        handleRejectReview(value);
        break;
    }
  };

  const getModalConfig = () => {
    switch (modalType()) {
      case 'submit':
        return {
          title: '确认提交',
          content: `确认提交报销申请「${expense()?.title}」？提交后将进入核验流程。`,
          needInput: false,
          confirmText: '确认提交',
        };
      case 'startVerify':
        return {
          title: '确认开始核验',
          content: `确认开始核验「${expense()?.title}」？核验后将由您负责处理。`,
          needInput: false,
          confirmText: '开始核验',
        };
      case 'passVerify':
        return {
          title: '核验通过',
          content: `请填写核验意见（至少5个字）：`,
          needInput: true,
          inputLabel: '核验意见',
          inputPlaceholder: '请输入核验意见...',
          minLength: 5,
          confirmText: '通过核验',
        };
      case 'rejectVerify':
        return {
          title: '核验驳回',
          content: `请填写驳回原因（至少5个字）：`,
          needInput: true,
          inputLabel: '驳回原因',
          inputPlaceholder: '请输入驳回原因...',
          minLength: 5,
          confirmText: '确认驳回',
          danger: true,
        };
      case 'requestSupplement':
        return {
          title: '要求补材料',
          content: `请填写补材料说明（至少5个字）：`,
          needInput: true,
          inputLabel: '补材料说明',
          inputPlaceholder: '请输入需要补充的材料说明...',
          minLength: 5,
          confirmText: '退回补材料',
          warning: true,
        };
      case 'passReview':
        return {
          title: '复核通过',
          content: `请填写复核意见：`,
          needInput: true,
          inputLabel: '复核意见',
          inputPlaceholder: '请输入复核意见...',
          minLength: 3,
          confirmText: '通过复核',
        };
      case 'rejectReview':
        return {
          title: '复核驳回',
          content: `请填写驳回原因（至少5个字）：`,
          needInput: true,
          inputLabel: '驳回原因',
          inputPlaceholder: '请输入驳回原因...',
          minLength: 5,
          confirmText: '确认驳回',
          danger: true,
        };
    }
  };

  if (loading()) {
    return <div class="loading">加载中...</div>;
  }

  if (!expense()) {
    return <div class="loading">报销申请不存在</div>;
  }

  const exp = expense();
  const mi = exp.materialInfo || {};
  const materialComplete = mi.isComplete;
  const deadlineInfo = exp.deadlineInfo || {};

  return (
    <div class="page">
      <div class="page-header">
        <button class="btn btn-back" onClick={() => navigate('/list')}>
          ← 返回列表
        </button>
        <div class="page-title">报销申请详情</div>
      </div>

      <div class="detail-grid">
        <div class="detail-main">
          <div class="card">
            <div class="card-header">
              <div class="card-title">{exp.title}</div>
              <div class={`status-tag status-${exp.status}`}>
                {exp.statusLabel}
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">申请人</div>
                <div class="info-value">{exp.applicant}</div>
              </div>
              <div class="info-item">
                <div class="info-label">所属部门</div>
                <div class="info-value">{exp.applicantDept}</div>
              </div>
              <div class="info-item">
                <div class="info-label">报销类型</div>
                <div class="info-value">{exp.expenseTypeLabel}</div>
              </div>
              <div class="info-item">
                <div class="info-label">金额</div>
                <div class="info-value amount">¥ {exp.amount.toLocaleString()}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">创建人</div>
                <div class="info-value">{exp.creatorName || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">当前处理人</div>
                <div class="info-value">{exp.currentHandlerName || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">版本号</div>
                <div class="info-value">v{exp.version}</div>
              </div>
            </div>

            <div class="info-section">
              <div class="info-label">截止时间</div>
              <div class={`deadline-display ${deadlineInfo.isOverdue ? 'overdue' : deadlineInfo.isWarning ? 'warning' : ''}`}>
                {new Date(exp.deadline).toLocaleString()}
                <span class="deadline-remaining">（{deadlineInfo.text}）</span>
              </div>
            </div>

            {exp.exceptionReason && (
              <div class="exception-section">
                <div class="exception-label">⚠️ 异常原因</div>
                <div class="exception-content">{exp.exceptionReason}</div>
              </div>
            )}

            <div class="info-section">
              <div class="section-header">
                <div class="info-label">
                  报销材料
                  <span class={`material-status-badge ${materialComplete ? 'badge-success' : 'badge-warning'}`}>
                    {materialComplete ? '材料齐全' : `缺少 ${mi.missingLabels?.length || 0} 项`}
                  </span>
                </div>
                {canEditMaterials() && !materialEditMode() && (
                  <button class="btn btn-sm btn-outline" onClick={enterEditMaterial}>
                    编辑材料
                  </button>
                )}
              </div>

              {materialConfig() && (
                materialEditMode() ? (
                  <div class="material-edit-box">
                    <div class="material-subtitle">选择材料（必填）</div>
                    <div class="material-grid">
                      {mi.required?.map((key, idx) => (
                        <div
                          key={key}
                          class={`material-checkbox ${editMaterials().includes(key) ? 'selected' : ''}`}
                          onClick={() => toggleEditMaterial(key)}
                        >
                          <div class="checkbox-icon">
                            {editMaterials().includes(key) ? '✓' : ''}
                          </div>
                          <div class="material-name">{mi.requiredLabels?.[idx] || key}</div>
                          {!editMaterials().includes(key) && (
                            <div class="material-required-tag">必填</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div class="material-edit-actions">
                      <button class="btn" onClick={cancelEditMaterial} disabled={modalLoading()}>
                        取消
                      </button>
                      <button class="btn btn-primary" onClick={saveMaterials} disabled={modalLoading()}>
                        {modalLoading() ? '保存中...' : '保存材料'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div class="material-display">
                    <div class="material-subtitle">
                      已上传材料（{mi.uploadedLabels?.length || 0} 项）
                    </div>
                    {mi.uploadedLabels?.length > 0 ? (
                      <div class="material-tag-list">
                        {mi.uploadedLabels.map((label, idx) => (
                          <span key={idx} class="material-tag material-tag-uploaded">
                            ✓ {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div class="material-empty">暂未上传任何材料</div>
                    )}

                    {mi.missingLabels?.length > 0 && (
                      <>
                        <div class="material-subtitle missing">
                          缺少材料（{mi.missingLabels.length} 项）
                        </div>
                        <div class="material-tag-list">
                          {mi.missingLabels.map((label, idx) => (
                            <span key={idx} class="material-tag material-tag-missing">
                              ✗ {label}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>

            {exp.verifyOpinion && (
              <div class="info-section">
                <div class="info-label">核验意见</div>
                <div class="opinion-content">{exp.verifyOpinion}</div>
              </div>
            )}

            {exp.reviewOpinion && (
              <div class="info-section">
                <div class="info-label">复核意见</div>
                <div class="opinion-content">{exp.reviewOpinion}</div>
              </div>
            )}

            {exp.lastResult && (
              <div class="info-section">
                <div class="info-label">最近处理结果</div>
                <div class="last-result">
                  <span class="last-result-text">{exp.lastResult}</span>
                  <span class="last-result-meta">
                    {exp.lastHandlerName} · {new Date(exp.lastHandleTime).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div class="card">
            <div class="card-header">
              <div class="card-title">操作记录</div>
            </div>
            <AuditLogList logs={auditLogs()} />
          </div>
        </div>

        <div class="detail-side">
          <div class="card action-card">
            <div class="card-header">
              <div class="card-title">可用操作</div>
            </div>
            <div class="action-list">
              {canSubmit() && (
                <button
                  class="action-btn action-primary"
                  disabled={!materialComplete}
                  onClick={() => {
                    if (!materialComplete) {
                      toast.warning('材料不齐全，无法提交，请先完善材料');
                      return;
                    }
                    setModalType('submit');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">✓</div>
                  <div class="action-info">
                    <div class="action-name">提交申请</div>
                    <div class="action-desc">
                      {materialComplete ? '提交后进入核验流程' : '请先完善必填材料'}
                    </div>
                  </div>
                </button>
              )}

              {canStartVerify() && (
                <button
                  class="action-btn action-primary"
                  onClick={() => {
                    setModalType('startVerify');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">👁</div>
                  <div class="action-info">
                    <div class="action-name">开始核验</div>
                    <div class="action-desc">
                      {materialComplete ? '材料齐全，可开始核验' : `材料不全（缺${mi.missingLabels?.length || 0}项）`}
                    </div>
                  </div>
                </button>
              )}

              {canPassVerify() && (
                <button
                  class="action-btn action-success"
                  onClick={() => {
                    setModalType('passVerify');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">✓</div>
                  <div class="action-info">
                    <div class="action-name">核验通过</div>
                    <div class="action-desc">材料核验无误，提交复核</div>
                  </div>
                </button>
              )}

              {canRequestSupplement() && (
                <button
                  class="action-btn action-warning"
                  onClick={() => {
                    setModalType('requestSupplement');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">📎</div>
                  <div class="action-info">
                    <div class="action-name">要求补材料</div>
                    <div class="action-desc">退回给创建者补充材料</div>
                  </div>
                </button>
              )}

              {canRejectVerify() && (
                <button
                  class="action-btn action-danger"
                  onClick={() => {
                    setModalType('rejectVerify');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">✕</div>
                  <div class="action-info">
                    <div class="action-name">核验驳回</div>
                    <div class="action-desc">拒绝此报销申请</div>
                  </div>
                </button>
              )}

              {canPassReview() && (
                <button
                  class="action-btn action-success"
                  onClick={() => {
                    setModalType('passReview');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">✓</div>
                  <div class="action-info">
                    <div class="action-name">复核通过</div>
                    <div class="action-desc">
                      {materialComplete ? '材料齐全，同意报销' : `材料不全（缺${mi.missingLabels?.length || 0}项），酌情处理`}
                    </div>
                  </div>
                </button>
              )}

              {canRejectReview() && (
                <button
                  class="action-btn action-danger"
                  onClick={() => {
                    setModalType('rejectReview');
                    setModalVisible(true);
                  }}
                >
                  <div class="action-icon">✕</div>
                  <div class="action-info">
                    <div class="action-name">复核驳回</div>
                    <div class="action-desc">拒绝此报销申请</div>
                  </div>
                </button>
              )}

              {!canSubmit() && !canStartVerify() && !canPassVerify() && !canPassReview() && (
                <div class="no-actions">
                  您当前没有可用的操作
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalVisible() && (
        <ActionModal
          visible={modalVisible()}
          config={getModalConfig()}
          loading={modalLoading()}
          onConfirm={handleModalConfirm}
          onClose={() => setModalVisible(false)}
        />
      )}
    </div>
  );
}

export default ExpenseDetail;
