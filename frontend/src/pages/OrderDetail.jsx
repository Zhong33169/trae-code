import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';
import AddMaterialModal from '../components/AddMaterialModal';
import FeedbackModal from '../components/FeedbackModal';
import Toast from '../components/Toast';

const statusLabels = {
  draft: '草稿',
  pending_review: '待审核',
  reviewing: '审核中',
  pending_finalize: '待复核',
  finalizing: '复核中',
  completed: '已完成',
  rejected: '已驳回',
  returned: '已退回'
};

const serviceTypeLabels = {
  makeup_class: '补课',
  drop_class: '退课',
  transfer_class: '转课',
  trial_class: '试听'
};

const actionLabels = {
  create: '创建',
  submit: '提交审核',
  review_pass: '审核通过',
  review_reject: '审核驳回',
  finalize_pass: '复核通过',
  finalize_reject: '复核驳回',
  add_feedback: '添加反馈',
  add_material: '添加材料',
  delete_material: '删除材料',
};

const roleLabels = {
  registrar: '课程服务登记员',
  reviewer: '课程服务审核主管',
  finalizer: 'K12培训机构复核负责人',
};

const materialTypeLabels = {
  application: '申请单',
  certificate: '证明材料',
  schedule: '排班信息',
  record: '记录凭证',
  other: '其他材料'
};

function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [addMaterialVisible, setAddMaterialVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'info', message: '' });

  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => setToast({ visible: false, type: 'info', message: '' }), 3000);
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || '获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const canSubmit = user?.role === 'registrar' && ['draft', 'returned'].includes(order?.status);
  const canEditMaterial = user?.role === 'registrar' && ['draft', 'returned'].includes(order?.status) && user?.username === order?.register_by;
  const canReview = user?.role === 'reviewer' && ['pending_review', 'reviewing'].includes(order?.status);
  const canFinalize = user?.role === 'finalizer' && ['pending_finalize', 'finalizing'].includes(order?.status);
  const canAddFeedback = ['reviewer', 'finalizer'].includes(user?.role) && 
    ['pending_review', 'pending_finalize', 'reviewing', 'finalizing'].includes(order?.status);

  const handleSubmit = async () => {
    if (order?.version === undefined || order?.version === null) {
      showToast('error', '版本信息缺失，请刷新页面后重试');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/orders/${id}/submit`, { 
        opinion, 
        materials: [],
        version: order.version
      });
      setOrder(res.data);
      setOpinion('');
      showToast('success', '提交审核成功！');
    } catch (err) {
      const detail = err.response?.data?.detail || '操作失败';
      if (err.response?.status === 409) {
        showToast('error', `并发冲突：${detail}（保留输入，请刷新后重试）`);
      } else {
        showToast('error', detail);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReview = async (approved) => {
    if (order?.version === undefined || order?.version === null) {
      showToast('error', '版本信息缺失，请刷新页面后重试');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/orders/${id}/review`, { 
        approved, 
        opinion,
        version: order.version
      });
      setOrder(res.data);
      setOpinion('');
      showToast('success', approved ? '审核通过成功！' : '已驳回');
    } catch (err) {
      const detail = err.response?.data?.detail || '操作失败';
      if (err.response?.status === 409) {
        showToast('error', `并发冲突：${detail}（保留输入，请刷新后重试）`);
      } else {
        showToast('error', detail);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async (approved) => {
    if (order?.version === undefined || order?.version === null) {
      showToast('error', '版本信息缺失，请刷新页面后重试');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post(`/orders/${id}/finalize`, { 
        approved, 
        opinion,
        version: order.version
      });
      setOrder(res.data);
      setOpinion('');
      showToast('success', approved ? '复核归档成功！' : '已驳回');
    } catch (err) {
      const detail = err.response?.data?.detail || '操作失败';
      if (err.response?.status === 409) {
        showToast('error', `并发冲突：${detail}（保留输入，请刷新后重试）`);
      } else {
        showToast('error', detail);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!confirm('确定要删除这份材料吗？')) return;
    if (order?.version === undefined || order?.version === null) {
      showToast('error', '版本信息缺失，请刷新页面后重试');
      return;
    }
    try {
      const res = await api.delete(`/orders/${id}/materials/${materialId}?version=${order.version}`);
      setOrder(res.data);
      showToast('success', '材料已删除');
    } catch (err) {
      const detail = err.response?.data?.detail || '删除失败';
      if (err.response?.status === 409) {
        showToast('error', `并发冲突：${detail}（请刷新后重试）`);
      } else {
        showToast('error', detail);
      }
    }
  };

  const handleMaterialAdded = (updatedOrder) => {
    setOrder(updatedOrder);
    setAddMaterialVisible(false);
    showToast('success', '材料添加成功');
  };

  const handleFeedbackSubmitted = (updatedOrder) => {
    setOrder(updatedOrder);
    setFeedbackVisible(false);
    showToast('success', '课后反馈已提交');
  };

  const formatTimeRemaining = (info) => {
    if (!info || info.deadline === undefined) return null;
    if (info.expired) {
      return <span style={{ color: '#ff4d4f' }}>已超时</span>;
    }
    const hours = info.remaining_hours;
    if (hours < 1) {
      return <span style={{ color: '#fa8c16' }}>{Math.round(hours * 60)} 分钟</span>;
    }
    if (hours < 6) {
      return <span style={{ color: '#fa8c16' }}>{hours.toFixed(1)} 小时</span>;
    }
    return <span>{hours.toFixed(1)} 小时</span>;
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!order) return <div className="empty-state">服务单不存在</div>;

  const time_info = order.time_info || {};

  return (
    <div>
      <div className="page-header">
        <h2>
          <span onClick={() => navigate(-1)} style={{ cursor: 'pointer', marginRight: '12px' }}>←</span>
          服务单详情 - {order.order_no}
        </h2>
        <span className={`status-badge status-${order.status}`}>
          {statusLabels[order.status]}
        </span>
      </div>

      {time_info.deadline && (
        <div className={`alert ${time_info.expired ? 'alert-error' : 'alert-warning'}`} style={{ marginBottom: '16px' }}>
          ⏱️ 办理时限：截止 {time_info.deadline}
          （剩余 {formatTimeRemaining(time_info)}）
          ，共 {time_info.limit_hours} 小时
        </div>
      )}

      <div className="detail-container">
        <div>
          <div className="card">
            <h3>📋 基本信息</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">服务单号：</span>
                <span className="value">{order.order_no}</span>
              </div>
              <div className="info-item">
                <span className="label">服务类型：</span>
                <span className="value">{serviceTypeLabels[order.service_type]}</span>
              </div>
              <div className="info-item">
                <span className="label">创建时间：</span>
                <span className="value">{dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}</span>
              </div>
              <div className="info-item">
                <span className="label">版本号：</span>
                <span className="value">v{order.version}</span>
              </div>
              <div className="info-item">
                <span className="label">登记人：</span>
                <span className="value">{order.register_by || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">审核人：</span>
                <span className="value">{order.reviewer_by || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">复核人：</span>
                <span className="value">{order.finalizer_by || '-'}</span>
              </div>
              <div className="info-item">
                <span className="label">材料状态：</span>
                <span className="value">
                  {order.material_complete ? (
                    <span style={{ color: '#52c41a' }}>✓ 齐全</span>
                  ) : (
                    <span style={{ color: '#fa8c16' }}>⚠ 不完整</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>👤 学员档案</h3>
            {order.student ? (
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">学号：</span>
                  <span className="value">{order.student.student_no}</span>
                </div>
                <div className="info-item">
                  <span className="label">姓名：</span>
                  <span className="value">{order.student.name}</span>
                </div>
                <div className="info-item">
                  <span className="label">性别：</span>
                  <span className="value">{order.student.gender || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">年级：</span>
                  <span className="value">{order.student.grade || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">学校：</span>
                  <span className="value">{order.student.school || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">状态：</span>
                  <span className={`status-badge status-${order.student.status === 'active' ? 'completed' : 'rejected'}`}>
                    {order.student.status === 'active' ? '在读' : '已结业'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">监护人：</span>
                  <span className="value">{order.student.guardian_name || '-'}</span>
                </div>
                <div className="info-item">
                  <span className="label">联系电话：</span>
                  <span className="value">{order.student.guardian_phone || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state">学员信息异常</div>
            )}
            {order.student?.status !== 'active' && (
              <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                ⚠️ 学员档案状态异常，可能影响服务单推进
              </div>
            )}
          </div>

          <div className="card">
            <h3>📚 课程排班</h3>
            {order.course ? (
              <>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">课程编号：</span>
                    <span className="value">{order.course.course_code}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">课程名称：</span>
                    <span className="value">{order.course.name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">科目：</span>
                    <span className="value">{order.course.subject}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">总课时：</span>
                    <span className="value">{order.course.total_hours} 课时</span>
                  </div>
                </div>
                {order.schedule && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="label">上课日期：</span>
                        <span className="value">{order.schedule.schedule_date}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">上课时间：</span>
                        <span className="value">{order.schedule.start_time} - {order.schedule.end_time}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">授课教师：</span>
                        <span className="value">{order.schedule.teacher || order.course.teacher || '-'}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">教室：</span>
                        <span className="value">{order.schedule.classroom || order.course.classroom || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">课程信息异常</div>
            )}
            {order.course?.status !== 'active' && (
              <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                ⚠️ 课程已停用，可能影响服务单推进
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📎 材料清单</span>
              {canEditMaterial && (
                <button 
                  className="btn btn-sm" 
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setAddMaterialVisible(true)}
                >
                  + 添加材料
                </button>
              )}
            </h3>
            
            {order.missing_materials && order.missing_materials.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
                ⚠️ 缺少必备材料：{order.missing_materials.join('、')}
              </div>
            )}

            {order.materials && order.materials.length > 0 ? (
              <ul className="material-list">
                {order.materials.map((mat) => (
                  <li key={mat.id}>
                    <span>
                      <span className="material-type">
                        {materialTypeLabels[mat.material_type] || mat.material_type}
                      </span>
                      {' '}{mat.material_name}
                      <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                        {mat.uploaded_by} · {dayjs(mat.uploaded_at).format('MM-DD HH:mm')}
                      </span>
                    </span>
                    {canEditMaterial && (
                      <span 
                        className="action-link" 
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleDeleteMaterial(mat.id)}
                      >
                        删除
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state" style={{ padding: '20px' }}>暂无上传材料</div>
            )}
          </div>

          <div className="card">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📝 课后反馈</span>
              {canAddFeedback && (
                <button 
                  className="btn btn-sm" 
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setFeedbackVisible(true)}
                >
                  + 录入反馈
                </button>
              )}
            </h3>
            {order.feedback ? (
              <div className="feedback-card">
                <div className="feedback-row">
                  <span className="label">出勤情况：</span>
                  <span className="value">
                    {order.feedback.attendance === 'attended' ? '正常出勤' : 
                     order.feedback.attendance === 'absent' ? '缺勤' : order.feedback.attendance}
                  </span>
                </div>
                <div className="feedback-row">
                  <span className="label">课堂表现：</span>
                  <span className="value">{order.feedback.performance}</span>
                </div>
                <div className="feedback-row">
                  <span className="label">作业完成：</span>
                  <span className="value">{order.feedback.homework}</span>
                </div>
                <div className="feedback-row">
                  <span className="label">教师评语：</span>
                  <span className="value">{order.feedback.teacher_comment}</span>
                </div>
                <div className="feedback-row">
                  <span className="label">反馈人：</span>
                  <span className="value">{order.feedback.feedback_by}</span>
                </div>
                <div className="feedback-row">
                  <span className="label">反馈时间：</span>
                  <span className="value">{dayjs(order.feedback.feedback_time).format('YYYY-MM-DD HH:mm')}</span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px' }}>暂无课后反馈</div>
            )}
            {order.service_type && ['makeup_class', 'trial_class'].includes(order.service_type) && 
             order.status !== 'completed' && !order.feedback && (
              <div className="alert alert-warning" style={{ marginTop: '12px' }}>
                ⚠️ {serviceTypeLabels[order.service_type]}服务需要课后反馈，复核归档前需提交
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <h3>🔲 服务单二维码</h3>
            <div className="qr-code-display">
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📱</div>
              <div className="qr-value">{order.qr_code}</div>
            </div>
            <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
              扫码核验课程服务单
            </div>
          </div>

          <div className="card">
            <h3>⚙️ 操作区</h3>
            
            {canSubmit && (
              <div>
                <div className="alert alert-info">
                  您作为登记员，可以提交此服务单进入审核流程
                </div>
                <div className="opinion-section">
                  <textarea
                    placeholder="请输入登记意见（选填）"
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-success"
                  style={{ marginTop: '12px' }}
                  onClick={handleSubmit}
                  disabled={processing}
                >
                  {processing ? '提交中...' : '提交审核'}
                </button>
              </div>
            )}

            {canReview && (
              <div>
                <div className="alert alert-info">
                  您作为审核主管，请审核此服务单
                </div>
                <div className="opinion-section">
                  <textarea
                    placeholder="请输入审核意见"
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    className="btn btn-success"
                    onClick={() => handleReview(true)}
                    disabled={processing}
                  >
                    审核通过
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleReview(false)}
                    disabled={processing}
                  >
                    驳回
                  </button>
                </div>
              </div>
            )}

            {canFinalize && (
              <div>
                <div className="alert alert-info">
                  您作为复核负责人，请复核此服务单
                </div>
                <div className="opinion-section">
                  <textarea
                    placeholder="请输入复核意见"
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <button
                    className="btn btn-success"
                    onClick={() => handleFinalize(true)}
                    disabled={processing}
                  >
                    复核归档
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleFinalize(false)}
                    disabled={processing}
                  >
                    驳回
                  </button>
                </div>
              </div>
            )}

            {!canSubmit && !canReview && !canFinalize && (
              <div className="alert alert-warning">
                您当前角色在此状态下无操作权限
              </div>
            )}
          </div>

          <div className="card">
            <h3>📜 处理意见</h3>
            {order.register_opinion && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  登记意见：
                </div>
                <div style={{ fontSize: '14px', color: '#333', background: '#f9f9f9', padding: '8px 12px', borderRadius: '4px' }}>
                  {order.register_opinion}
                </div>
              </div>
            )}
            {order.review_opinion && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  审核意见：
                </div>
                <div style={{ fontSize: '14px', color: '#333', background: '#f9f9f9', padding: '8px 12px', borderRadius: '4px' }}>
                  {order.review_opinion}
                </div>
              </div>
            )}
            {order.finalize_opinion && (
              <div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  复核意见：
                </div>
                <div style={{ fontSize: '14px', color: '#333', background: '#f9f9f9', padding: '8px 12px', borderRadius: '4px' }}>
                  {order.finalize_opinion}
                </div>
              </div>
            )}
            {!order.register_opinion && !order.review_opinion && !order.finalize_opinion && (
              <div style={{ color: '#999', fontSize: '13px' }}>暂无处理意见</div>
            )}
          </div>

          <div className="card">
            <h3>🕐 审计日志</h3>
            {order.audit_logs && order.audit_logs.length > 0 ? (
              <div className="timeline">
                {order.audit_logs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="time">{dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                    <div className="action">{actionLabels[log.action] || log.action}</div>
                    <div className="operator">
                      {log.operator} · {roleLabels[log.operator_role] || log.operator_role}
                    </div>
                    {log.remark && <div className="remark">{log.remark}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '20px' }}>暂无审计记录</div>
            )}
          </div>
        </div>
      </div>

      {addMaterialVisible && (
        <AddMaterialModal
          visible={addMaterialVisible}
          onClose={() => setAddMaterialVisible(false)}
          orderId={order.id}
          version={order.version}
          onSuccess={handleMaterialAdded}
        />
      )}

      {feedbackVisible && (
        <FeedbackModal
          visible={feedbackVisible}
          onClose={() => setFeedbackVisible(false)}
          orderId={order.id}
          version={order.version}
          onSuccess={handleFeedbackSubmitted}
        />
      )}

      {toast.visible && (
        <Toast type={toast.type} message={toast.message} />
      )}
    </div>
  );
}

export default OrderDetail;
