import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '../utils/api';
import {
  STATUS_TEXT, NODE_TEXT, HAZARD_LEVEL_TEXT,
  formatTime, getDeadlineRemain, isDeadlinePassed,
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

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size };
      if (status && status !== 'all') params.status = status;
      if (keyword) params.keyword = keyword;
      const res = await api.listOrders(params);
      setList(res.list || []);
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
              return { ...o, status: m.status, current_node: m.current_node, is_timeout: m.is_timeout, updated_at: m.updated_at };
            }
            return o;
          }));
        }).catch(() => {});
        fetchStats();
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [list, fetchStats]);

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
      fetchList();
      fetchStats();
    } catch (err) {
      showToast(err.message || '创建失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / size));

  return (
    <div>
      {stats && (
        <div class="stat-cards">
          <div class="stat-card info">
            <div class="stat-label">隐患单总数</div>
            <div class="stat-value">{stats.total}</div>
          </div>
          <div class="stat-card warn">
            <div class="stat-label">待分派</div>
            <div class="stat-value">{stats.pending}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">已转办</div>
            <div class="stat-value">{stats.assigned}</div>
          </div>
          <div class="stat-card success">
            <div class="stat-label">已回访</div>
            <div class="stat-value">{stats.revisited}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">超时未处理</div>
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
              <option value="pending">待分派</option>
              <option value="assigned">已转办</option>
              <option value="revisited">已回访</option>
            </select>
            <input
              placeholder="搜索单号/标题/地点"
              value={keyword}
              onInput={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchList())}
            />
            <button class="btn-default" onClick={() => { setPage(1); fetchList(); }}>查询</button>
          </div>
          <div class="toolbar-right">
            <button class="btn-default" onClick={() => { fetchList(); fetchStats(); }}>刷新</button>
            {user.role === 'clerk' && (
              <button class="btn-primary" onClick={() => setShowCreate(true)}>+ 上报隐患</button>
            )}
          </div>
        </div>

        {loading ? (
          <div class="empty-state">加载中...</div>
        ) : list.length === 0 ? (
          <div class="empty-state">暂无数据</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>隐患单号</th>
                <th>标题</th>
                <th style={{ width: 120 }}>地点</th>
                <th style={{ width: 80 }}>等级</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ width: 120 }}>当前节点</th>
                <th style={{ width: 160 }}>节点时限</th>
                <th style={{ width: 110 }}>上报人</th>
                <th style={{ width: 160 }}>创建时间</th>
                <th style={{ width: 100 }}>操作</th>
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
                    <td class={`level-${o.hazard_level}`}>{HAZARD_LEVEL_TEXT[o.hazard_level] || o.hazard_level}</td>
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
                    <td>
                      {deadline ? (
                        <span style={{ color: isDeadlinePassed(deadline) || o.is_timeout ? '#ff4d4f' : '#333' }}>
                          {getDeadlineRemain(deadline)}
                        </span>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </td>
                    <td>{o.reporter_name}</td>
                    <td>{formatTime(o.created_at)}</td>
                    <td>
                      <a onClick={() => onOpenDetail(o.id)}>查看详情</a>
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
            <input
              value={form.title}
              onInput={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如：消防通道被占用"
              maxLength={80}
            />
          </div>
          <div class="form-group">
            <label class="form-label">隐患地点 *</label>
            <input
              value={form.location}
              onInput={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="如：朝阳区幸福小区"
              maxLength={100}
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">隐患等级</label>
            <select value={form.hazard_level} onInput={(e) => setForm({ ...form, hazard_level: e.target.value })}>
              <option value="general">一般</option>
              <option value="high">较大</option>
              <option value="critical">重大</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">简要描述</label>
            <input
              value={form.description}
              onInput={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="简要描述（可选）"
              maxLength={200}
            />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">详细上报内容 *</label>
          <textarea
            value={form.content}
            onInput={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="请详细描述隐患情况..."
            rows={5}
            maxLength={1000}
          />
        </div>
        <div style={{ fontSize: 12, color: '#999' }}>
          提交后进入「待分派」状态，由防火监督员分派转办。上报节点时限 24 小时。
        </div>
      </Modal>
    </div>
  );
}
