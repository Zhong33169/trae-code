import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, orderApi } from '../api';
import type { User, SparePartOrder, OrderStatus, UserRole } from '../types';
import { STATUS_LABELS, ROLE_LABELS, statusClass, formatTime } from '../utils';

const CURRENT_USER_KEY = 'sp_current_user';

export default function Home() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [orders, setOrders] = useState<SparePartOrder[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterMine, setFilterMine] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    part_name: '',
    part_model: '',
    quantity: 1,
    reason: '',
    station_name: '',
  });

  const currentUser = users.find((u) => u.id === currentUserId);
  const currentRole = (currentUser?.role as UserRole) || 'registrar';

  const loadUsers = async () => {
    try {
      const list = await userApi.listUsers();
      setUsers(list);
      if (!currentUserId && list.length > 0) {
        const saved = localStorage.getItem(CURRENT_USER_KEY);
        const defaultId = saved && list.find((u) => u.id === saved)
          ? saved
          : list[0].id;
        setCurrentUserId(defaultId);
        localStorage.setItem(CURRENT_USER_KEY, defaultId);
      }
    } catch (e: any) {
      setError('加载用户失败: ' + (e?.message || e));
    }
  };

  const loadOrders = async (uid: string) => {
    if (!uid) return;
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterMine) params.user_id = uid;
      const res = await orderApi.list(params);
      setOrders(res.orders);
      setStats(res.stats);
    } catch (e: any) {
      setError('加载单据失败: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadOrders(currentUserId);
    }
  }, [currentUserId, filterStatus, filterMine]);

  const switchUser = (id: string) => {
    setCurrentUserId(id);
    localStorage.setItem(CURRENT_USER_KEY, id);
  };

  const handleCreate = async () => {
    setError('');
    if (!currentUser) return;
    try {
      if (currentRole !== 'registrar') {
        setError('只有备件更换登记员可以创建单据');
        return;
      }
      if (!form.title || !form.part_name || !form.part_model || !form.reason || !form.station_name) {
        setError('请填写所有必填项');
        return;
      }
      await orderApi.create({ ...form, registrar_id: currentUser.id });
      setShowCreate(false);
      setForm({ title: '', part_name: '', part_model: '', quantity: 1, reason: '', station_name: '' });
      loadOrders(currentUserId);
    } catch (e: any) {
      setError(e?.response?.data || e?.message || '创建失败');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">备件更换单异常申诉系统</h1>
        <div className="user-switcher">
          <label>当前角色：</label>
          <select value={currentUserId} onChange={(e) => switchUser(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_LABELS[u.role] || u.role}) - {u.company}
              </option>
            ))}
          </select>
          {currentRole === 'registrar' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + 新建登记单
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">单据总数</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card blue">
            <div className="stat-label">登记待核验</div>
            <div className="stat-value">{stats.registered}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">核验办理中</div>
            <div className="stat-value">{stats.verifying}</div>
          </div>
          <div className="stat-card purple">
            <div className="stat-label">复核办理中</div>
            <div className="stat-value">{stats.reviewing}</div>
          </div>
          <div className="stat-card orange">
            <div className="stat-label">异常申诉中</div>
            <div className="stat-value">{stats.appeal}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">已归档</div>
            <div className="stat-value">{stats.archived}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">逾期未处理</div>
            <div className="stat-value">{stats.overdue}</div>
          </div>
          <div className="stat-card warn">
            <div className="stat-label">证据不足</div>
            <div className="stat-value">{stats.evidence_missing}</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <span style={{ color: '#6b7280' }}>筛选：</span>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={filterMine}
            onChange={(e) => setFilterMine(e.target.checked)}
          />
          只看我的待办
        </label>
        <button className="btn btn-default" onClick={() => loadOrders(currentUserId)}>
          刷新
        </button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">暂无单据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>单据编号</th>
                <th>标题</th>
                <th>备件</th>
                <th>电站</th>
                <th>状态</th>
                <th>当前处理人</th>
                <th>登记员</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'monospace' }}>{o.order_no}</td>
                  <td>{o.title}</td>
                  <td>
                    {o.part_name}
                    <br />
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{o.part_model} × {o.quantity}</span>
                  </td>
                  <td>{o.station_name}</td>
                  <td>
                    <span className={statusClass(o.status)}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    {o.is_overdue && <span className="badge badge-overdue">逾期</span>}
                    {o.is_evidence_missing && <span className="badge badge-missing">缺证据</span>}
                  </td>
                  <td>
                    {o.current_handler_name}
                    <br />
                    <span style={{ color: '#6b7280', fontSize: 12 }}>
                      {ROLE_LABELS[o.current_handler_role]}
                    </span>
                  </td>
                  <td>{o.registrar_name}</td>
                  <td style={{ fontSize: 12 }}>{formatTime(o.updated_at)}</td>
                  <td>
                    <button className="link-btn" onClick={() => navigate(`/orders/${o.id}`)}>
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-mask" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">新建备件更换登记单</div>
            <div className="form-group">
              <label>申请标题 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例：阳光电站A区逆变器风扇更换"
              />
            </div>
            <div className="form-group">
              <label>电站名称 *</label>
              <input
                type="text"
                value={form.station_name}
                onChange={(e) => setForm({ ...form, station_name: e.target.value })}
                placeholder="例：阳光电站A区"
              />
            </div>
            <div className="evidence-grid">
              <div className="form-group">
                <label>备件名称 *</label>
                <input
                  type="text"
                  value={form.part_name}
                  onChange={(e) => setForm({ ...form, part_name: e.target.value })}
                  placeholder="例：散热风扇"
                />
              </div>
              <div className="form-group">
                <label>备件型号 *</label>
                <input
                  type="text"
                  value={form.part_model}
                  onChange={(e) => setForm({ ...form, part_model: e.target.value })}
                  placeholder="例：FAN-12038-24V"
                />
              </div>
            </div>
            <div className="form-group">
              <label>数量</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="form-group">
              <label>更换原因 *</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="描述故障情况、更换原因"
              />
              <div className="form-hint">
                提交登记时至少需要 2 份证据材料（现场照片、申请单等）
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                创建草稿
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
