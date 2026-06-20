import { createSignal, Component, onMount, createEffect, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Layout } from "../../components/Layout";
import { Modal } from "../../components/Modal";
import { Alert } from "../../components/Alert";
import { api } from "../../lib/api";
import { useApp, statusLabels, statusColors, nodeLabels, roleLabels, actionLabels } from "../../lib/store";

interface Bill {
  id: number;
  bill_no: string;
  period: string;
  park_name: string;
  building: string;
  room: string;
  status: string;
  current_node: string;
  current_responsible_role: string;
  total_amount: number;
  is_overdue: boolean;
  overdue_hours: number;
  has_meter_reading: boolean;
  has_bill_generated: boolean;
  has_payment_verified: boolean;
  allowed_actions: string[];
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_count: number;
  draft_count: number;
  pending_audit_count: number;
  rejected_count: number;
  audited_count: number;
  pending_review_count: number;
  archived_count: number;
  overdue_count: number;
  total_amount: number;
}

const BillList: Component = () => {
  const app = useApp();
  const navigate = useNavigate();
  const [bills, setBills] = createSignal<Bill[]>([]);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());
  const [filters, setFilters] = createSignal({ status: "", period: "", is_overdue: "" });
  const [alert, setAlert] = createSignal({ type: "", message: "", show: false });

  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showActionModal, setShowActionModal] = createSignal(false);
  const [actionData, setActionData] = createSignal({ action: "", anomaly_reason: "", remark: "" });
  const [formData, setFormData] = createSignal({
    period: "2026-06",
    park_name: "",
    building: "",
    room: "",
    electricity_usage: "",
    water_usage: "",
    gas_usage: "",
    electricity_amount: "",
    water_amount: "",
    gas_amount: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filters().status) params.status = filters().status;
      if (filters().period) params.period = filters().period;
      if (filters().is_overdue === "true") params.is_overdue = true;
      if (filters().is_overdue === "false") params.is_overdue = false;

      const [listData, statsData] = await Promise.all([
        api.getBills(params),
        api.getBillStats(),
      ]);
      setBills(listData.items);
      setStats(statsData);
    } catch (err: any) {
      showAlert("error", err.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type: string, message: string) => {
    setAlert({ type, message, show: true });
    setTimeout(() => setAlert({ ...alert(), show: false }), 3000);
  };

  onMount(() => {
    loadData();
    const interval = setInterval(() => {
      if (!loading()) loadData();
    }, 30000);
    return () => clearInterval(interval);
  });

  const handleCreate = async () => {
    try {
      const data = {
        ...formData(),
        electricity_usage: parseFloat(formData().electricity_usage) || 0,
        water_usage: parseFloat(formData().water_usage) || 0,
        gas_usage: parseFloat(formData().gas_usage) || 0,
        electricity_amount: parseFloat(formData().electricity_amount) || 0,
        water_amount: parseFloat(formData().water_amount) || 0,
        gas_amount: parseFloat(formData().gas_amount) || 0,
      };
      await api.createBill(data);
      setShowCreateModal(false);
      showAlert("success", "账单创建成功");
      loadData();
    } catch (err: any) {
      showAlert("error", err.message || "创建失败");
    }
  };

  const handleAction = async (billId: number, action: string) => {
    setActionData({ action, anomaly_reason: "", remark: "" });
    setSelected(new Set([billId]));
    setShowActionModal(true);
  };

  const handleBatchAction = async (action: string) => {
    if (selected().size === 0) {
      showAlert("warning", "请先选择要操作的账单");
      return;
    }
    setActionData({ action, anomaly_reason: "", remark: "" });
    setShowActionModal(true);
  };

  const submitAction = async () => {
    try {
      const ids = Array.from(selected());
      let result;
      if (ids.length === 1) {
        result = await api.performAction(
          ids[0],
          actionData().action,
          actionData().anomaly_reason,
          actionData().remark
        );
      } else {
        result = await api.batchAction(
          ids,
          actionData().action,
          actionData().anomaly_reason,
          actionData().remark
        );
      }
      setShowActionModal(false);
      setSelected(new Set());
      showAlert("success", result.message || "操作成功");
      loadData();
    } catch (err: any) {
      showAlert("error", err.message || "操作失败");
    }
  };

  const handleDelete = async (billId: number) => {
    if (!confirm("确定要删除该账单吗？")) return;
    try {
      await api.deleteBill(billId);
      showAlert("success", "删除成功");
      loadData();
    } catch (err: any) {
      showAlert("error", err.message || "删除失败");
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected());
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected().size === bills().length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bills().map(b => b.id)));
    }
  };

  const getActionButtonClass = (action: string) => {
    if (action.includes("approve")) return "btn-success";
    if (action.includes("reject")) return "btn-danger";
    if (action === "delete") return "btn-danger";
    if (action.includes("submit")) return "btn-primary";
    return "btn-secondary";
  };

  return (
    <Layout>
      <div class="page-header">
        <h1>📋 能耗账单列表</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {app.hasRole("registrar") && (
            <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              + 新建账单
            </button>
          )}
          <button class="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      <Alert type={alert().type as any} message={alert().message} show={alert().show} />

      {stats() && (
        <div class="stats-grid">
          <div class="stat-card">
            <div class="label">账单总数</div>
            <div class="value">{stats()!.total_count}</div>
          </div>
          <div class="stat-card">
            <div class="label">待处理</div>
            <div class="value">{stats()!.pending_audit_count + stats()!.audited_count}</div>
          </div>
          <div class="stat-card">
            <div class="label">已驳回</div>
            <div class="value">{stats()!.rejected_count}</div>
          </div>
          <div class="stat-card">
            <div class="label">已归档</div>
            <div class="value">{stats()!.archived_count}</div>
          </div>
          <div class="stat-card">
            <div class="label">超时账单</div>
            <div class="value overdue">{stats()!.overdue_count}</div>
          </div>
          <div class="stat-card">
            <div class="label">总金额</div>
            <div class="value amount">¥{stats()!.total_amount.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div class="filter-bar">
        <div class="form-group">
          <label>状态筛选</label>
          <select
            value={filters().status}
            onChange={(e) => setFilters({ ...filters(), status: e.target.value })}
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending_audit">待审核</option>
            <option value="rejected">已驳回</option>
            <option value="audited">已审核待复核</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div class="form-group">
          <label>账期</label>
          <input
            type="text"
            value={filters().period}
            onInput={(e) => setFilters({ ...filters(), period: e.target.value })}
            placeholder="如: 2026-06"
          />
        </div>
        <div class="form-group">
          <label>超时状态</label>
          <select
            value={filters().is_overdue}
            onChange={(e) => setFilters({ ...filters(), is_overdue: e.target.value })}
          >
            <option value="">全部</option>
            <option value="true">已超时</option>
            <option value="false">未超时</option>
          </select>
        </div>
        <button class="btn btn-secondary" onClick={loadData}>查询</button>
      </div>

      {selected().size > 0 && (
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="selected-count">已选择 {selected().size} 条</span>
            {app.hasRole("registrar") && (
              <>
                <button class="btn btn-primary btn-sm" onClick={() => handleBatchAction("submit_audit")}>批量提交审核</button>
              </>
            )}
            {app.hasRole("auditor") && (
              <>
                <button class="btn btn-success btn-sm" onClick={() => handleBatchAction("audit_approve")}>批量审核通过</button>
                <button class="btn btn-danger btn-sm" onClick={() => handleBatchAction("audit_reject")}>批量审核驳回</button>
              </>
            )}
            {app.hasRole("property") && (
              <>
                <button class="btn btn-success btn-sm" onClick={() => handleBatchAction("review_approve")}>批量复核归档</button>
                <button class="btn btn-danger btn-sm" onClick={() => handleBatchAction("review_reject")}>批量复核驳回</button>
              </>
            )}
          </div>
          <div class="toolbar-right">
            <button class="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>取消选择</button>
          </div>
        </div>
      )}

      <div class="table-container">
        {loading() ? (
          <div class="loading"><div class="spinner"></div><p>加载中...</p></div>
        ) : bills().length === 0 ? (
          <div class="empty"><div class="icon">📭</div><p>暂无账单数据</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th class="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selected().size === bills().length && bills().length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>账单编号</th>
                <th>账期</th>
                <th>园区/楼栋/房间</th>
                <th>状态</th>
                <th>当前节点</th>
                <th>责任人</th>
                <th>金额</th>
                <th>三单状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={bills()}>
                {(bill) => (
                  <tr
                    class={`row-selectable ${selected().has(bill.id) ? "row-selected" : ""}`}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("button, input")) {
                        navigate(`/bills/${bill.id}`);
                      }
                    }}
                  >
                    <td class="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected().has(bill.id)}
                        onChange={() => toggleSelect(bill.id)}
                      />
                    </td>
                    <td>
                      <span class="bill-no">{bill.bill_no}</span>
                      {bill.is_overdue && (
                        <div>
                          <span class="overdue-badge">
                            ⚠️ 超时 {bill.overdue_hours.toFixed(1)}h
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{bill.period}</td>
                    <td>{bill.park_name} {bill.building} {bill.room}</td>
                    <td>
                      <span
                        class="status-badge"
                        style={{
                          background: statusColors[bill.status] + "20",
                          color: statusColors[bill.status],
                        }}
                      >
                        {statusLabels[bill.status]}
                      </span>
                    </td>
                    <td>{nodeLabels[bill.current_node]}</td>
                    <td style={{ fontSize: "12px" }}>{roleLabels[bill.current_responsible_role]}</td>
                    <td class="amount">¥{bill.total_amount.toFixed(2)}</td>
                    <td>
                      <span class={`tag ${bill.has_meter_reading ? "tag-success" : "tag-warning"}`}>
                        抄表{bill.has_meter_reading ? "✓" : "✗"}
                      </span>
                      <span class={`tag ${bill.has_bill_generated ? "tag-success" : "tag-warning"}`}>
                        账单{bill.has_bill_generated ? "✓" : "✗"}
                      </span>
                      <span class={`tag ${bill.has_payment_verified ? "tag-success" : "tag-warning"}`}>
                        缴费{bill.has_payment_verified ? "✓" : "✗"}
                      </span>
                    </td>
                    <td class="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        class="btn btn-sm btn-primary"
                        onClick={() => navigate(`/bills/${bill.id}`)}
                      >
                        查看
                      </button>
                      <For each={bill.allowed_actions.slice(0, 3)}>
                        {(action) => (
                          <button
                            class={`btn btn-sm ${getActionButtonClass(action)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (action === "delete") {
                                handleDelete(bill.id);
                              } else {
                                handleAction(bill.id, action);
                              }
                            }}
                          >
                            {actionLabels[action] || action}
                          </button>
                        )}
                      </For>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        )}
      </div>

      <Modal
        show={showCreateModal()}
        title="新建能耗账单"
        onClose={() => setShowCreateModal(false)}
        footer={
          <>
            <button class="btn btn-secondary" onClick={() => setShowCreateModal(false)}>取消</button>
            <button class="btn btn-primary" onClick={handleCreate}>创建</button>
          </>
        }
        width="700px"
      >
        <div class="detail-grid">
          <div class="form-group">
            <label>账期 *</label>
            <input
              type="text"
              value={formData().period}
              onInput={(e) => setFormData({ ...formData(), period: e.target.value })}
              placeholder="如: 2026-06"
            />
          </div>
          <div class="form-group">
            <label>园区名称 *</label>
            <input
              type="text"
              value={formData().park_name}
              onInput={(e) => setFormData({ ...formData(), park_name: e.target.value })}
              placeholder="如: 产业园A区"
            />
          </div>
          <div class="form-group">
            <label>楼栋</label>
            <input
              type="text"
              value={formData().building}
              onInput={(e) => setFormData({ ...formData(), building: e.target.value })}
              placeholder="如: 1号楼"
            />
          </div>
          <div class="form-group">
            <label>房间</label>
            <input
              type="text"
              value={formData().room}
              onInput={(e) => setFormData({ ...formData(), room: e.target.value })}
              placeholder="如: 101"
            />
          </div>
          <div class="form-group">
            <label>用电量 (度)</label>
            <input
              type="number"
              value={formData().electricity_usage}
              onInput={(e) => setFormData({ ...formData(), electricity_usage: e.target.value })}
              placeholder="0"
            />
          </div>
          <div class="form-group">
            <label>用水量 (吨)</label>
            <input
              type="number"
              value={formData().water_usage}
              onInput={(e) => setFormData({ ...formData(), water_usage: e.target.value })}
              placeholder="0"
            />
          </div>
          <div class="form-group">
            <label>用气量 (立方)</label>
            <input
              type="number"
              value={formData().gas_usage}
              onInput={(e) => setFormData({ ...formData(), gas_usage: e.target.value })}
              placeholder="0"
            />
          </div>
          <div class="form-group">
            <label>电费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={formData().electricity_amount}
              onInput={(e) => setFormData({ ...formData(), electricity_amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div class="form-group">
            <label>水费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={formData().water_amount}
              onInput={(e) => setFormData({ ...formData(), water_amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div class="form-group">
            <label>气费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={formData().gas_amount}
              onInput={(e) => setFormData({ ...formData(), gas_amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>
      </Modal>

      <Modal
        show={showActionModal()}
        title={selected().size > 1 ? `批量${actionLabels[actionData().action]}` : actionLabels[actionData().action]}
        onClose={() => setShowActionModal(false)}
        footer={
          <>
            <button class="btn btn-secondary" onClick={() => setShowActionModal(false)}>取消</button>
            <button class={getActionButtonClass(actionData().action)} onClick={submitAction}>
              确认{actionLabels[actionData().action]}
            </button>
          </>
        }
      >
        <div class="alert alert-info">
          即将对 {selected().size} 条账单执行「{actionLabels[actionData().action]}」操作
        </div>
        {actionData().action.includes("reject") && (
          <>
            <div class="form-group">
              <label>异常原因 *</label>
              <textarea
                rows={3}
                value={actionData().anomaly_reason}
                onInput={(e) => setActionData({ ...actionData(), anomaly_reason: e.target.value })}
                placeholder="请填写驳回/异常原因..."
              />
            </div>
          </>
        )}
        <div class="form-group">
          <label>备注</label>
          <textarea
            rows={2}
            value={actionData().remark}
            onInput={(e) => setActionData({ ...actionData(), remark: e.target.value })}
            placeholder="可选填写备注信息..."
          />
        </div>
      </Modal>
    </Layout>
  );
};

export default BillList;
