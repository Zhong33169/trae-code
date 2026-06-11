import { createSignal, onMount, createEffect } from "solid-js";
import { useNavigate, useParams } from "@solidjs/router";
import Layout from "~/components/Layout";
import Modal from "~/components/Modal";
import { api } from "~/lib/api";
import { authStore, statusNames, statusTagTypes, cropTypeNames, nodeStatusNames } from "~/store/auth";
import { formatDate, getTimeRemaining } from "~/utils/date";
import { showToast } from "~/store/toast";

export default function TaskDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const taskId = parseInt(params.id, 10);

  const [task, setTask] = createSignal<any>(null);
  const [nodes, setNodes] = createSignal<any[]>([]);
  const [logs, setLogs] = createSignal<any[]>([]);
  const [loading, setLoading] = createSignal(true);

  const [showRegisterModal, setShowRegisterModal] = createSignal(false);
  const [showAuditModal, setShowAuditModal] = createSignal(false);
  const [showReviewModal, setShowReviewModal] = createSignal(false);

  const [auditPassed, setAuditPassed] = createSignal(true);
  const [rejectReason, setRejectReason] = createSignal("");
  const [abnormalReason, setAbnormalReason] = createSignal("");
  const [remark, setRemark] = createSignal("");
  const [actionLoading, setActionLoading] = createSignal(false);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const result = await api.getTaskDetail(taskId);
      setTask(result.data.task);
      setNodes(result.data.nodes);
      setLogs(result.data.operationLogs);
    } catch (err: any) {
      showToast(err.message || "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadDetail();
  });

  const canRegister = () => {
    if (!authStore.hasRole("registrar")) return false;
    const status = task()?.status;
    return status === "pending_registration" || status === "audit_rejected";
  };

  const canAudit = () => {
    if (!authStore.hasRole("auditor")) return false;
    const status = task()?.status;
    return status === "registered" || status === "review_rejected";
  };

  const canReview = () => {
    if (!authStore.hasRole("reviewer")) return false;
    return task()?.status === "audit_passed";
  };

  const isRegistrar = () => authStore.hasRole("registrar");
  const isAuditor = () => authStore.hasRole("auditor");
  const isReviewer = () => authStore.hasRole("reviewer");

  const handleRegister = async () => {
    setActionLoading(true);
    try {
      await api.registerTask(taskId);
      showToast("登记提交成功", "success");
      setShowRegisterModal(false);
      loadDetail();
    } catch (err: any) {
      showToast(err.message || "操作失败", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!auditPassed() && !rejectReason().trim()) {
      showToast("请填写驳回原因", "warning");
      return;
    }

    setActionLoading(true);
    try {
      await api.auditTask({
        taskId,
        passed: auditPassed(),
        rejectReason: rejectReason(),
        abnormalReason: abnormalReason(),
        remark: remark(),
      });
      showToast(auditPassed() ? "审核通过" : "审核驳回", "success");
      setShowAuditModal(false);
      resetForm();
      loadDetail();
    } catch (err: any) {
      showToast(err.message || "操作失败", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    if (!auditPassed() && !rejectReason().trim()) {
      showToast("请填写驳回原因", "warning");
      return;
    }

    setActionLoading(true);
    try {
      await api.reviewTask({
        taskId,
        passed: auditPassed(),
        rejectReason: rejectReason(),
        abnormalReason: abnormalReason(),
        remark: remark(),
      });
      showToast(auditPassed() ? "复核通过，已归档" : "复核驳回", "success");
      setShowReviewModal(false);
      resetForm();
      loadDetail();
    } catch (err: any) {
      showToast(err.message || "操作失败", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const resetForm = () => {
    setAuditPassed(true);
    setRejectReason("");
    setAbnormalReason("");
    setRemark("");
  };

  const openAuditModal = () => {
    resetForm();
    setShowAuditModal(true);
  };

  const openReviewModal = () => {
    resetForm();
    setShowReviewModal(true);
  };

  const getNodeClass = (node: any) => {
    if (node.isTimeout && node.status !== "completed" && node.status !== "rejected") {
      return "timeout";
    }
    if (node.status === "completed") return "completed";
    if (node.status === "rejected") return "rejected";
    if (node.status === "processing") return "active";
    return "";
  };

  const getCurrentNode = () => {
    const t = task();
    if (!t) return null;
    if (t.currentNodeIndex >= nodes().length) return null;
    return nodes()[t.currentNodeIndex];
  };

  return (
    <Layout>
      {loading() ? (
        <div class="loading">加载中...</div>
      ) : task() ? (
        <>
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">
                种植任务详情
                <span class={`tag tag-${statusTagTypes[task().status] || "default"}`} style="margin-left: 12px;">
                  {statusNames[task().status]}
                </span>
                {task().hasTimeout && (
                  <span class="tag tag-error" style="margin-left: 8px;">
                    ⚠ 存在超时节点
                  </span>
                )}
              </h2>
              <button class="btn btn-default" onClick={() => navigate("/tasks")}>
                返回列表
              </button>
            </div>

            <div class="detail-section">
              <h3>基本信息</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">任务编号：</span>
                  <span class="value">{task().taskNo}</span>
                </div>
                <div class="detail-item">
                  <span class="label">任务名称：</span>
                  <span class="value">{task().taskName}</span>
                </div>
                <div class="detail-item">
                  <span class="label">作物类型：</span>
                  <span class="value">{cropTypeNames[task().cropType] || task().cropType}</span>
                </div>
                <div class="detail-item">
                  <span class="label">种植面积：</span>
                  <span class="value">{task().plantingArea} 亩</span>
                </div>
                <div class="detail-item">
                  <span class="label">种植地点：</span>
                  <span class="value">{task().location}</span>
                </div>
                <div class="detail-item">
                  <span class="label">种植户：</span>
                  <span class="value">{task().planterName}</span>
                </div>
                <div class="detail-item">
                  <span class="label">联系电话：</span>
                  <span class="value">{task().planterPhone}</span>
                </div>
                <div class="detail-item">
                  <span class="label">创建时间：</span>
                  <span class="value">{formatDate(task().createdAt)}</span>
                </div>
                {task().registeredByName && (
                  <div class="detail-item">
                    <span class="label">登记人：</span>
                    <span class="value">{task().registeredByName}</span>
                  </div>
                )}
                {task().registeredAt && (
                  <div class="detail-item">
                    <span class="label">登记时间：</span>
                    <span class="value">{formatDate(task().registeredAt)}</span>
                  </div>
                )}
                {(isAuditor() || isReviewer()) && task().auditorName && (
                  <div class="detail-item">
                    <span class="label">审核人：</span>
                    <span class="value">{task().auditorName}</span>
                  </div>
                )}
                {(isAuditor() || isReviewer()) && task().auditAt && (
                  <div class="detail-item">
                    <span class="label">审核时间：</span>
                    <span class="value">{formatDate(task().auditAt)}</span>
                  </div>
                )}
                {isReviewer() && task().reviewerName && (
                  <div class="detail-item">
                    <span class="label">复核人：</span>
                    <span class="value">{task().reviewerName}</span>
                  </div>
                )}
                {isReviewer() && task().reviewAt && (
                  <div class="detail-item">
                    <span class="label">复核时间：</span>
                    <span class="value">{formatDate(task().reviewAt)}</span>
                  </div>
                )}
                {task().archivedAt && (
                  <div class="detail-item">
                    <span class="label">归档时间：</span>
                    <span class="value">{formatDate(task().archivedAt)}</span>
                  </div>
                )}
              </div>
              {task().description && (
                <div style="margin-top: 12px;">
                  <span class="label">任务描述：</span>
                  <span class="value">{task().description}</span>
                </div>
              )}
              {task().hasTimeout && (
                <div style="margin-top: 12px; padding: 10px 14px; background: #fff2f0; border: 1px solid #ffccc7; border-radius: 4px;">
                  <span style="color: #ff4d4f; font-weight: 600;">⚠ 超时预警：</span>
                  <span style="color: #ff4d4f; margin-left: 6px;">
                    {task().timeoutNodeName || "当前节点"}已超时
                    {task().timeoutHandlerName && `，责任人：${task().timeoutHandlerName}`}
                    ，请及时补正处理
                  </span>
                </div>
              )}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">处理节点进度</h2>
            </div>

            <div class="timeline">
              {nodes().map((node) => {
                const timeInfo =
                  node.status !== "completed" && node.status !== "rejected"
                    ? getTimeRemaining(node.deadlineAt)
                    : null;

                return (
                  <div class={`timeline-item ${getNodeClass(node)}`}>
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <span class="timeline-title">
                          {node.nodeName}
                          {node.isTimeout && node.status !== "completed" && node.status !== "rejected" && (
                            <span class="timeline-timeout-badge">已超时 {node.timeoutHours} 小时</span>
                          )}
                        </span>
                        <span class="timeline-time">
                          <span class="tag tag-default">{nodeStatusNames[node.status]}</span>
                        </span>
                      </div>

                      <div class="timeline-detail">
                        <p>截止时间：{formatDate(node.deadlineAt)}</p>
                        {timeInfo && (
                          <p style={{ color: timeInfo.isTimeout ? "#ff4d4f" : "#52c41a" }}>
                            {timeInfo.text}
                          </p>
                        )}
                        {node.handlerName && <p>处理人：{node.handlerName}</p>}
                        {node.completedAt && <p>完成时间：{formatDate(node.completedAt)}</p>}
                        {node.remark && <p>备注：{node.remark}</p>}
                      </div>

                      {node.rejectReason && (
                        <div class="timeline-reason">
                          <strong>驳回原因：</strong>
                          {node.rejectReason}
                        </div>
                      )}

                      {node.abnormalReason && (
                        <div class="timeline-reason" style="background: #fff7e6; border-color: #ffd591;">
                          <strong style="color: #d46b08;">异常原因：</strong>
                          <span style="color: #d46b08;">{node.abnormalReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">操作记录</h2>
            </div>

            {logs().length === 0 ? (
              <div class="empty">暂无操作记录</div>
            ) : (
              <ul class="log-list">
                {logs().map((log) => (
                  <li class="log-item" key={log.id}>
                    <div class="log-item-header">
                      <span class="log-type">{log.operationName}</span>
                      <span class="log-time">{formatDate(log.createdAt)}</span>
                    </div>
                    <div class="log-detail">{log.detail}</div>
                    {log.abnormalReason && (
                      <div class="log-detail" style={{ color: "#ff4d4f" }}>
                        异常原因：{log.abnormalReason}
                      </div>
                    )}
                    <div class="log-operator">
                      操作人：{log.operatorName || "系统"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(canRegister() || canAudit() || canReview()) && (
            <div class="card">
              <div class="card-header">
                <h2 class="card-title">操作</h2>
              </div>

              <div class="action-bar">
                {canRegister() && (
                  <button class="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
                    {task().status === "pending_registration" ? "提交登记" : "提交补正重审"}
                  </button>
                )}

                {canAudit() && (
                  <button class="btn btn-primary" onClick={openAuditModal}>
                    {task().status === "review_rejected" ? "重新办理审核" : "办理审核"}
                  </button>
                )}

                {canReview() && (
                  <button class="btn btn-primary" onClick={openReviewModal}>
                    办理复核归档
                  </button>
                )}
              </div>
            </div>
          )}

          <Modal
            visible={showRegisterModal()}
            title={task()?.status === "pending_registration" ? "提交登记" : "提交补正"}
            onClose={() => setShowRegisterModal(false)}
            onConfirm={handleRegister}
            confirmText="确认提交"
            loading={actionLoading()}
          >
            <p>确认提交该种植任务？</p>
            <p style="margin-top: 8px; color: #666; font-size: 13px;">
              提交后将进入下一处理节点，请确保信息准确无误。
            </p>
          </Modal>

          <Modal
            visible={showAuditModal()}
            title="种植任务审核"
            onClose={() => setShowAuditModal(false)}
            onConfirm={handleAudit}
            confirmText={auditPassed() ? "通过审核" : "驳回申请"}
            confirmType={auditPassed() ? "primary" : "danger"}
            loading={actionLoading()}
          >
            <div class="form-item">
              <label class="form-label required">审核结果</label>
              <div style="display: flex; gap: 20px;">
                <label>
                  <input
                    type="radio"
                    checked={auditPassed()}
                    onChange={() => setAuditPassed(true)}
                  />
                  审核通过
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!auditPassed()}
                    onChange={() => setAuditPassed(false)}
                  />
                  审核驳回
                </label>
              </div>
            </div>

            {!auditPassed() && (
              <div class="form-item">
                <label class="form-label required">驳回原因</label>
                <textarea
                  class="form-textarea"
                  placeholder="请填写驳回原因"
                  value={rejectReason()}
                  onInput={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            <div class="form-item">
              <label class="form-label">异常原因</label>
              <textarea
                class="form-textarea"
                placeholder="如有异常情况请填写（选填）"
                value={abnormalReason()}
                onInput={(e) => setAbnormalReason(e.target.value)}
              />
            </div>

            <div class="form-item">
              <label class="form-label">备注</label>
              <textarea
                class="form-textarea"
                placeholder="请填写备注信息（选填）"
                value={remark()}
                onInput={(e) => setRemark(e.target.value)}
              />
            </div>
          </Modal>

          <Modal
            visible={showReviewModal()}
            title="种植任务复核归档"
            onClose={() => setShowReviewModal(false)}
            onConfirm={handleReview}
            confirmText={auditPassed() ? "复核通过并归档" : "驳回申请"}
            confirmType={auditPassed() ? "primary" : "danger"}
            loading={actionLoading()}
          >
            <div class="form-item">
              <label class="form-label required">复核结果</label>
              <div style="display: flex; gap: 20px;">
                <label>
                  <input
                    type="radio"
                    checked={auditPassed()}
                    onChange={() => setAuditPassed(true)}
                  />
                  复核通过并归档
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!auditPassed()}
                    onChange={() => setAuditPassed(false)}
                  />
                  复核驳回
                </label>
              </div>
            </div>

            {!auditPassed() && (
              <div class="form-item">
                <label class="form-label required">驳回原因</label>
                <textarea
                  class="form-textarea"
                  placeholder="请填写驳回原因"
                  value={rejectReason()}
                  onInput={(e) => setRejectReason(e.target.value)}
                />
              </div>
            )}

            <div class="form-item">
              <label class="form-label">异常原因</label>
              <textarea
                class="form-textarea"
                placeholder="如有异常情况请填写（选填）"
                value={abnormalReason()}
                onInput={(e) => setAbnormalReason(e.target.value)}
              />
            </div>

            <div class="form-item">
              <label class="form-label">备注</label>
              <textarea
                class="form-textarea"
                placeholder="请填写备注信息（选填）"
                value={remark()}
                onInput={(e) => setRemark(e.target.value)}
              />
            </div>
          </Modal>
        </>
      ) : (
        <div class="empty">任务不存在</div>
      )}
    </Layout>
  );
}
