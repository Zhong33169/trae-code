import React, { useState, useEffect, useCallback } from 'react';
import { api, authStore } from '../utils/api';
import { toast } from './Toast.jsx';
import { getStatusText, getStatusColor } from '../utils/format';

export default function ScheduleList() {
  const [user, setUser] = useState(null);
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState({ statusList: [] });

  useEffect(() => {
    const u = authStore.getUser();
    setUser(u);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const r = await api.listSchedules({ status, keyword, page, pageSize });
    setLoading(false);
    if (r.ok && r.data.code === 0) {
      setList(r.data.data.list);
      setTotal(r.data.data.total);
    } else {
      toast(r.data?.message || '加载失败', 'error');
    }
  }, [status, keyword, page, pageSize]);

  const loadStats = useCallback(async () => {
    const r = await api.statistics();
    if (r.ok && r.data.code === 0) setStats(r.data.data);
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      loadStats();
    }
  }, [user, loadData, loadStats]);

  const onDelete = async (id) => {
    if (!confirm('确定删除该发车计划吗？删除后不可恢复。')) return;
    const r = await api.deleteSchedule(id);
    if (r.ok && r.data.code === 0) {
      toast('删除成功', 'success');
      loadData(); loadStats();
    } else {
      toast(r.data.message || '删除失败', 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (!user) return null;

  return (
    <div>
      {user.role === 'registrar' && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>我的发车计划</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 新建发车计划</button>
        </div>
      )}

      {user.role !== 'registrar' && (
        <div className="stat-cards">
          {stats.statusList.map(s => (
            <div key={s.status} className="stat-card" onClick={() => { setStatus(s.status); setPage(1); }}
              style={{ cursor: 'pointer', border: status === s.status ? '2px solid #409eff' : '2px solid transparent' }}>
              <div className="label">{s.text}</div>
              <div className="value" style={{ color: getStatusColor(s.status) }}>{s.count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="filter-bar">
          <select className="form-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending_audit">待审核</option>
            <option value="audit_rejected">审核退回</option>
            <option value="pending_review">待复核</option>
            <option value="review_rejected">复核退回</option>
            <option value="archived">已归档</option>
          </select>
          <input className="form-input" placeholder="搜索编号/线路/车号" value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1); }} />
          <button className="btn btn-default" onClick={() => { setStatus(''); setKeyword(''); setPage(1); }}>重置</button>
          <span style={{ marginLeft: 'auto', color: '#909399', fontSize: '13px' }}>共 {total} 条</span>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>计划编号</th>
              <th>线路名称</th>
              <th>车号</th>
              <th>驾驶员</th>
              <th>发车时间</th>
              <th>起终点站</th>
              {user.role !== 'registrar' && <th>创建人</th>}
              <th>状态</th>
              <th>创建时间</th>
              <th style={{ width: '200px' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && list.length === 0 && (
              <tr><td colSpan="10" className="empty">加载中...</td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr><td colSpan="10" className="empty">暂无数据</td></tr>
            )}
            {list.map(item => (
              <tr key={item.id}>
                <td><a href={`/detail/${item.id}`} style={{ fontWeight: 600 }}>{item.scheduleNo}</a></td>
                <td>{item.routeName}</td>
                <td>{item.busNo || '-'}</td>
                <td>{item.driverName || '-'}</td>
                <td>{item.departureTime}</td>
                <td>{item.startStation} → {item.endStation}</td>
                {user.role !== 'registrar' && <td>{item.creatorName}</td>}
                <td>
                  <span className="tag" style={{ background: getStatusColor(item.status) + '22', color: getStatusColor(item.status) }}>
                    {getStatusText(item.status)}
                  </span>
                </td>
                <td>{item.createdAt}</td>
                <td>
                  <a href={`/detail/${item.id}`} className="btn btn-default" style={{ padding: '4px 10px', fontSize: '12px' }}>详情</a>
                  {user.role === 'registrar' && item.createdBy === user.id && item.status === 'draft' && (
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => onDelete(item.id)}>删除</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination">
          <span className="pagination-info">第 {page} / {totalPages} 页</span>
          <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
          <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页</button>
        </div>
      </div>

      {showCreate && (
        <ScheduleFormModal user={user} onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); loadData(); loadStats(); }} />
      )}
    </div>
  );
}

function ScheduleFormModal({ user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    routeName: '', busNo: '', driverName: '', departureTime: '',
    startStation: '', endStation: '', shiftType: '早班', remark: '',
    handover: { shiftNo: '', handoverPerson: '', receiverPerson: '', confirmTime: '', handoverRemark: '' }
  });

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const updateHandover = (k, v) => setForm(f => ({ ...f, handover: { ...f.handover, [k]: v } }));

  const submit = async () => {
    if (!form.routeName.trim()) { toast('请填写线路名称', 'error'); return; }
    if (!form.departureTime.trim()) { toast('请填写发车时间', 'error'); return; }
    if (!form.startStation.trim()) { toast('请填写起点站', 'error'); return; }
    if (!form.endStation.trim()) { toast('请填写终点站', 'error'); return; }
    setLoading(true);
    const r = await api.createSchedule({
      ...form,
      handover: {
        shiftNo: form.handover.shiftNo,
        handoverPerson: form.handover.handoverPerson,
        receiverPerson: form.handover.receiverPerson,
        confirmTime: form.handover.confirmTime,
        handoverRemark: form.handover.handoverRemark
      }
    });
    setLoading(false);
    if (r.ok && r.data.code === 0) {
      toast('创建成功', 'success');
      onSuccess();
    } else {
      toast(r.data.message || '创建失败', 'error');
    }
  };

  return (
    <div className="modal-mask" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ width: 720 }}>
        <div className="modal-header">
          <div className="modal-title">新建发车计划</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="card-title" style={{ fontSize: 14 }}>基本信息</div>
          <div className="form-row">
            <div className="form-item">
              <label className="form-label required">线路名称</label>
              <input className="form-input" value={form.routeName} onChange={e => update('routeName', e.target.value)} placeholder="如 1路" />
            </div>
            <div className="form-item">
              <label className="form-label required">发车时间</label>
              <input className="form-input" type="datetime-local" value={form.departureTime} onChange={e => update('departureTime', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-item">
              <label className="form-label required">起点站</label>
              <input className="form-input" value={form.startStation} onChange={e => update('startStation', e.target.value)} placeholder="如 火车站" />
            </div>
            <div className="form-item">
              <label className="form-label required">终点站</label>
              <input className="form-input" value={form.endStation} onChange={e => update('endStation', e.target.value)} placeholder="如 市政府" />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-item">
              <label className="form-label">车号</label>
              <input className="form-input" value={form.busNo} onChange={e => update('busNo', e.target.value)} placeholder="如 沪A12345" />
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
              <input className="form-input" value={form.handover.handoverPerson} onChange={e => updateHandover('handoverPerson', e.target.value)} placeholder="交班人姓名" />
            </div>
            <div className="form-item">
              <label className="form-label required">接收人</label>
              <input className="form-input" value={form.handover.receiverPerson} onChange={e => updateHandover('receiverPerson', e.target.value)} placeholder="接班人姓名" />
            </div>
          </div>
          <div className="form-item">
            <label className="form-label">交接备注</label>
            <textarea className="form-textarea" value={form.handover.handoverRemark} onChange={e => updateHandover('handoverRemark', e.target.value)} placeholder="交接注意事项" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? '创建中...' : '创建（保存为草稿）'}</button>
        </div>
      </div>
    </div>
  );
}
