import { createEffect, createSignal, For, on, onCleanup } from 'solid-js';
import * as api from './api';

const STATUS_NAMES = {
  draft: '草稿',
  pending_audit: '待审核',
  needs_correction: '待补正',
  pending_review: '待复核',
  review_rejected: '复核驳回',
  archived: '已归档',
};

const STATUS_COLORS = {
  draft: 'gray',
  pending_audit: 'blue',
  needs_correction: 'orange',
  pending_review: 'purple',
  review_rejected: 'red',
  archived: 'green',
};

const MATERIAL_TYPE_NAMES = {
  customer_info: '用电客户资料',
  price_quotation: '报价测算材料',
  contract_confirm: '合同确认材料',
};

const ROLE_NAMES = {
  registrar: '登记员',
  auditor: '审核主管',
  reviewer: '复核负责人',
};

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(status) {
  return `badge badge-${STATUS_COLORS[status] || 'gray'}`;
}

// ——— Toast ———
function useToasts() {
  const [toasts, setToasts] = createSignal([]);
  let idSeq = 0;
  const show = (msg, type = 'info') => {
    const id = ++idSeq;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  };
  const ToastView = () => (
    <div class="toast">
      <For each={toasts()}>
        {(t) => <div class={`toast-item ${t.type}`}>{t.msg}</div>}
      </For>
    </div>
  );
  return { show, ToastView };
}

export default function App() {
  const { show, ToastView } = useToasts();

  const [role, setRole] = createSignal(localStorage.getItem('role') || 'registrar');
  const [roles, setRoles] = createSignal([]);
  const [stats, setStats] = createSignal({});
  const [contracts, setContracts] = createSignal([]);
  const [listMeta, setListMeta] = createSignal({});
  const [loading, setLoading] = createSignal(false);

  const [statusFilter, setStatusFilter] = createSignal('');
  const [search, setSearch] = createSignal('');
  const [selected, setSelected] = createSignal(new Set());
  const [detailId, setDetailId] = createSignal(null);
  const [detail, setDetail] = createSignal(null);
  const [detailTab, setDetailTab] = createSignal('info');
  const [bulkComment, setBulkComment] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [form, setForm] = createSignal({});
  const [actionLoading, setActionLoading] = createSignal(false);

  createEffect(() => {
    localStorage.setItem('role', role());
    refreshAll();
  });

  onCleanup(() => {});

  async function refreshAll() {
    setLoading(true);
    try {
      const [roleRes, statRes, listRes] = await Promise.all([
        api.listRoles(),
        api.getStatistics(),
        api.listContracts(role(), statusFilter()),
      ]);
      setRoles(roleRes.data || []);
      setStats(statRes.data || {});
      setContracts(listRes.data || []);
      setListMeta({
        current_role: listRes.current_role,
        current_role_name: listRes.current_role_name,
        current_user: listRes.current_user,
      });
    } catch (e) {
      show(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function refreshDetailIfOpen() {
    if (detailId()) {
      try {
        const res = await api.getContract(detailId());
        setDetail(res.data);
      } catch (e) {
        show(e.message, 'error');
      }
    }
  }

  function onStatusFilterClick(status) {
    setStatusFilter((s) => (s === status ? '' : status));
  }

  createEffect(
    on(statusFilter, () => {
      refreshAll();
    })
  );

  // ——— Detail ———
  async function openDetail(id) {
    setDetailId(id);
    setEditing(false);
    setDetailTab('info');
    setForm({});
    setActionLoading(false);
    try {
      const res = await api.getContract(id);
      setDetail(res.data);
    } catch (e) {
      show(e.message, 'error');
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setEditing(false);
  }

  function toggleSelect(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const visibleIds = filteredContracts().map((c) => c.id);
    const allSelected = visibleIds.every((id) => selected().has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  }

  function filteredContracts() {
    const q = search().trim().toLowerCase();
    return contracts().filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.contract_no.toLowerCase().includes(q) ||
        (c.customer && c.customer.name && c.customer.name.toLowerCase().includes(q))
      );
    });
  }

  // ——— Actions ———
  async function handleCreate() {
    const title = prompt('请输入合同标题：', '新建售电合同');
    if (!title) return;
    try {
      await api.createContract(title.trim());
      show('已创建草稿', 'success');
      refreshAll();
    } catch (e) {
      show(e.message, 'error');
    }
  }

  function startEdit() {
    if (!detail()) return;
    const d = detail();
    setForm({
      customer: d.customer ? { ...d.customer } : null,
      price_quotation: d.price_quotation ? { ...d.price_quotation } : null,
      materials: d.materials ? d.materials.map((m) => ({ ...m })) : [],
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm({});
  }

  function updateFormField(section, field, value) {
    setForm((f) => {
      const next = { ...f };
      next[section] = next[section] ? { ...next[section] } : {};
      next[section][field] = value;
      return next;
    });
  }

  async function saveDraft() {
    if (!detail()) return;
    setActionLoading(true);
    try {
      const payload = {
        expected_version: detail().version,
      };
      if (form().customer) payload.customer = form().customer;
      if (form().price_quotation) {
        const pq = { ...form().price_quotation };
        if (pq.quotation_valid_until && typeof pq.quotation_valid_until === 'string') {
          pq.quotation_valid_until = new Date(pq.quotation_valid_until).toISOString();
        }
        payload.price_quotation = pq;
      }
      if (form().materials) payload.materials = form().materials;
      const res = await api.updateDraft(detail().id, payload);
      setDetail(res.data);
      setEditing(false);
      show('草稿已保存', 'success');
      refreshAll();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitForAudit() {
    if (!detail()) return;
    const confirmMsg = '确认提交该合同至审核主管？审核主管将在设定时限内办理。';
    if (!confirm(confirmMsg)) return;
    setActionLoading(true);
    try {
      const res = await api.submitContract(detail().id, {
        expected_version: detail().version,
        deadline_hours: 48,
      });
      setDetail(res.data);
      show('已提交审核', 'success');
      refreshAll();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function doAudit(pass) {
    if (!detail()) return;
    const d = detail();
    const commentEl = document.getElementById('audit-comment');
    const comment = commentEl ? commentEl.value.trim() : '';
    const action = pass ? '审核通过并提交复核' : '退回补正';
    if (!confirm(`确认${action}？`)) return;
    setActionLoading(true);
    try {
      let res;
      if (pass) {
        const contractConfirm = d.contract_confirm ? { ...d.contract_confirm } : null;
        if (contractConfirm) {
          for (const k of ['signing_date', 'effective_date', 'expiry_date']) {
            if (contractConfirm[k] && typeof contractConfirm[k] === 'string') {
              contractConfirm[k] = new Date(contractConfirm[k]).toISOString();
            }
          }
        }
        res = await api.auditPass(d.id, {
          expected_version: d.version,
          comment,
          deadline_hours: 72,
          contract_confirm: contractConfirm,
        });
      } else {
        res = await api.auditReject(d.id, {
          expected_version: d.version,
          comment,
          deadline_hours: 24,
        });
      }
      setDetail(res.data);
      show(pass ? '审核通过，已提交复核' : '已退回补正', 'success');
      refreshAll();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function doReview(pass) {
    if (!detail()) return;
    const d = detail();
    const commentEl = document.getElementById('review-comment');
    const comment = commentEl ? commentEl.value.trim() : '';
    const action = pass ? '复核通过并归档' : '复核驳回';
    if (!confirm(`确认${action}？`)) return;
    setActionLoading(true);
    try {
      let res;
      if (pass) {
        res = await api.reviewPass(d.id, {
          expected_version: d.version,
          comment,
        });
      } else {
        res = await api.reviewReject(d.id, {
          expected_version: d.version,
          comment,
          deadline_hours: 24,
        });
      }
      setDetail(res.data);
      show(pass ? '复核通过，合同已归档' : '已复核驳回', 'success');
      refreshAll();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBatch(action) {
    const ids = Array.from(selected());
    if (ids.length === 0) {
      show('请先勾选合同', 'warn');
      return;
    }
    const comment = bulkComment().trim() || '批量处理';
    if (!confirm(`确认对 ${ids.length} 份合同执行批量操作？`)) return;
    setActionLoading(true);
    try {
      const res = await api.batchProcess({ contract_ids: ids, action, comment });
      if (res.success_count > 0) show(`成功处理 ${res.success_count} 份`, 'success');
      if (res.failed_count > 0) {
        show(`失败 ${res.failed_count} 份: ${res.failed.map((f) => f.reason).slice(0, 2).join('；')}`, 'error');
      }
      setSelected(new Set());
      setBulkComment('');
      refreshAll();
      refreshDetailIfOpen();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // ——— Role-based UI helpers ———
  function canEditDraft() {
    if (!detail()) return false;
    const s = detail().status;
    return role() === 'registrar' && (s === 'draft' || s === 'needs_correction');
  }

  function canSubmit() {
    if (!detail()) return false;
    const s = detail().status;
    return role() === 'registrar' && (s === 'draft' || s === 'needs_correction');
  }

  function canAudit() {
    if (!detail()) return false;
    const s = detail().status;
    return role() === 'auditor' && (s === 'pending_audit' || s === 'review_rejected');
  }

  function canReview() {
    if (!detail()) return false;
    return role() === 'reviewer' && detail().status === 'pending_review';
  }

  // ——— Render ———
  const statCards = [
    { key: 'total', label: '全部合同' },
    { key: 'draft', label: '草稿' },
    { key: 'pending_audit', label: '待审核' },
    { key: 'needs_correction', label: '等补正' },
    { key: 'pending_review', label: '等复核' },
    { key: 'review_rejected', label: '复核驳回' },
    { key: 'archived', label: '已归档' },
    { key: 'expired', label: '已逾期' },
  ];

  function batchActionsAvailable() {
    const r = role();
    if (r === 'auditor') return ['audit_pass', 'audit_reject'];
    if (r === 'reviewer') return ['review_pass', 'review_reject'];
    return [];
  }

  const batchActionLabels = {
    audit_pass: '批量审核通过',
    audit_reject: '批量退回补正',
    review_pass: '批量复核归档',
    review_reject: '批量复核驳回',
  };

  return (
    <div class="app">
      <header class="header">
        <h1>售电公司 · 到期预警处理售电合同单系统</h1>
        <div class="header-right">
          <div class="role-select">
            <span>当前岗位：</span>
            <select value={role()} onChange={(e) => setRole(e.target.value)}>
              <For each={roles()}>
                {(r) => <option value={r.value}>{r.label}</option>}
              </For>
            </select>
            <span style={{ opacity: 0.85, fontSize: 12 }}>（{listMeta().current_user || '演示用户'}）</span>
          </div>
          <button class="btn btn-sm" onClick={refreshAll}>
            🔄 刷新
          </button>
        </div>
      </header>

      <main class="main">
        <div class="stats-bar">
          <For each={statCards}>
            {(sc) => {
              const val = stats()[sc.key] || 0;
              const isFilter = sc.key !== 'total' && sc.key !== 'expired';
              const active = isFilter && statusFilter() === sc.key;
              return (
                <div
                  class={`stat-card ${sc.key} ${active ? 'active' : ''}`}
                  onClick={() => (isFilter ? onStatusFilterClick(sc.key) : null)}
                  style={!isFilter ? { cursor: 'default' } : {}}
                  title={isFilter ? '点击筛选列表' : ''}
                >
                  <div class="stat-label">{sc.label}</div>
                  <div class="stat-value">{val}</div>
                </div>
              );
            }}
          </For>
        </div>

        {selected().size > 0 && batchActionsAvailable().length > 0 && (
          <div class="bulk-actions">
            <strong>已选 {selected().size} 份</strong>
            <span>批量操作意见：</span>
            <input
              class="comment-box"
              style={{ minHeight: 30, flex: 1, maxWidth: 320, padding: '4px 8px' }}
              placeholder="可填写批量处理意见..."
              value={bulkComment()}
              onInput={(e) => setBulkComment(e.target.value)}
            />
            <For each={batchActionsAvailable()}>
              {(a) => (
                <button
                  class={`btn btn-sm ${a.includes('pass') ? 'btn-success' : 'btn-warn'}`}
                  onClick={() => handleBatch(a)}
                  disabled={actionLoading()}
                >
                  {batchActionLabels[a]}
                </button>
              )}
            </For>
            <button class="btn btn-sm" onClick={() => setSelected(new Set())}>
              清空
            </button>
          </div>
        )}

        <div class="toolbar">
          <div class="search-box">
            <input
              placeholder="搜索合同标题 / 编号 / 客户名"
              value={search()}
              onInput={(e) => setSearch(e.target.value)}
            />
          </div>
          {statusFilter() && (
            <button class="btn btn-sm" onClick={() => setStatusFilter('')}>
              清除状态筛选
            </button>
          )}
          <div style={{ flex: 1 }} />
          {role() === 'registrar' && (
            <button class="btn btn-primary btn-sm" onClick={handleCreate}>
              + 新建合同
            </button>
          )}
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    class="checkbox"
                    checked={
                      filteredContracts().length > 0 &&
                      filteredContracts().every((c) => selected().has(c.id))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>合同编号</th>
                <th>合同标题</th>
                <th>用电客户</th>
                <th>状态</th>
                <th>当前处理岗位</th>
                <th>时限 / 逾期</th>
                <th>创建时间</th>
                <th style={{ width: 90 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredContracts()}>
                {(c) => {
                  const expiry = c.expiry_info || {};
                  const expired = !!expiry.is_expired;
                  return (
                    <tr class={expired ? 'expired-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          class="checkbox"
                          checked={selected().has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.contract_no}</span>
                      </td>
                      <td>
                        {c.title}
                        {expired && <span class="expired-tag">⚠ 逾期 {expiry.overdue_hours}h</span>}
                      </td>
                      <td>{c.customer ? c.customer.name : '-'}</td>
                      <td>
                        <span class={statusBadge(c.status)}>{STATUS_NAMES[c.status] || c.status}</span>
                      </td>
                      <td>{c.current_handler_role ? ROLE_NAMES[c.current_handler_role] : '-'}</td>
                      <td>
                        {expiry.deadline ? (
                          <div>
                            <div style={{ fontSize: 12 }}>{formatDate(expiry.deadline)}</div>
                            {expired && (
                              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                已逾期 {expiry.overdue_hours} 小时
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{formatDate(c.created_at)}</td>
                      <td>
                        <button class="btn btn-sm" onClick={() => openDetail(c.id)}>
                          详情
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
              {filteredContracts().length === 0 && (
                <tr>
                  <td colSpan="9">
                    <div class="empty-state">
                      {loading() ? '加载中...' : '暂无合同数据'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Detail Modal */}
      {detailId() && detail() && (
        <DetailModal
          detail={detail()}
          editing={editing()}
          form={form()}
          detailTab={detailTab()}
          role={role()}
          actionLoading={actionLoading()}
          onClose={closeDetail}
          setDetailTab={setDetailTab}
          updateFormField={updateFormField}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveDraft={saveDraft}
          submitForAudit={submitForAudit}
          doAudit={doAudit}
          doReview={doReview}
          canEditDraft={canEditDraft}
          canSubmit={canSubmit}
          canAudit={canAudit}
          canReview={canReview}
          setForm={setForm}
          onRefresh={refreshDetailIfOpen}
        />
      )}

      <ToastView />
    </div>
  );
}

// ——— Detail Modal ———
function DetailModal(props) {
  const d = () => props.detail;
  const expiry = () => (d()?.expiry_info || {});

  return (
    <div class="modal-backdrop" onClick={(e) => (e.target.classList.contains('modal-backdrop') ? props.onClose() : null)}>
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>
              {d().title}
              <span style={{ marginLeft: 10, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                {d().contract_no}
              </span>
            </h2>
            <div class="status-meta" style={{ marginTop: 4 }}>
              <span class={statusBadge(d().status)}>{STATUS_NAMES[d().status] || d().status}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                v{d().version} · 创建人：{d().created_by} · {formatDate(d().created_at)}
              </span>
            </div>
          </div>
          <button class="modal-close" onClick={props.onClose}>
            ×
          </button>
        </div>

        <div class="modal-body">
          {expiry().is_expired && (
            <div class="expiry-alert">
              <div class="expiry-alert-title">⚠ 本合同已逾期 {expiry().overdue_hours} 小时</div>
              <div class="expiry-alert-text">
                <div>
                  <strong>逾期原因：</strong>
                  {expiry().reason}
                </div>
                <div>
                  <strong>后续处理动作：</strong>
                  {expiry().next_action}
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>时限截止：</strong>
                  {formatDate(expiry().deadline)}
                </div>
              </div>
            </div>
          )}

          <div class="tabs">
            <div
              class={`tab ${props.detailTab === 'info' ? 'active' : ''}`}
              onClick={() => props.setDetailTab('info')}
            >
              合同信息
            </div>
            <div
              class={`tab ${props.detailTab === 'materials' ? 'active' : ''}`}
              onClick={() => props.setDetailTab('materials')}
            >
              材料清单
            </div>
            <div
              class={`tab ${props.detailTab === 'comments' ? 'active' : ''}`}
              onClick={() => props.setDetailTab('comments')}
            >
              处理意见
            </div>
            <div
              class={`tab ${props.detailTab === 'audit' ? 'active' : ''}`}
              onClick={() => props.setDetailTab('audit')}
            >
              审计记录
            </div>
          </div>

          {props.detailTab === 'info' && <InfoTab detail={d()} editing={props.editing} form={props.form} updateFormField={props.updateFormField} setForm={props.setForm} />}
          {props.detailTab === 'materials' && <MaterialsTab detail={d()} editing={props.editing} form={props.form} setForm={props.setForm} />}
          {props.detailTab === 'comments' && <CommentsTab detail={d()} />}
          {props.detailTab === 'audit' && <AuditTab detail={d()} />}
        </div>

        <div class="modal-footer">
          <button class="btn" onClick={props.onClose}>
            关闭
          </button>
          <button class="btn btn-sm" onClick={props.onRefresh}>
            🔄 刷新
          </button>
          {props.editing && (
            <>
              <button class="btn" onClick={props.cancelEdit} disabled={props.actionLoading}>
                取消编辑
              </button>
              <button class="btn btn-primary" onClick={props.saveDraft} disabled={props.actionLoading}>
                💾 保存草稿
              </button>
            </>
          )}
          {!props.editing && props.canEditDraft() && (
            <button class="btn btn-primary" onClick={props.startEdit} disabled={props.actionLoading}>
              ✏️ 编辑
            </button>
          )}
          {!props.editing && props.canSubmit() && (
            <button class="btn btn-success" onClick={props.submitForAudit} disabled={props.actionLoading}>
              📤 提交审核
            </button>
          )}
          {!props.editing && props.canAudit() && (
            <>
              <button class="btn btn-warn" onClick={() => props.doAudit(false)} disabled={props.actionLoading}>
                退回补正
              </button>
              <button class="btn btn-success" onClick={() => props.doAudit(true)} disabled={props.actionLoading}>
                审核通过
              </button>
            </>
          )}
          {!props.editing && props.canReview() && (
            <>
              <button class="btn btn-danger" onClick={() => props.doReview(false)} disabled={props.actionLoading}>
                复核驳回
              </button>
              <button class="btn btn-success" onClick={() => props.doReview(true)} disabled={props.actionLoading}>
                复核归档
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTab(props) {
  const d = () => props.detail;
  const editing = () => props.editing;
  const f = () => props.form;

  const getField = (section, field, def = '') => {
    if (editing()) {
      return f()[section]?.[field] ?? d()[section]?.[field] ?? def;
    }
    return d()[section]?.[field] ?? def;
  };

  const field = (section, field, label, type = 'text', placeholder = '') => (
    <div>
      <div class="field-label">{label}</div>
      <div class="field-value">
        {editing() ? (
          <input
            type={type}
            value={String(getField(section, field, ''))}
            placeholder={placeholder}
            onInput={(e) => props.updateFormField(section, field, type === 'number' ? Number(e.target.value) : e.target.value)}
          />
        ) : (
          (getField(section, field, '-'))
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div class="section">
        <div class="section-title">用电客户信息</div>
        {!d().customer && !editing() && <div class="info-tip">尚未填写用电客户信息</div>}
        <div class="grid-2">
          {field('customer', 'name', '客户名称')}
          {field('customer', 'customer_id', '客户编号')}
          {field('customer', 'address', '客户地址')}
          {field('customer', 'contact_person', '联系人')}
          {field('customer', 'contact_phone', '联系电话')}
          {field('customer', 'power_consumption', '月用电量(万kWh)', 'number')}
        </div>
      </div>

      <div class="section">
        <div class="section-title">报价测算</div>
        {!d().price_quotation && !editing() && <div class="info-tip">尚未填写报价测算信息</div>}
        <div class="grid-3">
          {field('price_quotation', 'quoted_price', '报价电价(元/kWh)', 'number')}
          {field('price_quotation', 'contract_term_months', '合同期限(月)', 'number')}
          {field('price_quotation', 'estimated_annual_amount', '预估年金额(万元)', 'number')}
          {field('price_quotation', 'settlement_method', '结算方式')}
          <div>
            <div class="field-label">报价有效期至</div>
            <div class="field-value">
              {editing() ? (
                <input
                  type="datetime-local"
                  value={getField('price_quotation', 'quotation_valid_until', '').slice(0, 16)}
                  onInput={(e) => props.updateFormField('price_quotation', 'quotation_valid_until', e.target.value)}
                />
              ) : (
                formatDate(getField('price_quotation', 'quotation_valid_until', ''))
              )}
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">合同确认</div>
        {!d().contract_confirm && !editing() && <div class="info-tip">尚未填写合同确认信息（审核阶段填写）</div>}
        <div class="grid-3">
          {field('contract_confirm', 'confirmed_price', '确认电价(元/kWh)', 'number')}
          {field('contract_confirm', 'confirmed_term_months', '确认期限(月)', 'number')}
          <div>
            <div class="field-label">签署日期</div>
            <div class="field-value">
              {editing() ? (
                <input
                  type="datetime-local"
                  value={getField('contract_confirm', 'signing_date', '').slice(0, 16)}
                  onInput={(e) => props.updateFormField('contract_confirm', 'signing_date', e.target.value)}
                />
              ) : (
                formatDate(getField('contract_confirm', 'signing_date', ''))
              )}
            </div>
          </div>
          <div>
            <div class="field-label">生效日期</div>
            <div class="field-value">
              {editing() ? (
                <input
                  type="datetime-local"
                  value={getField('contract_confirm', 'effective_date', '').slice(0, 16)}
                  onInput={(e) => props.updateFormField('contract_confirm', 'effective_date', e.target.value)}
                />
              ) : (
                formatDate(getField('contract_confirm', 'effective_date', ''))
              )}
            </div>
          </div>
          <div>
            <div class="field-label">到期日期</div>
            <div class="field-value">
              {editing() ? (
                <input
                  type="datetime-local"
                  value={getField('contract_confirm', 'expiry_date', '').slice(0, 16)}
                  onInput={(e) => props.updateFormField('contract_confirm', 'expiry_date', e.target.value)}
                />
              ) : (
                formatDate(getField('contract_confirm', 'expiry_date', ''))
              )}
            </div>
          </div>
        </div>
      </div>

      {d().current_deadline && (
        <div class="section">
          <div class="section-title">时限信息</div>
          <div class="grid-2">
            <div>
              <div class="field-label">当前处理岗位</div>
              <div class="field-value">{ROLE_NAMES[d().current_handler_role] || '-'}</div>
            </div>
            <div>
              <div class="field-label">处理时限截止</div>
              <div class="field-value" style={d().expiry_info?.is_expired ? { color: '#dc2626', fontWeight: 600 } : {}}>
                {formatDate(d().current_deadline)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialsTab(props) {
  const d = () => props.detail;
  const editing = () => props.editing;

  function addMaterial() {
    const now = new Date().toISOString();
    const id = Math.random().toString(36).slice(2, 10);
    const newMat = {
      id,
      type: 'customer_info',
      name: '新上传材料.pdf',
      uploaded_at: now,
      uploaded_by: '演示用户',
      note: '',
    };
    const mats = props.form().materials ? [...props.form().materials] : (d().materials || []).map((m) => ({ ...m }));
    mats.push(newMat);
    props.setForm({ ...props.form(), materials: mats });
  }

  function removeMaterial(idx) {
    const mats = [...(props.form().materials || [])];
    mats.splice(idx, 1);
    props.setForm({ ...props.form(), materials: mats });
  }

  function updateMaterial(idx, field, value) {
    const mats = [...(props.form().materials || [])];
    mats[idx] = { ...mats[idx], [field]: value };
    props.setForm({ ...props.form(), materials: mats });
  }

  const mats = () => (editing() ? props.form().materials || d().materials || [] : d().materials || []);

  return (
    <div>
      <div class="info-tip">
        推进合同需具备：<strong>用电客户资料</strong> + <strong>报价测算材料</strong>（提交审核前）；
        <strong>合同确认材料</strong> + 信息一致（提交复核前）。
      </div>
      {editing() && (
        <button class="btn btn-sm btn-primary" onClick={addMaterial} style={{ marginBottom: 10 }}>
          + 补充材料
        </button>
      )}
      <For each={mats()}>
        {(m, idx) => (
          <div class="material-item">
            <div>
              <span class="material-type-tag">{MATERIAL_TYPE_NAMES[m.type] || m.type}</span>
              {editing() ? (
                <select
                  value={m.type}
                  onChange={(e) => updateMaterial(idx(), 'type', e.target.value)}
                  style={{ marginRight: 8 }}
                >
                  {Object.entries(MATERIAL_TYPE_NAMES).map(([k, v]) => (
                    <option value={k}>{v}</option>
                  ))}
                </select>
              ) : null}
              {editing() ? (
                <input
                  value={m.name}
                  onInput={(e) => updateMaterial(idx(), 'name', e.target.value)}
                  style={{ padding: '2px 6px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 4, marginRight: 8 }}
                />
              ) : (
                <span class="material-name">{m.name}</span>
              )}
              <div class="material-meta">
                {m.uploaded_by} · {formatDate(m.uploaded_at)}
                {m.note ? ` · ${m.note}` : ''}
              </div>
            </div>
            {editing() && (
              <button class="btn btn-sm btn-danger" onClick={() => removeMaterial(idx())}>
                删除
              </button>
            )}
          </div>
        )}
      </For>
      {mats().length === 0 && <div class="empty-state">暂无材料</div>}
    </div>
  );
}

function CommentsTab(props) {
  const d = () => props.detail;
  return (
    <div>
      {d().auditor_comment && (
        <div class="section">
          <div class="section-title">审核主管意见</div>
          <div class="field-value" style={{ whiteSpace: 'pre-wrap' }}>{d().auditor_comment}</div>
        </div>
      )}
      {d().reviewer_comment && (
        <div class="section">
          <div class="section-title">复核负责人意见</div>
          <div class="field-value" style={{ whiteSpace: 'pre-wrap' }}>{d().reviewer_comment}</div>
        </div>
      )}
      {d().status === 'pending_audit' || d().status === 'review_rejected' ? (
        <div class="section">
          <div class="section-title">填写审核意见</div>
          <textarea
            id="audit-comment"
            class="comment-box"
            placeholder={
              d().status === 'review_rejected'
                ? '请根据复核驳回意见填写调整说明或重新审核意见...'
                : '通过需填写意见，退回需填写详细补正要求（至少5个字符）...'
            }
          />
          <div class="info-tip" style={{ marginTop: 6 }}>
            通过审核将把合同提交至复核负责人；退回将打回登记员补正。
          </div>
        </div>
      ) : null}
      {d().status === 'pending_review' && (
        <div class="section">
          <div class="section-title">填写复核意见</div>
          <textarea
            id="review-comment"
            class="comment-box"
            placeholder="通过需填写复核意见，驳回需填写详细驳回理由（至少5个字符）..."
          />
          <div class="info-tip" style={{ marginTop: 6 }}>
            复核通过即归档合同；驳回将退回审核主管调整。系统会校验合同确认信息与报价是否一致。
          </div>
        </div>
      )}
      {!d().auditor_comment && !d().reviewer_comment && d().status !== 'pending_audit' && d().status !== 'pending_review' && d().status !== 'review_rejected' && (
        <div class="empty-state">暂无处理意见</div>
      )}
    </div>
  );
}

function AuditTab(props) {
  const d = () => props.detail;
  const records = () => (d().audit_records || []).slice().reverse();
  return (
    <div>
      {records().length === 0 ? (
        <div class="empty-state">暂无审计记录</div>
      ) : (
        <div class="audit-trail">
          <For each={records()}>
            {(r) => (
              <div class="audit-item">
                <div class="audit-time">{formatDate(r.created_at)}</div>
                <div class="audit-action">
                  {r.action}
                  <span class="badge" style={{ marginLeft: 8 }}>
                    {STATUS_NAMES[r.new_status] || r.new_status}
                  </span>
                </div>
                <div class="audit-operator">
                  {r.operator} · {ROLE_NAMES[r.role] || r.role}
                  {r.previous_status ? `  (${STATUS_NAMES[r.previous_status]} → ${STATUS_NAMES[r.new_status]})` : ''}
                </div>
                {r.comment && <div class="audit-comment">💬 {r.comment}</div>}
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
}
