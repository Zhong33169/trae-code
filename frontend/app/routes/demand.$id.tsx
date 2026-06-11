import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@remix-run/react";
import {
  apiFetch,
  CreativeDemand,
  AuditLog,
  ScanRecord,
  ApiError,
  statusLabels,
  statusColors,
  roleLabels,
  scanResultLabels,
  scanResultColors,
  scanErrorCodeLabels,
  getAvailableActions,
  getScanRecords,
  updateCreativeDemand,
  transitionCreativeDemand,
  DemandStatus,
} from "~/api/client";

function parseJsonArray(str: string | null): string[] {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

export default function DemandDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [demand, setDemand] = useState<CreativeDemand | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [transitionComments, setTransitionComments] = useState("");
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"main" | "brief" | "schedule" | "confirmation" | "audit" | "scan">("main");

  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [demandRes, logsRes, scanRes] = await Promise.all([
        apiFetch<CreativeDemand>(`/api/creative-demands/${id}`),
        apiFetch<{ items: AuditLog[] }>(
          `/api/audit-logs?creative_demand_id=${id}`
        ),
        getScanRecords(id, 1, 50),
      ]);
      setDemand(demandRes);
      setAuditLogs(logsRes.items);
      setScanRecords(scanRes.items);
      initFormData(demandRes);
    } catch (err: any) {
      if (err instanceof ApiError && err.isMigrationError()) {
        setError(err.getMigrationErrorMessage());
      } else {
        setError(err.message || "加载数据失败");
      }
    } finally {
      setLoading(false);
    }
  };

  const initFormData = (d: CreativeDemand) => {
    setFormData({
      title: d.title,
      client_name: d.client_name,
      brief_materials: parseJsonArray(d.brief_materials),
      brief_opinion: d.brief_opinion || "",
      schedule_materials: parseJsonArray(d.schedule_materials),
      schedule_opinion: d.schedule_opinion || "",
      confirmation_materials: parseJsonArray(d.confirmation_materials),
      confirmation_opinion: d.confirmation_opinion || "",
      remarks: d.remarks || "",
      attachments: parseJsonArray(d.attachments),
      processing_result: d.processing_result || "",
      return_reason: d.return_reason || "",
    });
  };

  const handleSave = async () => {
    if (!demand) return;
    setSaving(true);
    try {
      const updateData = {
        ...formData,
        brief_materials: formData.brief_materials?.length > 0 ? formData.brief_materials : undefined,
        schedule_materials: formData.schedule_materials?.length > 0 ? formData.schedule_materials : undefined,
        confirmation_materials: formData.confirmation_materials?.length > 0 ? formData.confirmation_materials : undefined,
        attachments: formData.attachments?.length > 0 ? formData.attachments : undefined,
        version: demand.version,
      };

      const updated = await updateCreativeDemand(demand.id, updateData);
      setDemand(updated);
      initFormData(updated);
      setEditMode(false);
      alert("保存成功");
      loadData();
    } catch (err: any) {
      if (err instanceof ApiError && err.isVersionConflict()) {
        const conflictMsg = err.details?.error || err.message;
        alert(`版本冲突：${conflictMsg}\n\n页面将自动刷新以获取最新数据。`);
        setEditMode(false);
        loadData();
      } else if (err instanceof ApiError && err.isMigrationError()) {
        alert(`数据迁移异常：\n${err.getMigrationErrorMessage()}`);
      } else {
        alert(`保存失败：${err.message}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async () => {
    if (!demand || !selectedAction) return;

    try {
      const result = await transitionCreativeDemand(demand.id, {
        target_status: selectedAction.target,
        comments: transitionComments || undefined,
        version: demand.version,
      });

      if (result.success) {
        alert("操作成功");
        setShowTransitionModal(false);
        setTransitionComments("");
        setSelectedAction(null);
        loadData();
      } else {
        alert(`操作失败：${result.message}`);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.isVersionConflict()) {
        const conflictMsg = err.details?.error || err.message;
        alert(`版本冲突：${conflictMsg}\n\n页面将自动刷新以获取最新数据。`);
        setShowTransitionModal(false);
        setTransitionComments("");
        setSelectedAction(null);
        loadData();
      } else if (err instanceof ApiError && err.isMigrationError()) {
        alert(`数据迁移异常：\n${err.getMigrationErrorMessage()}`);
      } else {
        alert(`操作失败：${err.message}`);
      }
    }
  };

  const canEdit = demand && user && demand.current_handler_role === user.role && 
    demand.status !== "completed" && demand.status !== "rejected";

  const availableActions = demand
    ? getAvailableActions(demand.status, user?.role || "")
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!demand) {
    return (
      <div className="text-center py-12 text-gray-500">
        创意需求单不存在
      </div>
    );
  }

  const renderMaterialList = (materials: string[], label: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {editMode && (
          <button
            className="text-sm text-primary-600 hover:text-primary-800"
            onClick={() => {
              const key = label.includes("brief") ? "brief_materials" : 
                         label.includes("排期") ? "schedule_materials" : "confirmation_materials";
              setFormData({
                ...formData,
                [key]: [...formData[key], ""],
              });
            }}
          >
            + 添加
          </button>
        )}
      </div>
      <div className="space-y-2">
        {materials.length === 0 ? (
          <div className="text-sm text-gray-400 italic">暂无材料</div>
        ) : (
          materials.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {editMode ? (
                <>
                  <input
                    type="text"
                    className="input flex-1"
                    value={m}
                    onChange={(e) => {
                      const key = label.includes("brief") ? "brief_materials" : 
                                 label.includes("排期") ? "schedule_materials" : "confirmation_materials";
                      const newMaterials = [...formData[key]];
                      newMaterials[idx] = e.target.value;
                      setFormData({ ...formData, [key]: newMaterials });
                    }}
                  />
                  <button
                    className="text-red-500 hover:text-red-700 px-2"
                    onClick={() => {
                      const key = label.includes("brief") ? "brief_materials" : 
                                 label.includes("排期") ? "schedule_materials" : "confirmation_materials";
                      const newMaterials = formData[key].filter((_: any, i: number) => i !== idx);
                      setFormData({ ...formData, [key]: newMaterials });
                    }}
                  >
                    删除
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded">
                  <span>📄</span>
                  <span>{m}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className="btn btn-secondary text-sm"
            onClick={() => navigate("/")}
          >
            ← 返回列表
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            创意需求单详情
          </h1>
        </div>
        <div className="flex gap-2">
          {canEdit && !editMode && (
            <button
              className="btn btn-secondary"
              onClick={() => setEditMode(true)}
            >
              ✏️ 编辑
            </button>
          )}
          {editMode && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  initFormData(demand);
                  setEditMode(false);
                }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "保存中..." : "💾 保存"}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={loadData}>
            🔄 刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <div className="flex flex-wrap gap-2 border-b pb-4 mb-4">
              {(["main", "brief", "schedule", "confirmation", "scan", "audit"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-primary-100 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "main" && "基本信息"}
                  {tab === "brief" && "brief接收"}
                  {tab === "schedule" && "创意排期"}
                  {tab === "confirmation" && "客户确认"}
                  {tab === "scan" && "扫码记录"}
                  {tab === "audit" && "审计记录"}
                </button>
              ))}
            </div>

            {activeTab === "main" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">需求单编号</label>
                    <div className="font-mono text-gray-900">{demand.code}</div>
                  </div>
                  <div>
                    <label className="label">状态</label>
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${
                        statusColors[demand.status]
                      }`}
                    >
                      {statusLabels[demand.status]}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="label">标题</label>
                  {editMode ? (
                    <input
                      type="text"
                      className="input"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  ) : (
                    <div className="text-gray-900">{demand.title}</div>
                  )}
                </div>
                <div>
                  <label className="label">客户名称</label>
                  {editMode ? (
                    <input
                      type="text"
                      className="input"
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                    />
                  ) : (
                    <div className="text-gray-900">{demand.client_name}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">当前处理人</label>
                    <div className="text-gray-900">
                      {roleLabels[demand.current_handler_role]}
                    </div>
                  </div>
                  <div>
                    <label className="label">版本号</label>
                    <div className="text-gray-900">v{demand.version}</div>
                  </div>
                </div>
                <div>
                  <label className="label">备注</label>
                  {editMode ? (
                    <textarea
                      className="input"
                      rows={3}
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  ) : (
                    <div className="text-gray-900 whitespace-pre-wrap">
                      {demand.remarks || "无"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">附件</label>
                  {editMode ? (
                    <div className="space-y-2">
                      {formData.attachments.map((a: string, idx: number) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="text"
                            className="input flex-1"
                            value={a}
                            onChange={(e) => {
                              const newAttachments = [...formData.attachments];
                              newAttachments[idx] = e.target.value;
                              setFormData({
                                ...formData,
                                attachments: newAttachments,
                              });
                            }}
                          />
                          <button
                            className="text-red-500 hover:text-red-700 px-2"
                            onClick={() => {
                              const newAttachments = formData.attachments.filter(
                                (_: any, i: number) => i !== idx
                              );
                              setFormData({
                                ...formData,
                                attachments: newAttachments,
                              });
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <button
                        className="text-sm text-primary-600 hover:text-primary-800"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            attachments: [...formData.attachments, ""],
                          })
                        }
                      >
                        + 添加附件
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {parseJsonArray(demand.attachments).length === 0 ? (
                        <span className="text-gray-400 italic">无附件</span>
                      ) : (
                        parseJsonArray(demand.attachments).map((a, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            📎 {a}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {demand.processing_result && (
                  <div>
                    <label className="label">处理结果</label>
                    <div className="bg-green-50 border border-green-200 p-3 rounded text-green-800">
                      {demand.processing_result}
                    </div>
                  </div>
                )}
                {demand.return_reason && (
                  <div>
                    <label className="label">退回说明</label>
                    <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800">
                      {demand.return_reason}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "brief" && (
              <div className="space-y-6">
                {renderMaterialList(parseJsonArray(editMode ? formData.brief_materials : demand.brief_materials), "brief接收材料")}
                <div>
                  <label className="label">brief接收时限</label>
                  <div className="text-gray-900">
                    {demand.brief_deadline
                      ? new Date(demand.brief_deadline).toLocaleString()
                      : "未设置"}
                  </div>
                </div>
                <div>
                  <label className="label">brief处理意见</label>
                  {editMode ? (
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="请填写brief接收的处理意见..."
                      value={formData.brief_opinion}
                      onChange={(e) =>
                        setFormData({ ...formData, brief_opinion: e.target.value })
                      }
                    />
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800">
                      {demand.brief_opinion || "暂无意见"}
                    </div>
                  )}
                </div>
                {demand.brief_materials && demand.brief_opinion && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <div className="text-green-700 font-medium">
                      ✓ brief接收材料和处理意见已完整，可提交审核
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="space-y-6">
                {renderMaterialList(parseJsonArray(editMode ? formData.schedule_materials : demand.schedule_materials), "创意排期材料")}
                <div>
                  <label className="label">创意排期时限</label>
                  <div className="text-gray-900">
                    {demand.schedule_deadline
                      ? new Date(demand.schedule_deadline).toLocaleString()
                      : "未设置"}
                  </div>
                </div>
                <div>
                  <label className="label">创意排期处理意见</label>
                  {editMode ? (
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="请填写创意排期的处理意见..."
                      value={formData.schedule_opinion}
                      onChange={(e) =>
                        setFormData({ ...formData, schedule_opinion: e.target.value })
                      }
                    />
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800">
                      {demand.schedule_opinion || "暂无意见"}
                    </div>
                  )}
                </div>
                {demand.schedule_materials && demand.schedule_opinion && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <div className="text-green-700 font-medium">
                      ✓ 创意排期材料和处理意见已完整，可提交复核
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "confirmation" && (
              <div className="space-y-6">
                {renderMaterialList(parseJsonArray(editMode ? formData.confirmation_materials : demand.confirmation_materials), "客户确认材料")}
                <div>
                  <label className="label">客户确认时限</label>
                  <div className="text-gray-900">
                    {demand.confirmation_deadline
                      ? new Date(demand.confirmation_deadline).toLocaleString()
                      : "未设置"}
                  </div>
                </div>
                <div>
                  <label className="label">客户确认处理意见</label>
                  {editMode ? (
                    <textarea
                      className="input"
                      rows={4}
                      placeholder="请填写客户确认的处理意见..."
                      value={formData.confirmation_opinion}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmation_opinion: e.target.value })
                      }
                    />
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800">
                      {demand.confirmation_opinion || "暂无意见"}
                    </div>
                  )}
                </div>
                {demand.confirmation_materials && demand.confirmation_opinion && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <div className="text-green-700 font-medium">
                      ✓ 客户确认材料和处理意见已完整，可完成归档
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "scan" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">扫码核验记录</h3>
                  <span className="text-sm text-gray-500">
                    共 {scanRecords.length} 条记录
                  </span>
                </div>
                {scanRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">📱</div>
                    <div>暂无扫码核验记录</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scanRecords.map((record) => (
                      <div
                        key={record.id}
                        className={`border rounded-lg p-4 ${
                          record.scan_result === "success"
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">
                              {record.scan_result === "success" ? "✅" : "❌"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {record.user_name}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  {roleLabels[record.user_role] || record.user_role}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    scanResultColors[record.scan_result]
                                  }`}
                                >
                                  {scanResultLabels[record.scan_result]}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(record.scanned_at).toLocaleString()}
                              </div>
                              {record.error_code && (
                                <div className="mt-2">
                                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                                    {scanErrorCodeLabels[record.error_code] || record.error_code}
                                  </span>
                                </div>
                              )}
                              {record.error_message && (
                                <div className="mt-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">
                                  {record.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-4">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无审计记录</div>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-l-4 border-primary-400 pl-4 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {log.user_name}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {roleLabels[log.user_role] || log.user_role}
                            </span>
                            <span className="text-sm text-gray-600">
                              {log.action === "create" && "创建"}
                              {log.action === "update" && "更新"}
                              {log.action === "status_transition" && "状态流转"}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        {log.old_status && log.new_status && (
                          <div className="mt-1 text-sm">
                            <span className="text-gray-500">状态：</span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${
                                statusColors[log.old_status as DemandStatus]
                              }`}
                            >
                              {statusLabels[log.old_status as DemandStatus]}
                            </span>
                            <span className="mx-2">→</span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded ${
                                statusColors[log.new_status as DemandStatus]
                              }`}
                            >
                              {statusLabels[log.new_status as DemandStatus]}
                            </span>
                          </div>
                        )}
                        {log.details && (
                          <div className="mt-1 text-sm text-gray-600">
                            {log.details}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {canEdit && availableActions.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">操作</h3>
              <div className="space-y-3">
                {availableActions.map((action) => (
                  <button
                    key={action.key}
                    className={`w-full btn ${
                      action.variant === "primary"
                        ? "btn-primary"
                        : action.variant === "warning"
                        ? "btn-warning"
                        : "btn-danger"
                    }`}
                    onClick={() => {
                      setSelectedAction(action);
                      setShowTransitionModal(true);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">流程进度</h3>
            <div className="space-y-3">
              {[
                { key: "pending_registrar", label: "登记员处理", done: demand.status !== "pending_registrar" },
                { key: "pending_supervisor", label: "主管审核", done: ["pending_reviewer", "completed", "rejected"].includes(demand.status) },
                { key: "pending_reviewer", label: "复核归档", done: ["completed", "rejected"].includes(demand.status) },
                { key: "completed", label: "已完成", done: demand.status === "completed" },
              ].map((step, idx) => (
                <div key={step.key} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.done
                        ? "bg-green-500 text-white"
                        : demand.status === step.key
                        ? "bg-primary-500 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {step.done ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`${
                      demand.status === step.key
                        ? "font-medium text-primary-700"
                        : step.done
                        ? "text-gray-700"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">基本信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">创建时间</span>
                <span className="text-gray-900">
                  {new Date(demand.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span className="text-gray-900">
                  {new Date(demand.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTransitionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedAction?.label}
            </h3>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-yellow-800 text-sm">
                状态将从 <strong>{statusLabels[demand.status]}</strong> 流转到{" "}
                <strong>{statusLabels[selectedAction?.target as DemandStatus]}</strong>
              </div>
              <div>
                <label className="label">处理意见</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="请输入处理意见..."
                  value={transitionComments}
                  onChange={(e) => setTransitionComments(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowTransitionModal(false);
                    setTransitionComments("");
                    setSelectedAction(null);
                  }}
                >
                  取消
                </button>
                <button
                  className={`btn ${
                    selectedAction?.variant === "primary"
                      ? "btn-primary"
                      : selectedAction?.variant === "warning"
                      ? "btn-warning"
                      : "btn-danger"
                  }`}
                  onClick={handleTransition}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
