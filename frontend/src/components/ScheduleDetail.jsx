import React, { useState, useEffect, useCallback } from 'react';
import { api, authStore } from '../utils/api';
import { toast } from './Toast.jsx';
import { getStatusText, getStatusColor } from '../utils/format';

function validateHandover(h) {
  if (!h) return '交接信息缺失';
  if (!h.shift_no?.trim()) return '班次不能为空';
  if (!h.handover_person?.trim()) return '交出人不能为空';
  if (!h.receiver_person?.trim()) return '接收人不能为空';
  if (!h.confirm_time?.trim()) return '确认时间不能为空';
  return null;
}

export default function ScheduleDetail({ scheduleId }) {
  const [user, setUser] = useState(null);
  const [id, setId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAudit, setShowAudit] = useState(null);
  const [auditResult, setAuditResult] = useState('pass');
  const [auditOpinion, setAuditOpinion] = useState('');

  useEffect(() => {
    const u = authStore.getUser();
    setUser(u);
    if (scheduleId) {
      setId(String(scheduleId));
    } else if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/');
      setId(parts[parts.length - 1]);
    }
  }, [scheduleId]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const r = await api.getSchedule(id);
    setLoading(false);
    if (r.ok && r.data.code === 0) {
      setData(r.data.data);
    } else {
      toast(r.data?.message || '加载失败', 'error');
    }
  }, [id]);

  useEffect(() => {
    if (id && user) loadDetail();
  }, [id, user, loadDetail]);

  const canEdit = user?.role === 'registrar' && data &&
    ['draft', 'audit_rejected', 'review_rejected'].includes(data.status) &&
    data.created_by === user.id;

  const canSubmit = user?.role === 'registrar' && data &&
    ['draft', 'audit_rejected', 'review_rejected'].includes(data.status) &&
    data.created_by === user.id;

  const canAudit = user?.role === 'auditor' && data && data.status === 'pending_audit';
  const canReview = user?.role === 'reviewer' && data && data.status === 'pending_review';

  const handoverError = data ? validateHandover(data.handover) : null;

  const startEdit = () => {
    setForm({
      routeName: data.route_name,
      busNo: data.bus_no || '',
      driverName: data.driver_name || '',
      departureTime: data.departure_time,
      startStation: data.start_station,
      endStation: data.end_station,
      shiftType: data.shift_type || '',
      remark: data.remark || '',
      handover: {
        shiftNo: data.handover?.shift_no || '',
        handoverPerson: data.handover?.handover_person || '',
        receiverPerson: data.handover?.receiver_person || '',
        confirmTime: data.handover?.confirm_time || '',
        handoverRemark: data.handover?.handover_remark || ''
      }
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!form.routeName.trim()) { toast('请填写线路名称', 'error'); return; }
    if (!form.departureTime.trim()) { toast('请填写发车时间', 'error'); return; }
    if (!form.startStation.trim()) { toast('请填写起点站', 'error'); return; }
    if (!form.endStation.trim()) { toast('请填写终点站', 'error'); return; }
    setSubmitting(true);
    const r = await api.updateSchedule(id, {
      ...form,
      handover: {
        shiftNo: form.handover.shiftNo,
        handoverPerson: form.handover.handoverPerson,
        receiverPerson: form.handover.receiverPerson,
        confirmTime: form.handover.confirmTime,
        handoverRemark: form.handover.handoverRemark
      }
    });
    setSubmitting(false);
    if (r.ok && r.data.code === 0) {
      toast(data.status === 'draft' ? '保存成功' : '补正成功', 'success');
      setEditing(false);
      loadDetail();
    } else {
      toast(r.data.message || '保存失败', 'error');
    }
  };

  const submit = async () => {
    if (handoverError) {
      toast(`提交失败：${handoverError}，请先完善交接信息`, 'error');
      return;
    }
    if (!confirm('确定提交审核吗？提交后将进入审核流程。')) return;
    setSubmitting(true);
    const r = await api.submitSchedule(id);
    setSubmitting(false);
    if (r.ok && r.data.code === 0) {
      toast(r.data.message || '提交成功', 'success');
      loadDetail();
    } else {
      toast(r.data.message || '提交失败', 'error');
    }
  };

  const doAudit = async () => {
    if (auditResult === 'reject' && !auditOpinion.trim()) {
      toast('退回时必须填写审核意见', 'error'); return;
    }
    setSubmitting(true);
    const fn = showAudit === 'audit' ? api.auditSchedule : api.reviewSchedule;
    const r = await fn(id, auditResult, auditOpinion.trim());
    setSubmitting(false);
    if (r.ok && r.data.code === 0) {
      toast(r.data.message || '操作成功', 'success');
      setShowAudit(null); setAuditOpinion('');
      loadDetail();
    } else {
      toast(r.data.message || '操作失败', 'error');
    }
  };

  if (!user || !id) return null;
  if (loading && !data) return <div className="card"><div className="empty">加载中...</div></div>;
  if (!loading && !data) return <div className="card"><div className="empty">加载失败</div></div>;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{data.schedule_no}</span>
            <span className="tag" style={{ marginLeft: 12, background: getStatusColor(data.status) + '22', color: getStatusColor(data.status), fontSize: 13, padding: '3px 10px' }}>
              {getStatusText(data.status)}
            </span>
          </div>
          <div>
            {canEdit && !editing && (
              <button className="btn btn-default" onClick={startEdit}>
                {data.status === 'draft' ? '编辑' : '补正'}
              </button>
            )}
            {canEdit && editing && (
              <>
                <button className="btn btn-default" onClick={() => setEditing(false)} disabled={submitting}>取消</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={submitting}>
                  {submitting ? '保存中...' : (data.status === 'draft' ? '保存' : '保存补正')}
                </button>
              </>
            )}
            {canSubmit && !editing && (
              <button className="btn btn-warning" onClick={submit} disabled={submitting}>
                {submitting ? '提交中...' : '提交审核'}
              </button>
            )}
            {canAudit && (
              <button className="btn btn-primary" onClick={() => { setShowAudit('audit'); setAuditResult('pass'); setAuditOpinion(''); }}>
                办理审核
              </button>
            )}
            {canReview && (
              <button className="btn btn-success" onClick={() => { setShowAudit('review'); setAuditResult('pass'); setAuditOpinion(''); }}>
                复核归档
              </button>
            )}
            <a href="/" className="btn btn-default" style={{ marginLeft: 8 }}>返回列表</a>
          </div>
        </div>

        {handoverError && !editing && (
          <div className="handover-alert">
            ⚠ 交接信息不完整：{handoverError}。{canEdit ? '请点击「补正」完善后再提交。' : '请联系登记员补正。'}
          </div>
        )}
        {!handoverError && !editing && data.handover && (
          <div className="handover-alert success">✓ 交接信息已完整（班次、交出人、接收人、确认时间均已填写）</div>
        )}
      </div>

      {!editing ? (
        <DetailView data={data} />
      ) : (
        <EditView form={form} setForm={setForm} originalStatus={data.status} />
      )}

      {showAudit && (
        <div className="modal-mask" onClick={e => { if (e.target === e.currentTarget) setShowAudit(null); }}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">{showAudit === 'audit' ? '发车审核办理' : '复核归档办理'}</div>
              <button className="modal-close" onClick={() => setShowAudit(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-item">
                <label className="form-label required">处理结果</label>
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="radio" checked={auditResult === 'pass'} onChange={() => setAuditResult('pass')} />
                    {showAudit === 'audit' ? '审核通过（进入复核）' : '复核通过（归档）'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="radio" checked={auditResult === 'reject'} onChange={() => setAuditResult('reject')} />
                    退回补正
                  </label>
                </div>
              </div>
              <div className="form-item">
                <label className={`form-label ${auditResult === 'reject' ? 'required' : ''}`}>
                  {showAudit === 'audit' ? '审核意见' : '复核意见'}{auditResult === 'reject' ? '（退回必填）' : ''}
                </label>
                <textarea className="form-textarea" value={auditOpinion}
                  onChange={e => setAuditOpinion(e.target.value)}
                  placeholder={auditResult === 'reject' ? '请填写退回原因' : '可选，填写意见'} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowAudit(null)} disabled={submitting}>取消</button>
              <button className={`btn ${auditResult === 'pass' ? 'btn-success' : 'btn-danger'}`}
                onClick={doAudit} disabled={submitting}>
                {submitting ? '处理中...' : (auditResult === 'pass' ? '确认通过' : '确认退回')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailView({ data }) {
  const [tab, setTab] = useState('info');

  return (
    <>
      <div className="card">
        <div className="tabs">
          <div className={`tab-item ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>基本信息</div>
          <div className={`tab-item ${tab === 'handover' ? 'active' : ''}`} onClick={() => setTab('handover')}>交接信息</div>
          <div className={`tab-item ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>审核/复核记录</div>
          <div className={`tab-item ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>操作记录</div>
        </div>

        {tab === 'info' && (
          <div className="detail-grid">
            <div className="detail-item"><span className="label">计划编号：</span><span className="value">{data.schedule_no}</span></div>
            <div className="detail-item"><span className="label">状态：</span><span className="value">{data.statusText}</span></div>
            <div className="detail-item"><span className="label">线路名称：</span><span className="value">{data.route_name}</span></div>
            <div className="detail-item"><span className="label">发车时间：</span><span className="value">{data.departure_time}</span></div>
            <div className="detail-item"><span className="label">起点站：</span><span className="value">{data.start_station}</span></div>
            <div className="detail-item"><span className="label">终点站：</span><span className="value">{data.end_station}</span></div>
            <div className="detail-item"><span className="label">车号：</span><span className="value">{data.bus_no || '-'}</span></div>
            <div className="detail-item"><span className="label">驾驶员：</span><span className="value">{data.driver_name || '-'}</span></div>
            <div className="detail-item"><span className="label">班次类型：</span><span className="value">{data.shift_type || '-'}</span></div>
            <div className="detail-item"><span className="label">创建人：</span><span className="value">{data.creatorName}</span></div>
            <div className="detail-item"><span className="label">创建时间：</span><span className="value">{data.created_at}</span></div>
            <div className="detail-item"><span className="label">更新时间：</span><span className="value">{data.updated_at}</span></div>
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
              <span className="label">备注：</span><span className="value">{data.remark || '-'}</span>
            </div>
          </div>
        )}

        {tab === 'handover' && (
          <div>
            {data.handover ? (
              <div className="detail-grid">
                <div className="detail-item"><span className="label">班次编号：</span><span className="value">{data.handover.shift_no || '-'}</span></div>
                <div className="detail-item"><span className="label">确认时间：</span><span className="value">{data.handover.confirm_time || '-'}</span></div>
                <div className="detail-item"><span className="label">交出人：</span><span className="value">{data.handover.handover_person || '-'}</span></div>
                <div className="detail-item"><span className="label">接收人：</span><span className="value">{data.handover.receiver_person || '-'}</span></div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="label">交接备注：</span><span className="value">{data.handover.handover_remark || '-'}</span>
                </div>
              </div>
            ) : (
              <div className="empty">暂无交接信息</div>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div>
            {data.audits && data.audits.length > 0 ? (
              <ul className="audit-list">
                {data.audits.map(a => (
                  <li key={a.id}>
                    <div>
                      <span className={`audit-type ${a.audit_type}`}>{a.audit_type === 'audit' ? '审核' : '复核'}</span>
                      <span style={{ marginRight: 8 }}>{a.auditor_name}</span>
                      <span className={a.result === 'pass' ? 'audit-result-pass' : 'audit-result-reject'}>
                        {a.result === 'pass' ? '通过' : '退回'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', color: '#909399', fontSize: 12, minWidth: 200 }}>
                      <div>{a.created_at}</div>
                      {a.opinion && <div style={{ color: '#f56c6c', marginTop: 4 }}>意见：{a.opinion}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">暂无审核/复核记录</div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div>
            {data.operationLogs && data.operationLogs.length > 0 ? (
              <div className="timeline">
                {data.operationLogs.map(l => (
                  <div key={l.id} className="timeline-item">
                    <div className="time">{l.created_at}</div>
                    <div>
                      <span className="user">{l.user_name}</span>
                      <span className="desc">{l.action_desc}</span>
                      {l.old_status && l.new_status && (
                        <span className="desc" style={{ marginLeft: 8, color: '#909399' }}>
                          （{getStatusText(l.old_status)} → {getStatusText(l.new_status)}）
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">暂无操作记录</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function EditView({ form, setForm, originalStatus }) {
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateHandover = (k, v) => setForm(f => ({ ...f, handover: { ...f.handover, [k]: v } }));

  return (
    <div className="card">
      <div className="card-title">
        {originalStatus === 'draft' ? '编辑发车计划' : `补正发车计划（${getStatusText(originalStatus)}）`}
      </div>

      <div className="card-title" style={{ fontSize: 14 }}>基本信息</div>
      <div className="form-row">
        <div className="form-item">
          <label className="form-label required">线路名称</label>
          <input className="form-input" value={form.routeName} onChange={e => update('routeName', e.target.value)} />
        </div>
        <div className="form-item">
          <label className="form-label required">发车时间</label>
          <input className="form-input" type="datetime-local" value={form.departureTime} onChange={e => update('departureTime', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-item">
          <label className="form-label required">起点站</label>
          <input className="form-input" value={form.startStation} onChange={e => update('startStation', e.target.value)} />
        </div>
        <div className="form-item">
          <label className="form-label required">终点站</label>
          <input className="form-input" value={form.endStation} onChange={e => update('endStation', e.target.value)} />
        </div>
      </div>
      <div className="form-row-3">
        <div className="form-item">
          <label className="form-label">车号</label>
          <input className="form-input" value={form.busNo} onChange={e => update('busNo', e.target.value)} />
        </div>
        <div className="form-item">
          <label className="form-label">驾驶员</label>
          <input className="form-input" value={form.driverName} onChange={e => update('driverName', e.target.value)} />
        </div>
        <div className="form-item">
          <label className="form-label">班次类型</label>
          <select className="form-select" value={form.shiftType} onChange={e => update('shiftType', e.target.value)}>
            <option value="早班">早班</option>
            <option value="中班">中班</option>
            <option value="晚班">晚班</option>
            <option value="通宵">通宵</option>
          </select>
        </div>
      </div>
      <div className="form-item">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" value={form.remark} onChange={e => update('remark', e.target.value)} />
      </div>

      <div className="card-title" style={{ fontSize: 14, marginTop: 16 }}>跨班组交接信息 <span style={{ color: '#f56c6c', fontSize: 12 }}>（提交审核前必须完整填写）</span></div>
      <div className="form-row">
        <div className="form-item">
          <label className="form-label required">班次编号</label>
          <input className="form-input" value={form.handover.shiftNo} onChange={e => updateHandover('shiftNo', e.target.value)} placeholder="如 B2024061501" />
        </div>
        <div className="form-item">
          <label className="form-label required">确认时间</label>
          <input className="form-input" type="datetime-local" value={form.handover.confirmTime} onChange={e => updateHandover('confirmTime', e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-item">
          <label className="form-label required">交出人</label>
          <input className="form-input" value={form.handover.handoverPerson} onChange={e => updateHandover('handoverPerson', e.target.value)} />
        </div>
        <div className="form-item">
          <label className="form-label required">接收人</label>
          <input className="form-input" value={form.handover.receiverPerson} onChange={e => updateHandover('receiverPerson', e.target.value)} />
        </div>
      </div>
      <div className="form-item">
        <label className="form-label">交接备注</label>
        <textarea className="form-textarea" value={form.handover.handoverRemark} onChange={e => updateHandover('handoverRemark', e.target.value)} />
      </div>
    </div>
  );
}
