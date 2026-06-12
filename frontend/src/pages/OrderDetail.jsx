import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '../utils/api';
import {
  STATUS_TEXT, NODE_TEXT, HAZARD_LEVEL_TEXT, RECHECK_RESULT_TEXT,
  formatTime, formatDate, getDeadlineRemain, ROLE_TEXT,
} from '../utils/format';
import Modal from '../components/Modal';
import { showToast } from '../components/Toast';

const NODE_ORDER = ['report', 'assign', 'rectify', 'recheck', 'confirm'];

function NodeSteps({ currentNode, isTimeout }) {
  const curIdx = NODE_ORDER.indexOf(currentNode);
  return (
    <div class="node-bar">
      {NODE_ORDER.map((n, idx) => {
        let cls = 'node-step';
        if (idx < curIdx) cls += ' done';
        else if (idx === curIdx) cls += isTimeout ? ' timeout' : ' active';
        return (
          <div key={n} class={cls}>
            {idx + 1}. {NODE_TEXT[n]}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail({ user, orderId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('base');
  const [submitting, setSubmitting] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState({ content: '', days: 7, remark: '' });

  const [showRectify, setShowRectify] = useState(false);
  const [rectifyForm, setRectifyForm] = useState({ content: '', images: '', remark: '' });

  const [showRecheck, setShowRecheck] = useState(false);
  const [recheckForm, setRecheckForm] = useState({ content: '', result: 'pass', images: '', remark: '' });

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmForm, setConfirmForm] = useState({ remark: '' });

  const [showTimeout, setShowTimeout] = useState(false);
  const [timeoutForm, setTimeoutForm] = useState({ timeout_reason: '', handle_action: '', add_days: 0, remark: '' });

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getOrder(orderId);
      setData(res);
    } catch (err) {
      showToast(err.message || '加载详情失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    const iv = setInterval(() => {
      fetchDetail();
    }, 30000);
    return () => clearInterval(iv);
  }, [fetchDetail]);

  const doAction = async (apiFn, form, modalSetter, successMsg) => {
    setSubmitting(true);
    try {
      await apiFn(orderId, form);
      showToast(successMsg, 'success');
      modalSetter(false);
      fetchDetail();
    } catch (err) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canAssign = user.role === 'supervisor' && data?.order?.status === 'pending';
  const canRectify = user.role === 'supervisor' && data?.order?.status === 'assigned' && data?.order?.current_node === 'rectify';
  const canRecheck = user.role === 'station_chief' && data?.order?.status === 'assigned' && data?.order?.current_node === 'recheck';
  const canConfirm = user.role === 'station_chief' && data?.order?.status === 'revisited';
  const canHandleTimeout = data?.order?.is_timeout;

  if (loading) return <div class="page-card"><div class="empty-state">加载中...</div></div>;
  if (!data) return <div class="page-card"><div class="empty-state">加载失败</div></div>;

  const o = data.order;
  const tabs = [
    { key: 'base', label: '基本信息' },
    { key: 'report', label: `隐患上报 (${data.reports?.length || 0})` },
    { key: 'notice', label: `整改通知 (${data.rectification_notices?.length || 0})` },
    { key: 'rectify', label: `整改记录 (${data.rectification_records?.length || 0})` },
    { key: 'recheck', label: `复查销项 (${data.recheck_records?.length || 0})` },
    { key: 'timeout', label: `超时记录 (${data.timeout_records?.length || 0})` },
    { key: 'logs', label: `操作记录 (${data.operation_logs?.length || 0})` },
  ];

  return (
    <div>
      <NodeSteps currentNode={o.current_node} isTimeout={o.is_timeout} />

      <div class="page-card" style={{ marginBottom: 16 }}>
        <div class="toolbar">
          <div class="toolbar-left">
            <span style={{ fontSize: 16, fontWeight: 600 }}>
              {o.order_no} - {o.title}
            </span>
            <span class={`status-tag status-${o.status}`} style={{ marginLeft: 8 }}>
              {STATUS_TEXT[o.status]}
            </span>
            <span class={`level-${o.hazard_level}`}>[{HAZARD_LEVEL_TEXT[o.hazard_level]}]</span>
            {o.is_timeout && <span class="timeout-tag">节点超时</span>}
          </div>
          <div class="toolbar-right">
            <button class="btn-default" onClick={fetchDetail}>刷新</button>
            {canHandleTimeout && (
              <button class="btn-warn" onClick={() => setShowTimeout(true)}>处理超时</button>
            )}
            {canAssign && (
              <button class="btn-primary" onClick={() => setShowAssign(true)}>转办分派</button>
            )}
            {canRectify && (
              <button class="btn-primary" onClick={() => setShowRectify(true)}>提交整改</button>
            )}
            {canRecheck && (
              <button class="btn-success" onClick={() => setShowRecheck(true)}>复查回访</button>
            )}
            {canConfirm && (
              <button class="btn-success" onClick={() => setShowConfirm(true)}>确认完成</button>
            )}
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-item"><span class="label">隐患单号</span><span class="value">{o.order_no}</span></div>
          <div class="detail-item"><span class="label">隐患等级</span><span class="value"><span class={`level-${o.hazard_level}`}>{HAZARD_LEVEL_TEXT[o.hazard_level]}</span></span></div>
          <div class="detail-item"><span class="label">隐患地点</span><span class="value">{o.location}</span></div>
          <div class="detail-item"><span class="label">当前节点</span>
            <span class="value">
              {o.is_timeout ? <span class="timeout-tag">超时</span> : null} {NODE_TEXT[o.current_node]}
            </span>
          </div>
          <div class="detail-item"><span class="label">上报人</span><span class="value">{o.reporter_name}</span></div>
          <div class="detail-item"><span class="label">防火监督员</span><span class="value">{o.supervisor_name || '未分派'}</span></div>
          <div class="detail-item"><span class="label">站点负责人</span><span class="value">{o.station_chief_name || '未确认'}</span></div>
          <div class="detail-item"><span class="label">整改截止</span>
            <span class="value">
              {o.rectify_deadline ? `${formatDate(o.rectify_deadline)}（${getDeadlineRemain(o.rectify_deadline)}）` : '-'}
            </span>
          </div>
          <div class="detail-item"><span class="label">复查截止</span>
            <span class="value">
              {o.recheck_deadline ? `${formatDate(o.recheck_deadline)}（${getDeadlineRemain(o.recheck_deadline)}）` : '-'}
            </span>
          </div>
          <div class="detail-item"><span class="label">创建时间</span><span class="value">{formatTime(o.created_at)}</span></div>
        </div>

        {o.description && (
          <div class="detail-item" style={{ marginTop: 12 }}>
            <span class="label">简要描述</span>
            <span class="value">{o.description}</span>
          </div>
        )}
      </div>

      <div class="page-card">
        <div class="tabs">
          {tabs.map((t) => (
            <div
              key={t.key}
              class={`tab-item ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </div>
          ))}
        </div>

        {activeTab === 'base' && (
          <div>
            <div class="detail-section">
              <div class="detail-title">处理节点时限</div>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-title">1. 隐患上报节点</div>
                  <div class="timeline-time">时限：24小时 · 操作人：{o.reporter_name}</div>
                  <div>创建时间：{formatTime(o.created_at)}</div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-title">2. 分派转办节点</div>
                  <div class="timeline-time">时限：24小时 · 操作人：防火监督员</div>
                  <div>{o.supervisor_name ? `已分派给 ${o.supervisor_name}` : '待分派'}</div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-title">3. 整改通知节点</div>
                  <div class="timeline-time">时限：72小时</div>
                  <div>整改截止：{o.rectify_deadline ? formatDate(o.rectify_deadline) : '-'}</div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-title">4. 复查销项节点</div>
                  <div class="timeline-time">时限：48小时 · 操作人：站点负责人</div>
                  <div>复查截止：{o.recheck_deadline ? formatDate(o.recheck_deadline) : '-'}</div>
                </div>
                <div class="timeline-item">
                  <div class="timeline-title">5. 确认完成节点</div>
                  <div class="timeline-time">时限：24小时 · 操作人：站点负责人</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div>
            {(data.reports || []).length === 0 ? (
              <div class="empty-state">暂无上报记录</div>
            ) : (
              data.reports.map((r) => (
                <div class="log-item" key={r.id}>
                  <div class="log-header">
                    <span class="log-action">隐患上报</span>
                    <span>节点截止：{formatTime(r.node_deadline)}</span>
                  </div>
                  <div class="log-remark">{r.content}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
                    上报时间：{formatTime(r.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'notice' && (
          <div>
            {(data.rectification_notices || []).length === 0 ? (
              <div class="empty-state">暂无整改通知</div>
            ) : (
              data.rectification_notices.map((n) => (
                <div class="log-item" key={n.id}>
                  <div class="log-header">
                    <span class="log-action">整改通知</span>
                    <span>整改截止：{formatDate(n.deadline)}</span>
                  </div>
                  <div class="log-remark">{n.content}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
                    节点截止：{formatTime(n.node_deadline)} · 下发时间：{formatTime(n.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'rectify' && (
          <div>
            {(data.rectification_records || []).length === 0 ? (
              <div class="empty-state">暂无整改记录</div>
            ) : (
              data.rectification_records.map((r) => (
                <div class="log-item" key={r.id}>
                  <div class="log-header">
                    <span class="log-action">整改记录</span>
                    <span>提交时间：{formatTime(r.submitted_at)}</span>
                  </div>
                  <div class="log-remark">{r.content}</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'recheck' && (
          <div>
            {(data.recheck_records || []).length === 0 ? (
              <div class="empty-state">暂无复查记录</div>
            ) : (
              data.recheck_records.map((r) => (
                <div class="log-item" key={r.id}>
                  <div class="log-header">
                    <span class="log-action">
                      复查结果：
                      <span style={{ color: r.result === 'pass' ? '#52c41a' : '#ff4d4f' }}>
                        {RECHECK_RESULT_TEXT[r.result]}
                      </span>
                    </span>
                    <span>复查时间：{formatTime(r.checked_at)}</span>
                  </div>
                  <div class="log-remark">{r.content}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
                    节点截止：{formatTime(r.node_deadline)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'timeout' && (
          <div>
            {(data.timeout_records || []).length === 0 ? (
              <div class="empty-state">暂无超时记录</div>
            ) : (
              data.timeout_records.map((t) => (
                <div class="timeout-item" key={t.id}>
                  <div class="log-header">
                    <span class="log-action" style={{ color: '#ff4d4f' }}>
                      节点超时：{NODE_TEXT[t.node_type]}
                    </span>
                    <span>处理人：{t.handler_name}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div><b>超时原因：</b>{t.timeout_reason}</div>
                    <div><b>处理措施：</b>{t.handle_action}</div>
                    <div><b>原截止时间：</b>{formatTime(t.original_deadline)}</div>
                    {t.new_deadline && <div><b>新截止时间：</b>{formatTime(t.new_deadline)}</div>}
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 6 }}>
                    处理时间：{formatTime(t.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            {(data.operation_logs || []).length === 0 ? (
              <div class="empty-state">暂无操作记录</div>
            ) : (
              data.operation_logs.map((l) => (
                <div class="log-item" key={l.id}>
                  <div class="log-header">
                    <span class="log-action">{l.action}</span>
                    <span>{formatTime(l.created_at)}</span>
                  </div>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    操作人：{l.user_name}
                    {l.from_status && l.to_status && (
                      <span style={{ marginLeft: 12 }}>
                        状态：{STATUS_TEXT[l.from_status] || '-'} → {STATUS_TEXT[l.to_status]}
                      </span>
                    )}
                    {l.from_node && l.to_node && l.from_node !== l.to_node && (
                      <span style={{ marginLeft: 12 }}>
                        节点：{NODE_TEXT[l.from_node]} → {NODE_TEXT[l.to_node]}
                      </span>
                    )}
                  </div>
                  {l.remark && <div class="log-remark">备注：{l.remark}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <Modal
        title="转办分派（下发整改通知）"
        visible={showAssign}
        onClose={() => setShowAssign(false)}
        onOk={() => doAction(api.assignOrder, assignForm, setShowAssign, '转办成功，已下发整改通知')}
        okText="确认转办"
        loading={submitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          转办后状态变为「已转办」，当前节点变为「整改通知」。整改节点时限 72 小时。
        </div>
        <div class="form-group">
          <label class="form-label">整改期限（天）</label>
          <input
            type="number"
            min="1"
            max="90"
            value={assignForm.days}
            onInput={(e) => setAssignForm({ ...assignForm, days: parseInt(e.target.value, 10) || 7 })}
          />
        </div>
        <div class="form-group">
          <label class="form-label">整改通知内容 *</label>
          <textarea
            value={assignForm.content}
            onInput={(e) => setAssignForm({ ...assignForm, content: e.target.value })}
            placeholder="请填写整改通知内容，明确整改要求..."
            rows={4}
          />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea
            value={assignForm.remark}
            onInput={(e) => setAssignForm({ ...assignForm, remark: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        title="提交整改记录"
        visible={showRectify}
        onClose={() => setShowRectify(false)}
        onOk={() => doAction(api.rectifyOrder, rectifyForm, setShowRectify, '整改记录已提交，进入复查节点')}
        okText="提交整改"
        loading={submitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#e6f7ff', borderRadius: 4 }}>
          提交后节点变为「复查销项」，等待站点负责人复查。
        </div>
        <div class="form-group">
          <label class="form-label">整改内容 *</label>
          <textarea
            value={rectifyForm.content}
            onInput={(e) => setRectifyForm({ ...rectifyForm, content: e.target.value })}
            placeholder="请详细描述整改措施和完成情况..."
            rows={5}
          />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea
            value={rectifyForm.remark}
            onInput={(e) => setRectifyForm({ ...rectifyForm, remark: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        title="复查回访"
        visible={showRecheck}
        onClose={() => setShowRecheck(false)}
        onOk={() => doAction(api.recheckOrder, recheckForm, setShowRecheck, '回访完成，状态已更新')}
        okText="提交复查"
        loading={submitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          复查后状态变为「已回访」，节点变为「确认完成」。复查节点时限 48 小时。
        </div>
        <div class="form-group">
          <label class="form-label">复查结果</label>
          <select value={recheckForm.result} onInput={(e) => setRecheckForm({ ...recheckForm, result: e.target.value })}>
            <option value="pass">通过</option>
            <option value="fail">不通过（需重新整改）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">复查内容 *</label>
          <textarea
            value={recheckForm.content}
            onInput={(e) => setRecheckForm({ ...recheckForm, content: e.target.value })}
            placeholder="请描述复查情况..."
            rows={5}
          />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea
            value={recheckForm.remark}
            onInput={(e) => setRecheckForm({ ...recheckForm, remark: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>

      <Modal
        title="确认完成（隐患单闭环）"
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onOk={() => doAction(api.confirmOrder, confirmForm, setShowConfirm, '已确认完成，隐患单闭环')}
        okText="确认完成"
        loading={submitting}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          确认后此隐患单处理完成，形成闭环。
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea
            value={confirmForm.remark}
            onInput={(e) => setConfirmForm({ ...confirmForm, remark: e.target.value })}
            rows={3}
          />
        </div>
      </Modal>

      <Modal
        title="处理节点超时"
        visible={showTimeout}
        onClose={() => setShowTimeout(false)}
        onOk={() => doAction(api.handleTimeout, timeoutForm, setTimeoutForm, '超时处理记录已保存')}
        okText="提交处理"
        loading={submitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 12, padding: 10, background: '#fff1f0', borderRadius: 4 }}>
          当前节点「{NODE_TEXT[o.current_node]}」已超时，请填写超时原因和后续处理措施。
        </div>
        <div class="form-group">
          <label class="form-label">超时原因 *</label>
          <textarea
            value={timeoutForm.timeout_reason}
            onInput={(e) => setTimeoutForm({ ...timeoutForm, timeout_reason: e.target.value })}
            placeholder="请详细说明超时原因..."
            rows={3}
          />
        </div>
        <div class="form-group">
          <label class="form-label">处理措施 *</label>
          <textarea
            value={timeoutForm.handle_action}
            onInput={(e) => setTimeoutForm({ ...timeoutForm, handle_action: e.target.value })}
            placeholder="请说明后续处理措施..."
            rows={3}
          />
        </div>
        <div class="form-group">
          <label class="form-label">顺延天数（0 表示不顺延）</label>
          <input
            type="number"
            min="0"
            max="30"
            value={timeoutForm.add_days}
            onInput={(e) => setTimeoutForm({ ...timeoutForm, add_days: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea
            value={timeoutForm.remark}
            onInput={(e) => setTimeoutForm({ ...timeoutForm, remark: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
