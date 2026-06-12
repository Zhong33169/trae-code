import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '../utils/api';
import {
  STATUS_TEXT, NODE_TEXT, HAZARD_LEVEL_TEXT, ROLE_TEXT,
  formatTime, getDeadlineRemain, isDeadlinePassed, canDo, actionDisabledReason,
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

export default function OrderList({ user, onOpenDetail }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [size] = useState(10);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [stats, setStats] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', hazard_level: 'general', content: '' });
  const [submitting, setSubmitting] = useState(false);

  const [quickOrder, setQuickOrder] = useState(null);
  const [showQuickAssign, setShowQuickAssign] = useState(false);
  const [showQuickRectify, setShowQuickRectify] = useState(false);
  const [showQuickRecheck, setShowQuickRecheck] = useState(false);
  const [showQuickConfirm, setShowQuickConfirm] = useState(false);
  const [showQuickTimeout, setShowQuickTimeout] = useState(false);
  const [qf, setQf] = useState({});
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size };
      if (status && status !== 'all') params.status = status;
      if (keyword) params.keyword = keyword;
      const res = await api.listOrders(params);
      const flatList = (res.list || []).map((item) => ({
        ...item.order,
        allowed_actions: item.allowed_actions || [],
        action_denial_reasons: item.action_denial_reasons || {},
      }));
      setList(flatList);
      setTotal(res.total || 0);
    } catch (err) {
      showToast(err.message || '加载列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, size, status, keyword]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.statistics();
      setStats(res.summary);
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchStats();
  }, [fetchList, fetchStats]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (list.length > 0) {
        api.batchStatus(list.map((o) => o.id)).then((res) => {
          const map = {};
          (res.items || []).forEach((it) => { map[it.id] = it; });
          setList((prev) => prev.map((o) => {
            const m = map[o.id];
            if (m) {
              return {
                ...o,
                status: m.status,
                current_node: m.current_node,
                is_timeout: m.is_timeout,
                updated_at: m.updated_at,
                allowed_actions: m.allowed_actions || o.allowed_actions,
                action_denial_reasons: m.action_denial_reasons || o.action_denial_reasons,
              };
            }
            return o;
          }));
        }).catch(() => {});
        fetchStats();
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [list, fetchStats]);

  const refreshAll = () => {
    fetchList();
    fetchStats();
  };

  const handleCreate = async () => {
    if (!form.title || !form.location || !form.content) {
      showToast('标题、地点和上报内容必填', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.createOrder(form);
      showToast('隐患单创建成功', 'success');
      setShowCreate(false);
      setForm({ title: '', description: '', location: '', hazard_level: 'general', content: '' });
      refreshAll();
    } catch (err) {
      showToast(err.message || '创建失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const doQuick = async (apiFn, body, setter, successMsg) => {
    setQuickSubmitting(true);
    try {
      await apiFn(quickOrder.id, body);
      showToast(successMsg, 'success');
      setter(false);
      setQuickOrder(null);
      refreshAll();
    } catch (err) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const openQuick = (order, type) => {
    const allowed = Array.isArray(order.allowed_actions) && order.allowed_actions.includes(type);
    if (!allowed) {
      const reason = order.action_denial_reasons?.[type] || actionDisabledReason(user, order, type);
      if (reason) showToast(reason, 'error');
      else showToast('当前无法执行该操作', 'error');
      return;
    }
    setQuickOrder(order);
    setQf({});
    if (type === 'assign') {
      setQf({ content: '', days: 7, remark: '' });
      setShowQuickAssign(true);
    } else if (type === 'rectify') {
      setQf({ content: '', remark: '' });
      setShowQuickRectify(true);
    } else if (type === 'recheck') {
      setQf({ content: '', result: 'pass', remark: '' });
      setShowQuickRecheck(true);
    } else if (type === 'confirm') {
      setQf({ remark: '' });
      setShowQuickConfirm(true);
    } else if (type === 'handle_timeout') {
      setQf({ timeout_reason: '', handle_action: '', add_days: 0, remark: '' });
      setShowQuickTimeout(true);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  const showSupervisorCols = user.role === 'supervisor' || user.role === 'station_chief';
  const showChiefCols = user.role === 'station_chief';

  return (
    <div>
      {stats && (
        <div class="stat-cards">
          <div class="stat-card info">
            <div class="stat-label">隐患单总数</div>
            <div class="stat-value">{stats.total}</div>
          </div>
          <div class="stat-card warn">
            <div class="stat-label">待分派（文员上报后）</div>
            <div class="stat-value">{stats.pending}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">已转办（监督员处理中）</div>
            <div class="stat-value">{stats.assigned}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-label">已回访（负责人处理完成）</div>
            <div class="stat-value">{stats.revisited}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">节点超时（需处理）</div>
            <div class="stat-value">{stats.timeout}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">本月新增</div>
            <div class="stat-value">{stats.this_month}</div>
          </div>
        </div>
      )}

      <div class="page-card">
        <div class="toolbar">
          <div class="toolbar-left">
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="all">全部状态</option>
              <option value="pending">待分派（文员→监督员）</option>
              <option value="assigned">已转办（监督员→负责人）</option>
              <option value="revisited">已回访（负责人已确认）</option>
            </select>
            <input
              placeholder="搜索单号/标题/地点"
              value={keyword}
              onInput={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchList())}
            />
            <button class="btn-default" onClick={() => { setPage(1); fetchList(); }}>查询</button>
            <span style={{ color: '#999', fontSize: 12 }}>
              岗位视角：<b style={{ color: '#1890ff' }}>{ROLE_TEXT[user.role] || user.role}</b>
            </span>
          </div>
          <div class="toolbar-right">
            <button class="btn-default" onClick={refreshAll}>刷新</button>
            {user.role === 'clerk' && (
              <button class="btn-primary" onClick={() => setShowCreate(true)}>+ 上报隐患</button>
            )}
          </div>
        </div>

        {loading ? (
          <div class="empty-state">加载中...</div>
        ) : list.length === 0 ? (
          <div class="empty-state">
            暂无数据
            <div style={{ fontSize: 12, marginTop: 8, color: '#999' }}>
              {user.role === 'clerk' && '点击右上角「+ 上报隐患」创建第一张隐患单'}
              {user.role === 'supervisor' && '暂无待分派或处理中的隐患单，或使用筛选查看其他状态'}
              {user.role === 'station_chief' && '暂无需要您复查/确认的隐患单，请耐心等待监督员转办'}
            </div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>隐患单号</th>
                <th>标题</th>
                <th style={{ width: 120 }}>地点</th>
                <th style={{ width: 70 }}>等级</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ width: 120 }}>当前节点</th>
                {showSupervisorCols && <th style={{ width: 160 }}>节点时限</th>}
                {showChiefCols && <th style={{ width: 100 }}>监督员</th>}
                <th style={{ width: 90 }}>上报人</th>
                {user.role === 'clerk' && <th style={{ width: 130 }}>我的处理</th>}
                <th style={{ width: showSupervisorCols ? 240 : 130 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const deadline = o.current_node === 'rectify' ? o.rectify_deadline
                  : o.current_node === 'recheck' ? o.recheck_deadline : null;
                return (
                  <tr key={o.id}>
                    <td>
                      <a onClick={() => onOpenDetail(o.id)} style={{ fontWeight: 600 }}>{o.order_no}</a>
                    </td>
                    <td>{o.title}</td>
                    <td>{o.location}</td>
                    <td class={`level-${o.hazard_level}`}>
                      {HAZARD_LEVEL_TEXT[o.hazard_level] || o.hazard_level}
                    </td>
                    <td>
                      <span class={`status-tag status-${o.status}`}>
                        {STATUS_TEXT[o.status] || o.status}
                      </span>
                    </td>
                    <td>
                      {o.is_timeout ? (
                        <span class="timeout-tag">超时·{NODE_TEXT[o.current_node]}</span>
                      ) : (
                        NODE_TEXT[o.current_node] || o.current_node
                      )}
                    </td>
                    {showSupervisorCols && (
                      <td>
                        {deadline ? (
                          <span style={{ color: isDeadlinePassed(deadline) || o.is_timeout ? '#ff4d4f' : '#333' }}>
                            {getDeadlineRemain(deadline)}
                            <div style={{ fontSize: 11, color: '#999' }}>
                              截止 {formatTime(deadline).slice(5, 16)}
                            </div>
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>-</span>
                        )}
                      </td>
                    )}
                    {showChiefCols && (
                      <td>{o.supervisor_name || <span style={{ color: '#999' }}>未分派</span>}</td>
                    )}
                    <td>{o.reporter_name}</td>
                    {user.role === 'clerk' && (
                      <td>
                        {o.status === 'pending' && <span style={{ color: '#fa8c16' }}>等监督员转办</span>}
                        {o.status === 'assigned' && <span style={{ color: '#1890ff' }}>监督员处理中</span>}
                        {o.status === 'revisited' && <span style={{ color: '#52c41a' }}>已完成</span>}
                        {o.is_timeout && <div><span class="timeout-tag">超时</span></div>}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <a onClick={() => onOpenDetail(o.id)}>详情</a>
                        {o.allowed_actions?.includes('assign') && (
                          <a onClick={() => openQuick(o, 'assign')} style={{ color: '#1890ff' }}>转办</a>
                        )}
                        {o.allowed_actions?.includes('rectify') && (
                          <a onClick={() => openQuick(o, 'rectify')} style={{ color: '#1890ff' }}>整改</a>
                        )}
                        {o.allowed_actions?.includes('recheck') && (
                          <a onClick={() => openQuick(o, 'recheck')} style={{ color: '#52c41a' }}>复查</a>
                        )}
                        {o.allowed_actions?.includes('confirm') && (
                          <a onClick={() => openQuick(o, 'confirm')} style={{ color: '#52c41a' }}>确认</a>
                        )}
                        {o.allowed_actions?.includes('handle_timeout') && (
                          <a onClick={() => openQuick(o, 'handle_timeout')} style={{ color: '#ff4d4f' }}>超时处理</a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div class="pagination">
          <span class="page-info">共 {total} 条</span>
          <button class="btn-default" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>上一页</button>
          <span style={{ padding: '0 10px', color: '#666' }}>{page} / {totalPages}</span>
          <button class="btn-default" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>下一页</button>
        </div>
      </div>

      <Modal
        title="上报消防隐患"
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onOk={handleCreate}
        okText="提交上报"
        loading={submitting}
        width={600}
      >
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">隐患标题 *</label>
            <input value={form.title} onInput={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：消防通道被占用" maxLength={80} />
          </div>
          <div class="form-group">
            <label class="form-label">隐患地点 *</label>
            <input value={form.location} onInput={(e) => setForm({ ...form, location: e.target.value })} placeholder="如：朝阳区幸福小区" maxLength={100} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">隐患等级</label>
            <select value={form.hazard_level} onInput={(e) => setForm({ ...form, hazard_level: e.target.value })}>
              <option value="general">一般（绿色）</option>
              <option value="high">较大（橙色）</option>
              <option value="critical">重大（红色）</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">简要描述</label>
            <input value={form.description} onInput={(e) => setForm({ ...form, description: e.target.value })} placeholder="简要描述（可选）" maxLength={200} />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">详细上报内容 *</label>
          <textarea value={form.content} onInput={(e) => setForm({ ...form, content: e.target.value })} placeholder="请详细描述隐患情况..." rows={5} maxLength={1000} />
        </div>
        <div style={{ fontSize: 12, color: '#666', padding: '8px 10px', background: '#f6ffed', borderRadius: 4 }}>
          提交后：<b>状态</b>=待分派，<b>节点</b>=隐患上报，<b>时限</b>=24小时。由防火监督员接收后转办分派。
        </div>
      </Modal>

      <Modal
        title={`转办分派：${quickOrder?.order_no}`}
        visible={showQuickAssign}
        onClose={() => { setShowQuickAssign(false); setQuickOrder(null); }}
        onOk={() => doQuick(api.assignOrder, qf, setShowQuickAssign, '转办成功，已下发整改通知')}
        okText="确认转办"
        loading={quickSubmitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          转办后：<b>状态</b> → 已转办，<b>节点</b> → 整改通知，自动下发整改通知。
        </div>
        <div class="form-group">
          <label class="form-label">整改期限（天）</label>
          <input type="number" min="1" max="90" value={qf.days ?? 7} onInput={(e) => setQf({ ...qf, days: parseInt(e.target.value, 10) || 7 })} />
        </div>
        <div class="form-group">
          <label class="form-label">整改通知内容 *</label>
          <textarea value={qf.content || ''} onInput={(e) => setQf({ ...qf, content: e.target.value })} placeholder="请填写整改通知内容，明确整改要求..." rows={4} />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea value={qf.remark || ''} onInput={(e) => setQf({ ...qf, remark: e.target.value })} rows={2} />
        </div>
      </Modal>

      <Modal
        title={`提交整改记录：${quickOrder?.order_no}`}
        visible={showQuickRectify}
        onClose={() => { setShowQuickRectify(false); setQuickOrder(null); }}
        onOk={() => doQuick(api.rectifyOrder, qf, setShowQuickRectify, '整改记录已提交，进入复查节点')}
        okText="提交整改"
        loading={quickSubmitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#e6f7ff', borderRadius: 4 }}>
          提交后：<b>节点</b> → 复查销项，站点负责人接收后进行复查回访。
        </div>
        <div class="form-group">
          <label class="form-label">整改内容 *</label>
          <textarea value={qf.content || ''} onInput={(e) => setQf({ ...qf, content: e.target.value })} placeholder="请描述整改措施和完成情况..." rows={5} />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea value={qf.remark || ''} onInput={(e) => setQf({ ...qf, remark: e.target.value })} rows={2} />
        </div>
      </Modal>

      <Modal
        title={`复查回访：${quickOrder?.order_no}`}
        visible={showQuickRecheck}
        onClose={() => { setShowQuickRecheck(false); setQuickOrder(null); }}
        onOk={() => doQuick(api.recheckOrder, qf, setShowQuickRecheck, '回访完成，状态已更新')}
        okText="提交复查"
        loading={quickSubmitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          提交后：<b>状态</b> → 已回访，<b>节点</b> → 确认完成。
        </div>
        <div class="form-group">
          <label class="form-label">复查结果</label>
          <select value={qf.result || 'pass'} onInput={(e) => setQf({ ...qf, result: e.target.value })}>
            <option value="pass">通过（隐患已消除）</option>
            <option value="fail">不通过（需重新整改）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">复查内容 *</label>
          <textarea value={qf.content || ''} onInput={(e) => setQf({ ...qf, content: e.target.value })} placeholder="请描述现场复查情况..." rows={5} />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea value={qf.remark || ''} onInput={(e) => setQf({ ...qf, remark: e.target.value })} rows={2} />
        </div>
      </Modal>

      <Modal
        title={`确认完成：${quickOrder?.order_no}`}
        visible={showQuickConfirm}
        onClose={() => { setShowQuickConfirm(false); setQuickOrder(null); }}
        onOk={() => doQuick(api.confirmOrder, qf, setShowQuickConfirm, '已确认完成，隐患单闭环')}
        okText="确认完成"
        loading={quickSubmitting}
      >
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, padding: 10, background: '#f6ffed', borderRadius: 4 }}>
          确认后此隐患单处理完成，形成闭环。后续数据将进入历史统计。
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea value={qf.remark || ''} onInput={(e) => setQf({ ...qf, remark: e.target.value })} rows={3} />
        </div>
      </Modal>

      <Modal
        title={`处理节点超时：${quickOrder?.order_no}`}
        visible={showQuickTimeout}
        onClose={() => { setShowQuickTimeout(false); setQuickOrder(null); }}
        onOk={() => doQuick(api.handleTimeout, qf, setShowQuickTimeout, '超时处理记录已保存')}
        okText="提交处理"
        loading={quickSubmitting}
        width={560}
      >
        <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 12, padding: 10, background: '#fff1f0', borderRadius: 4 }}>
          当前节点「{quickOrder ? NODE_TEXT[quickOrder.current_node] : ''}」已超时，必须如实填写以下内容。
        </div>
        <div class="form-group">
          <label class="form-label">超时原因 *</label>
          <textarea value={qf.timeout_reason || ''} onInput={(e) => setQf({ ...qf, timeout_reason: e.target.value })} placeholder="请详细说明超时发生的原因..." rows={3} />
        </div>
        <div class="form-group">
          <label class="form-label">后续处理措施 *</label>
          <textarea value={qf.handle_action || ''} onInput={(e) => setQf({ ...qf, handle_action: e.target.value })} placeholder="请说明后续采取的处理措施..." rows={3} />
        </div>
        <div class="form-group">
          <label class="form-label">顺延天数（0 表示不顺延，最大 30 天）</label>
          <input type="number" min="0" max="30" value={qf.add_days ?? 0} onInput={(e) => setQf({ ...qf, add_days: Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)) })} />
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea value={qf.remark || ''} onInput={(e) => setQf({ ...qf, remark: e.target.value })} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
