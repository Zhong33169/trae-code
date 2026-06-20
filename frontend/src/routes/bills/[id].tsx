import { createSignal, Component, onMount, For } from "solid-js";
import { useParams, useNavigate, A } from "@solidjs/router";
import { Layout } from "../../components/Layout";
import { Modal } from "../../components/Modal";
import { Alert } from "../../components/Alert";
import { api } from "../../lib/api";
import { useApp, statusLabels, statusColors, nodeLabels, roleLabels, actionLabels } from "../../lib/store";

interface OverdueInfo {
  is_overdue: boolean;
  overdue_hours: number;
  current_node: string;
  current_node_started_at: string;
  timeout_hours: number;
  responsible_role: string;
  next_responsible_role: string;
}

interface BillDetail {
  id: number;
  bill_no: string;
  period: string;
  park_name: string;
  building: string;
  room: string;
  electricity_usage: number;
  water_usage: number;
  gas_usage: number;
  electricity_amount: number;
  water_amount: number;
  gas_amount: number;
  total_amount: number;
  status: string;
  current_node: string;
  current_responsible_role: string;
  has_meter_reading: boolean;
  has_bill_generated: boolean;
  has_payment_verified: boolean;
  is_overdue: boolean;
  overdue_hours: number;
  current_node_started_at: string;
  created_by: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
  meter_readings: any[];
  payments: any[];
  operation_logs: any[];
  overdue_info: OverdueInfo;
  allowed_actions: string[];
  visible_fields: string[];
  editable_fields: string[];
}

const BillDetail: Component = () => {
  const app = useApp();
  const params = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = createSignal<BillDetail | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [alert, setAlert] = createSignal({ type: "", message: "", show: false });

  const [showActionModal, setShowActionModal] = createSignal(false);
  const [actionData, setActionData] = createSignal({ action: "", anomaly_reason: "", remark: "" });

  const [showEditModal, setShowEditModal] = createSignal(false);
  const [editData, setEditData] = createSignal({
    period: "",
    park_name: "",
    building: "",
    room: "",
    electricity_usage: "",
    water_usage: "",
    gas_usage: "",
    electricity_amount: "",
    water_amount: "",
    gas_amount: "",
    remark: "",
  });

  const [showMeterModal, setShowMeterModal] = createSignal(false);
  const [meterData, setMeterData] = createSignal({
    reading_type: "electricity",
    previous_reading: "",
    current_reading: "",
    usage: "",
    remark: "",
  });

  const [showPaymentModal, setShowPaymentModal] = createSignal(false);
  const [paymentData, setPaymentData] = createSignal({
    amount: "",
    payment_method: "",
    transaction_no: "",
    paid_by: "",
    paid_at: "",
    remark: "",
  });

  const loadBill = async () => {
    setLoading(true);
    try {
      const data = await api.getBill(parseInt(params.id));
      setBill(data);
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
    loadBill();
    const interval = setInterval(loadBill, 15000);
    return () => clearInterval(interval);
  });

  const handleAction = (action: string) => {
    setActionData({ action, anomaly_reason: "", remark: "" });
    setShowActionModal(true);
  };

  const submitAction = async () => {
    if (actionData().action.includes("reject") && !actionData().anomaly_reason.trim()) {
      showAlert("error", "驳回操作必须填写异常原因");
      return;
    }
    try {
      const result = await api.performAction(
        bill()!.id,
        actionData().action,
        actionData().anomaly_reason,
        actionData().remark
      );
      setShowActionModal(false);
      showAlert("success", result.message || "操作成功");
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "操作失败");
    }
  };

  const submitMeterReading = async () => {
    try {
      const data = {
        bill_id: bill()!.id,
        reading_type: meterData().reading_type,
        previous_reading: parseFloat(meterData().previous_reading),
        current_reading: parseFloat(meterData().current_reading),
        usage: parseFloat(meterData().usage),
        remark: meterData().remark,
      };
      await api.addMeterReading(data);
      setShowMeterModal(false);
      showAlert("success", "抄表数据录入成功");
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "录入失败");
    }
  };

  const handleGenerateBill = async () => {
    try {
      const result = await api.generateBill(bill()!.id);
      showAlert("success", result.message);
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "生成失败");
    }
  };

  const submitPayment = async () => {
    try {
      const data = {
        bill_id: bill()!.id,
        amount: parseFloat(paymentData().amount),
        payment_method: paymentData().payment_method,
        transaction_no: paymentData().transaction_no,
        paid_by: paymentData().paid_by,
        paid_at: paymentData().paid_at || null,
        remark: paymentData().remark,
      };
      await api.addPayment(data);
      setShowPaymentModal(false);
      showAlert("success", "缴费记录登记成功");
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "登记失败");
    }
  };

  const handleVerifyPayment = async (paymentId: number, isVerified: boolean) => {
    try {
      const result = await api.verifyPayment(paymentId, isVerified);
      showAlert("success", result.message);
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "核销失败");
    }
  };

  const getStepClass = (node: string, index: number) => {
    const nodes = ["registration", "audit", "review", "completed"];
    const currentIndex = nodes.indexOf(bill()?.current_node || "registration");
    const thisIndex = nodes.indexOf(node);

    if (node === bill()?.current_node && bill()?.is_overdue) return "overdue";
    if (thisIndex < currentIndex || node === "completed" && bill()?.current_node === "completed") return "completed";
    if (thisIndex === currentIndex) return "active";
    return "";
  };

  const getActionButtonClass = (action: string) => {
    if (action.includes("approve")) return "btn-success";
    if (action.includes("reject")) return "btn-danger";
    if (action.includes("submit")) return "btn-primary";
    if (action.includes("generate")) return "btn-warning";
    if (action.includes("meter")) return "btn-warning";
    if (action.includes("payment")) return "btn-warning";
    return "btn-secondary";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

  const canSee = (field: string) => bill()?.visible_fields?.includes(field) ?? false;
  const canEdit = (field: string) => bill()?.editable_fields?.includes(field) ?? false;

  const openEditModal = () => {
    const b = bill();
    if (!b) return;
    setEditData({
      period: b.period || "",
      park_name: b.park_name || "",
      building: b.building || "",
      room: b.room || "",
      electricity_usage: b.electricity_usage?.toString() || "",
      water_usage: b.water_usage?.toString() || "",
      gas_usage: b.gas_usage?.toString() || "",
      electricity_amount: b.electricity_amount?.toString() || "",
      water_amount: b.water_amount?.toString() || "",
      gas_amount: b.gas_amount?.toString() || "",
      remark: "",
    });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    try {
      const data: Record<string, any> = {};
      const fields: Record<string, string> = {
        period: editData().period,
        park_name: editData().park_name,
        building: editData().building,
        room: editData().room,
        electricity_usage: editData().electricity_usage,
        water_usage: editData().water_usage,
        gas_usage: editData().gas_usage,
        electricity_amount: editData().electricity_amount,
        water_amount: editData().water_amount,
        gas_amount: editData().gas_amount,
      };
      for (const [key, val] of Object.entries(fields)) {
        if (canEdit(key) && val !== "") {
          data[key] = parseFloat(val) || val;
        }
      }
      await api.updateBill(bill()!.id, data);
      setShowEditModal(false);
      showAlert("success", "保存成功");
      loadBill();
    } catch (err: any) {
      showAlert("error", err.message || "保存失败");
    }
  };

  if (loading()) {
    return (
      <Layout>
        <div class="loading"><div class="spinner"></div><p>加载中...</p></div>
      </Layout>
    );
  }

  if (!bill()) {
    return (
      <Layout>
        <div class="empty">
          <div class="icon">❌</div>
          <p>账单不存在</p>
          <A href="/bills" class="btn btn-primary">返回列表</A>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div class="page-header">
        <div>
          <h1>📋 账单详情 - {bill()!.bill_no}</h1>
          <p style={{ color: "#6b7280", marginTop: "4px" }}>
            创建人: {bill()!.creator_name} | 创建时间: {formatDate(bill()!.created_at)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <A href="/bills" class="btn btn-secondary">← 返回列表</A>
          <button class="btn btn-secondary" onClick={loadBill}>🔄 刷新</button>
        </div>
      </div>

      <Alert type={alert().type as any} message={alert().message} show={alert().show} />

      {bill()!.overdue_info?.is_overdue && (
        <div class="overdue-panel">
          <h4>⚠️ 该账单已超时</h4>
          <div class="overdue-row">
            <span class="label">当前节点</span>
            <span class="value">{nodeLabels[bill()!.overdue_info.current_node]}</span>
          </div>
          <div class="overdue-row">
            <span class="label">节点责任人</span>
            <span class="value">{roleLabels[bill()!.overdue_info.responsible_role]}</span>
          </div>
          <div class="overdue-row">
            <span class="label">节点开始时间</span>
            <span class="value">{formatDate(bill()!.overdue_info.current_node_started_at)}</span>
          </div>
          <div class="overdue-row">
            <span class="label">超时时长</span>
            <span class="value">{bill()!.overdue_info.overdue_hours.toFixed(1)} 小时</span>
          </div>
          <div class="overdue-row">
            <span class="label">节点时限</span>
            <span class="value">{bill()!.overdue_info.timeout_hours} 小时</span>
          </div>
          {bill()!.overdue_info.next_responsible_role && (
            <div class="overdue-row">
              <span class="label">下一步接收方</span>
              <span class="value">{roleLabels[bill()!.overdue_info.next_responsible_role]}</span>
            </div>
          )}
        </div>
      )}

      <div class="flow-steps">
        {[
          { node: "registration", title: "登记", role: "registrar", num: 1 },
          { node: "audit", title: "审核", role: "auditor", num: 2 },
          { node: "review", title: "复核", role: "property", num: 3 },
          { node: "completed", title: "归档", role: "property", num: 4 },
        ].map((step, i) => (
          <div class={`flow-step ${getStepClass(step.node, i)}`} key={step.node}>
            <div class="step-number">{step.num}</div>
            <div class="step-title">{step.title}</div>
            <div class="step-role">{roleLabels[step.role].replace("能耗账", "").replace("产业园", "").slice(0, 6)}</div>
          </div>
        ))}
      </div>

      <div class="detail-container">
        <div>
          <div class="detail-card">
            <h3>📝 基本信息</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">账单编号</span>
                <span class="value bill-no">{bill()!.bill_no}</span>
              </div>
              <div class="detail-item">
                <span class="label">账期</span>
                <span class="value">{bill()!.period}</span>
              </div>
              <div class="detail-item">
                <span class="label">园区</span>
                <span class="value">{bill()!.park_name}</span>
              </div>
              <div class="detail-item">
                <span class="label">楼栋/房间</span>
                <span class="value">{bill()!.building} {bill()!.room}</span>
              </div>
              <div class="detail-item">
                <span class="label">当前状态</span>
                <span class="value">
                  <span
                    class="status-badge"
                    style={{
                      background: statusColors[bill()!.status] + "20",
                      color: statusColors[bill()!.status],
                    }}
                  >
                    {statusLabels[bill()!.status]}
                  </span>
                </span>
              </div>
              <div class="detail-item">
                <span class="label">当前责任人</span>
                <span class="value">{roleLabels[bill()!.current_responsible_role]}</span>
              </div>
            </div>
          </div>

          {canSee("electricity_usage") && (
            <div class="detail-card">
              <h3>⚡ 能耗用量与费用</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">用电量</span>
                  <span class="value">{bill()!.electricity_usage?.toFixed(2) || 0} 度</span>
                </div>
                <div class="detail-item">
                  <span class="label">电费</span>
                  <span class="value amount">¥{bill()!.electricity_amount?.toFixed(2) || 0}</span>
                </div>
                <div class="detail-item">
                  <span class="label">用水量</span>
                  <span class="value">{bill()!.water_usage?.toFixed(2) || 0} 吨</span>
                </div>
                <div class="detail-item">
                  <span class="label">水费</span>
                  <span class="value amount">¥{bill()!.water_amount?.toFixed(2) || 0}</span>
                </div>
                <div class="detail-item">
                  <span class="label">用气量</span>
                  <span class="value">{bill()!.gas_usage?.toFixed(2) || 0} m³</span>
                </div>
                <div class="detail-item">
                  <span class="label">气费</span>
                  <span class="value amount">¥{bill()!.gas_amount?.toFixed(2) || 0}</span>
                </div>
                <div class="detail-item" style={{ "grid-column": "span 2" }}>
                  <span class="label">合计金额</span>
                  <span class="value" style={{ "font-size": "24px", color: "#dc2626" }}>
                    ¥{bill()!.total_amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {canSee("has_meter_reading") && (
            <div class="detail-card">
              <h3>🔗 三单关联状态</h3>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">能耗抄表</span>
                  <span class="value">
                    <span class={`tag ${bill()!.has_meter_reading ? "tag-success" : "tag-warning"}`}>
                      {bill()!.has_meter_reading ? "✓ 已录入" : "✗ 待录入"}
                    </span>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="label">账单生成</span>
                  <span class="value">
                    <span class={`tag ${bill()!.has_bill_generated ? "tag-success" : "tag-warning"}`}>
                      {bill()!.has_bill_generated ? "✓ 已生成" : "✗ 待生成"}
                    </span>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="label">缴费核销</span>
                  <span class="value">
                    <span class={`tag ${bill()!.has_payment_verified ? "tag-success" : "tag-warning"}`}>
                      {bill()!.has_payment_verified ? "✓ 已核销" : "✗ 待核销"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {canSee("meter_readings") && bill()!.meter_readings.length > 0 && (
            <div class="detail-card">
              <h3>📊 抄表记录</h3>
              <table>
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>上次读数</th>
                    <th>本次读数</th>
                    <th>用量</th>
                    <th>录入人</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={bill()!.meter_readings}>
                    {(mr) => (
                      <tr>
                        <td>{mr.reading_type === "electricity" ? "电" : mr.reading_type === "water" ? "水" : "气"}</td>
                        <td>{mr.previous_reading}</td>
                        <td>{mr.current_reading}</td>
                        <td>{mr.usage}</td>
                        <td>{mr.reader_name || "-"}</td>
                        <td>{formatDate(mr.read_at)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}

          {canSee("payments") && bill()!.payments.length > 0 && (
            <div class="detail-card">
              <h3>💳 缴费记录</h3>
              <table>
                <thead>
                  <tr>
                    <th>金额</th>
                    <th>支付方式</th>
                    <th>交易号</th>
                    <th>支付人</th>
                    <th>状态</th>
                    <th>核销人</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={bill()!.payments}>
                    {(p) => (
                      <tr>
                        <td class="amount">¥{p.amount.toFixed(2)}</td>
                        <td>{p.payment_method || "-"}</td>
                        <td style={{ "font-family": "monospace", "font-size": "12px" }}>{p.transaction_no || "-"}</td>
                        <td>{p.paid_by || "-"}</td>
                        <td>
                          <span class={`tag ${p.is_verified ? "tag-success" : "tag-warning"}`}>
                            {p.is_verified ? "✓ 已核销" : "待核销"}
                          </span>
                        </td>
                        <td>{p.verifier_name || "-"}</td>
                        <td>
                          {app.hasRole("property") && !p.is_verified && (
                            <>
                              <button class="btn btn-sm btn-success" onClick={() => handleVerifyPayment(p.id, true)}>
                                通过
                              </button>
                              <button class="btn btn-sm btn-danger" style={{ "margin-left": "4px" }} onClick={() => handleVerifyPayment(p.id, false)}>
                                驳回
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}

          {canSee("operation_logs") && (
            <div class="detail-card">
              <h3>📜 操作记录</h3>
              <div class="timeline">
                <For each={[...bill()!.operation_logs].reverse()}>
                  {(log) => (
                    <div class="timeline-item">
                      <div class="time">{formatDate(log.created_at)}</div>
                      <div class="operation">{log.operation}</div>
                      <div class="operator">操作人: {log.operator_name || "系统"}</div>
                      {log.from_status && (
                        <div class="operator">
                          状态: {statusLabels[log.from_status]} → {statusLabels[log.to_status!]}
                        </div>
                      )}
                      {log.anomaly_reason && (
                        <div class="remark anomaly">
                          <strong>异常原因:</strong> {log.anomaly_reason}
                        </div>
                      )}
                      {log.field_changes && (
                        <div class="remark" style={{ "border-left": "3px solid #3b82f6" }}>
                          <strong>字段变更:</strong>
                          <For each={Object.entries(JSON.parse(log.field_changes))}>
                            {([field, change]: [string, any]) => (
                              <div style={{ "margin-left": "8px", "font-size": "12px" }}>
                                <span style={{ color: "#6b7280" }}>{field}:</span>{" "}
                                <span style={{ "text-decoration": "line-through", color: "#ef4444" }}>
                                  {change.old ?? "-"}
                                </span>{" "}
                                →{" "}
                                <span style={{ color: "#10b981" }}>
                                  {change.new ?? "-"}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                      )}
                      {log.remark && (
                        <div class="remark">
                          <strong>备注:</strong> {log.remark}
                        </div>
                      )}
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </div>

        <div>
          <div class="detail-card sidebar-panel">
            <h3>⚡ 可用操作</h3>
            <div class="action-buttons">
              {bill()!.allowed_actions.length === 0 ? (
                <p style={{ color: "#6b7280", "text-align": "center", padding: "20px 0" }}>
                  当前状态下无可用操作
                </p>
              ) : (
                <For each={bill()!.allowed_actions}>
                  {(action) => (
                    <button
                      class={getActionButtonClass(action)}
                      onClick={() => {
                        if (action === "edit") {
                          openEditModal();
                        } else if (action === "add_meter_reading") {
                          setShowMeterModal(true);
                        } else if (action === "generate_bill") {
                          handleGenerateBill();
                        } else if (action === "add_payment") {
                          setShowPaymentModal(true);
                        } else {
                          handleAction(action);
                        }
                      }}
                    >
                      {actionLabels[action] || action}
                    </button>
                  )}
                </For>
              )}
            </div>
          </div>

          <div class="detail-card">
            <h3>👁️ 可见字段说明</h3>
            <p style={{ "font-size": "13px", color: "#6b7280", "margin-bottom": "12px" }}>
              基于您的角色 <strong>{roleLabels[app.user()?.role || ""]}</strong>，当前可见 {bill()!.visible_fields.length} 个字段
            </p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "4px" }}>
              <For each={bill()!.visible_fields.slice(0, 20)}>
                {(field) => (
                  <span class="tag tag-info">{field}</span>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>

      <Modal
        show={showActionModal()}
        title={actionLabels[actionData().action]}
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
          账单 <strong>{bill()!.bill_no}</strong> 将执行「{actionLabels[actionData().action]}」操作
        </div>
        {actionData().action.includes("reject") && (
          <div class="form-group">
            <label>异常原因 *</label>
            <textarea
              rows={3}
              value={actionData().anomaly_reason}
              onInput={(e) => setActionData({ ...actionData(), anomaly_reason: e.target.value })}
              placeholder="请填写驳回/异常原因..."
            />
          </div>
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

      <Modal
        show={showMeterModal()}
        title="录入抄表数据"
        onClose={() => setShowMeterModal(false)}
        footer={
          <>
            <button class="btn btn-secondary" onClick={() => setShowMeterModal(false)}>取消</button>
            <button class="btn btn-primary" onClick={submitMeterReading}>确认录入</button>
          </>
        }
      >
        <div class="form-group">
          <label>抄表类型 *</label>
          <select
            value={meterData().reading_type}
            onChange={(e) => setMeterData({ ...meterData(), reading_type: e.target.value })}
          >
            <option value="electricity">电表</option>
            <option value="water">水表</option>
            <option value="gas">气表</option>
          </select>
        </div>
        <div class="form-group">
          <label>上次读数 *</label>
          <input
            type="number"
            step="0.01"
            value={meterData().previous_reading}
            onInput={(e) => setMeterData({ ...meterData(), previous_reading: e.target.value })}
            placeholder="0"
          />
        </div>
        <div class="form-group">
          <label>本次读数 *</label>
          <input
            type="number"
            step="0.01"
            value={meterData().current_reading}
            onInput={(e) => {
              setMeterData({ ...meterData(), current_reading: e.target.value });
              const curr = parseFloat(e.target.value) || 0;
              const prev = parseFloat(meterData().previous_reading) || 0;
              setMeterData({ ...meterData(), usage: String(Math.max(0, curr - prev)) });
            }}
            placeholder="0"
          />
        </div>
        <div class="form-group">
          <label>用量 *</label>
          <input
            type="number"
            step="0.01"
            value={meterData().usage}
            onInput={(e) => setMeterData({ ...meterData(), usage: e.target.value })}
            placeholder="自动计算，可手动调整"
          />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea
            rows={2}
            value={meterData().remark}
            onInput={(e) => setMeterData({ ...meterData(), remark: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        show={showPaymentModal()}
        title="登记缴费记录"
        onClose={() => setShowPaymentModal(false)}
        footer={
          <>
            <button class="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>取消</button>
            <button class="btn btn-primary" onClick={submitPayment}>确认登记</button>
          </>
        }
      >
        <div class="form-group">
          <label>缴费金额 *</label>
          <input
            type="number"
            step="0.01"
            value={paymentData().amount}
            onInput={(e) => setPaymentData({ ...paymentData(), amount: e.target.value })}
            placeholder={bill()!.total_amount.toFixed(2)}
          />
        </div>
        <div class="form-group">
          <label>支付方式</label>
          <select
            value={paymentData().payment_method}
            onChange={(e) => setPaymentData({ ...paymentData(), payment_method: e.target.value })}
          >
            <option value="">请选择</option>
            <option value="bank_transfer">银行转账</option>
            <option value="alipay">支付宝</option>
            <option value="wechat">微信</option>
            <option value="cash">现金</option>
          </select>
        </div>
        <div class="form-group">
          <label>交易单号</label>
          <input
            type="text"
            value={paymentData().transaction_no}
            onInput={(e) => setPaymentData({ ...paymentData(), transaction_no: e.target.value })}
            placeholder="银行流水号/交易单号"
          />
        </div>
        <div class="form-group">
          <label>支付人</label>
          <input
            type="text"
            value={paymentData().paid_by}
            onInput={(e) => setPaymentData({ ...paymentData(), paid_by: e.target.value })}
            placeholder="企业名称/个人姓名"
          />
        </div>
        <div class="form-group">
          <label>支付时间</label>
          <input
            type="datetime-local"
            value={paymentData().paid_at}
            onInput={(e) => setPaymentData({ ...paymentData(), paid_at: e.target.value })}
          />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea
            rows={2}
            value={paymentData().remark}
            onInput={(e) => setPaymentData({ ...paymentData(), remark: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        show={showEditModal()}
        title={bill()?.status === "rejected" || bill()?.status === "review_rejected" ? "补正账单" : "编辑账单"}
        onClose={() => setShowEditModal(false)}
        footer={
          <>
            <button class="btn btn-secondary" onClick={() => setShowEditModal(false)}>取消</button>
            <button class="btn btn-primary" onClick={submitEdit}>保存</button>
          </>
        }
        width="700px"
      >
        <div class="alert alert-info">
          可编辑字段由当前角色和账单状态决定。灰显字段为只读。
        </div>
        <div class="detail-grid">
          <div class="form-group">
            <label>账期 {canEdit("period") && "*"}</label>
            <input
              type="text"
              value={editData().period}
              onInput={(e) => setEditData({ ...editData(), period: e.target.value })}
              disabled={!canEdit("period")}
              placeholder="如: 2026-06"
              style={!canEdit("period") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>园区名称 {canEdit("park_name") && "*"}</label>
            <input
              type="text"
              value={editData().park_name}
              onInput={(e) => setEditData({ ...editData(), park_name: e.target.value })}
              disabled={!canEdit("park_name")}
              placeholder="如: 产业园A区"
              style={!canEdit("park_name") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>楼栋</label>
            <input
              type="text"
              value={editData().building}
              onInput={(e) => setEditData({ ...editData(), building: e.target.value })}
              disabled={!canEdit("building")}
              placeholder="如: 1号楼"
              style={!canEdit("building") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>房间</label>
            <input
              type="text"
              value={editData().room}
              onInput={(e) => setEditData({ ...editData(), room: e.target.value })}
              disabled={!canEdit("room")}
              placeholder="如: 101"
              style={!canEdit("room") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>用电量 (度)</label>
            <input
              type="number"
              value={editData().electricity_usage}
              onInput={(e) => setEditData({ ...editData(), electricity_usage: e.target.value })}
              disabled={!canEdit("electricity_usage")}
              style={!canEdit("electricity_usage") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>用水量 (吨)</label>
            <input
              type="number"
              value={editData().water_usage}
              onInput={(e) => setEditData({ ...editData(), water_usage: e.target.value })}
              disabled={!canEdit("water_usage")}
              style={!canEdit("water_usage") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>用气量 (立方)</label>
            <input
              type="number"
              value={editData().gas_usage}
              onInput={(e) => setEditData({ ...editData(), gas_usage: e.target.value })}
              disabled={!canEdit("gas_usage")}
              style={!canEdit("gas_usage") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>电费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={editData().electricity_amount}
              onInput={(e) => setEditData({ ...editData(), electricity_amount: e.target.value })}
              disabled={!canEdit("electricity_amount")}
              style={!canEdit("electricity_amount") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>水费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={editData().water_amount}
              onInput={(e) => setEditData({ ...editData(), water_amount: e.target.value })}
              disabled={!canEdit("water_amount")}
              style={!canEdit("water_amount") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
          <div class="form-group">
            <label>气费 (元)</label>
            <input
              type="number"
              step="0.01"
              value={editData().gas_amount}
              onInput={(e) => setEditData({ ...editData(), gas_amount: e.target.value })}
              disabled={!canEdit("gas_amount")}
              style={!canEdit("gas_amount") ? { background: "#f3f4f6", color: "#9ca3af" } : {}}
            />
          </div>
        </div>
        <div class="form-group" style={{ "margin-top": "12px" }}>
          <label>补正备注</label>
          <textarea
            rows={2}
            value={editData().remark}
            onInput={(e) => setEditData({ ...editData(), remark: e.target.value })}
            placeholder="填写补正原因或备注..."
          />
        </div>
      </Modal>
    </Layout>
  );
};

export default BillDetail;
