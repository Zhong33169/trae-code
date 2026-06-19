import { useLoaderData, useNavigate, useOutletContext } from "@remix-run/react";
import { useEffect, useState } from "react";
import { fetchRecord, submitRecord, reviewRecord, approveRecord, returnRecord, uploadAttachment, updateAttachment } from "../api";

export async function loader({ params }: any) {
  return fetchRecord(Number(params.id));
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿", submitted: "已提交", under_review: "审核中",
  approved: "已批准", returned: "已退回", timeout: "已超时",
};

const RESULT_LABELS: Record<string, string> = {
  normal: "正常", adverse_reaction: "不良反应", ineffective: "无效", incomplete: "未完成",
};

const ATT_TYPE_LABELS: Record<string, string> = {
  required: "必传", supplementary: "补传", rejected: "已驳回",
};

const ROLE_LABELS: Record<string, string> = {
  breeder: "饲养员", vet_supervisor: "兽医主管", farm_manager: "场长",
};

export default function RecordDetail() {
  const initialData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const outletCtx = useOutletContext<{ currentUser?: any }>();
  const currentUser = outletCtx?.currentUser;
  const currentRole = currentUser?.role || "breeder";

  const [record, setRecord] = useState(initialData);
  const [error, setError] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [reviewForm, setReviewForm] = useState({ result: "", audit_note: "" });
  const [returnForm, setReturnForm] = useState({ return_reason: "", audit_note: "", rejection_reason: "", reject_attachment_ids: [] as number[] });
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ file_name: "", attachment_type: "supplementary", label: "" });

  const refresh = () => fetchRecord(record.id).then(setRecord);

  const handleSubmit = async () => {
    try {
      await submitRecord(record.id);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleReview = async () => {
    try {
      await reviewRecord(record.id, reviewForm);
      setShowReview(false);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleApprove = async () => {
    try {
      await approveRecord(record.id);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleReturn = async () => {
    try {
      await returnRecord(record.id, returnForm);
      setShowReturn(false);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleUpload = async () => {
    try {
      await uploadAttachment(record.id, {
        file_name: uploadForm.file_name,
        file_path: `/uploads/${record.id}/${uploadForm.file_name}`,
        attachment_type: uploadForm.attachment_type,
        label: uploadForm.label,
      });
      setShowUpload(false);
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const handleResubmitAttachment = async (attId: number) => {
    try {
      await updateAttachment(record.id, attId, {
        file_path: `/uploads/${record.id}/resubmitted_${Date.now()}.pdf`,
      });
      refresh();
    } catch (e: any) {
      setError(e.error || JSON.stringify(e));
    }
  };

  const toggleRejectAttachment = (attId: number) => {
    const ids = [...returnForm.reject_attachment_ids];
    const idx = ids.indexOf(attId);
    if (idx >= 0) ids.splice(idx, 1); else ids.push(attId);
    setReturnForm({ ...returnForm, reject_attachment_ids: ids });
  };

  const canSubmit = record.status === "draft" && currentRole === "breeder";
  const canReview = record.status === "submitted" && currentRole === "vet_supervisor";
  const canApprove = record.status === "under_review" && currentRole === "farm_manager";
  const canReturnByVet = record.status === "submitted" && currentRole === "vet_supervisor";
  const canReturnByMgr = record.status === "under_review" && currentRole === "farm_manager";
  const canReturn = canReturnByVet || canReturnByMgr;

  const canUploadAttachment = currentRole === "breeder" && ["draft", "returned"].includes(record.status);
  const canResubmitAttachment = currentRole === "breeder" && ["draft", "returned"].includes(record.status);
  const canRejectAttachment = ["vet_supervisor", "farm_manager"].includes(currentRole) && canReturn;

  const canCreateRecord = currentRole === "breeder";

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button className="btn btn-default" onClick={() => navigate("/records")}>← 返回记录列表</button>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, background: "#fff1f0", border: "1px solid #ffa39e", borderRadius: 8, color: "#cf1322" }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          📋 免疫记录详情: {record.record_code}
          <span className={`status-tag status-${record.status}`} style={{ marginLeft: 8 }}>{STATUS_LABELS[record.status]}</span>
          {record.is_overdue && <span className="overdue-badge">超时</span>}
        </div>

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">单号</span>
            <span className="detail-value">{record.record_code}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">免疫计划</span>
            <span className="detail-value">{record.plan_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">动物编号</span>
            <span className="detail-value">{record.animal_id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">耳标号</span>
            <span className="detail-value">{record.animal_tag || "-"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">畜种</span>
            <span className="detail-value">{record.species}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">疫苗批号</span>
            <span className="detail-value">{record.vaccine_batch || "-"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">剂量</span>
            <span className="detail-value">{record.dosage || "-"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">接种结果</span>
            <span className="detail-value" style={{ color: record.result === "normal" ? "#389e0d" : record.result ? "#cf1322" : "#666" }}>
              {record.result ? RESULT_LABELS[record.result] || record.result : "待定"}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">创建人（饲养员）</span>
            <span className="detail-value">{record.creator_name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">审核人（兽医主管）</span>
            <span className="detail-value">{record.reviewer_name || "待审核"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">批准人（场长）</span>
            <span className="detail-value">{record.approver_name || "待批准"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">截止日期</span>
            <span className="detail-value">
              {record.deadline_at ? new Date(record.deadline_at).toLocaleString("zh-CN") : "-"}
              {record.is_overdue && <span style={{ color: "#cf1322", marginLeft: 4 }}>已超时</span>}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">接种时间</span>
            <span className="detail-value">{record.vaccinated_at ? new Date(record.vaccinated_at).toLocaleString("zh-CN") : "-"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">审核时间</span>
            <span className="detail-value">{record.reviewed_at ? new Date(record.reviewed_at).toLocaleString("zh-CN") : "-"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">批准时间</span>
            <span className="detail-value">{record.approved_at ? new Date(record.approved_at).toLocaleString("zh-CN") : "-"}</span>
          </div>
        </div>

        {record.return_reason && (
          <div style={{ marginTop: 16, padding: 12, background: "#fff1f0", border: "1px solid #ffa39e", borderRadius: 8 }}>
            <strong style={{ color: "#cf1322" }}>退回原因:</strong> {record.return_reason}
          </div>
        )}

        {record.audit_note && (
          <div style={{ marginTop: 12, padding: 12, background: "#e6f7ff", border: "1px solid #91d5ff", borderRadius: 8 }}>
            <strong style={{ color: "#0050b3" }}>审计备注:</strong> {record.audit_note}
          </div>
        )}

        <hr className="section-divider" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong>附件信息</strong>
          <div className="action-group">
            {record.missing_required?.length > 0 && (
              <span style={{ color: "#d46b08", fontSize: 13 }}>
                ⚠️ 缺少 {record.missing_required.length} 个必传附件
              </span>
            )}
            {canUploadAttachment && (
              <button className="btn btn-sm btn-default" onClick={() => setShowUpload(true)}>+ 上传附件</button>
            )}
            {!canUploadAttachment && (
              <span style={{ color: "#999", fontSize: 12 }}>
                {ROLE_LABELS[currentRole]}在{STATUS_LABELS[record.status]}状态下不可上传附件
              </span>
            )}
          </div>
        </div>
        <div className="attachment-list">
          {record.attachments?.map((att: any) => (
            <div key={att.id} className={`attachment-item ${!att.file_path ? "missing" : ""} ${att.attachment_type === "rejected" ? "rejected" : ""}`}>
              <div className="att-info">
                <span className="att-icon">
                  {att.attachment_type === "rejected" ? "❌" : att.file_path ? "📎" : "⚠️"}
                </span>
                <div>
                  <div className="att-name">
                    {att.label}
                    <span className={`status-tag att-type-${att.attachment_type}`} style={{ marginLeft: 8 }}>
                      {ATT_TYPE_LABELS[att.attachment_type]}
                    </span>
                    {!att.file_path && <span style={{ color: "#cf1322", marginLeft: 8 }}>未上传</span>}
                  </div>
                  {att.file_name && <div style={{ fontSize: 12, color: "#999" }}>{att.file_name}</div>}
                  {att.rejection_reason && <div className="att-reason">驳回原因: {att.rejection_reason}</div>}
                  {att.uploader_name && <div style={{ fontSize: 12, color: "#999" }}>上传人: {att.uploader_name}</div>}
                </div>
              </div>
              <div>
                {att.attachment_type === "rejected" && canResubmitAttachment && (
                  <button className="btn btn-sm btn-warning" onClick={() => handleResubmitAttachment(att.id)}>补传</button>
                )}
                {!att.file_path && att.attachment_type === "required" && canResubmitAttachment && (
                  <button className="btn btn-sm btn-primary" onClick={() => handleResubmitAttachment(att.id)}>上传</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <hr className="section-divider" />

        <div style={{ marginBottom: 12 }}>
          <strong>操作</strong>
          <span style={{ marginLeft: 8, fontSize: 13, color: currentUser ? `var(--role-color-${currentRole}, #666)` : "#666" }}>
            （当前: {currentUser?.display_name || "-"} / {ROLE_LABELS[currentRole]}）
          </span>
        </div>

        {!currentUser && (
          <div style={{ padding: 12, background: "#fff7e6", border: "1px solid #ffd591", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#d46b08" }}>
            ⚠️ 未检测到用户角色，请先在页面右上角选择角色
          </div>
        )}

        <div className="action-group">
          {canSubmit && <button className="btn btn-primary" onClick={handleSubmit}>📝 提交（饲养员）</button>}
          {canReview && <button className="btn btn-warning" onClick={() => setShowReview(true)}>🔍 审核（兽医主管）</button>}
          {canApprove && <button className="btn btn-primary" onClick={handleApprove}>✅ 批准（场长）</button>}
          {canReturnByVet && <button className="btn btn-danger" onClick={() => setShowReturn(true)}>↩️ 退回（兽医主管）</button>}
          {canReturnByMgr && <button className="btn btn-danger" onClick={() => setShowReturn(true)}>↩️ 退回（场长）</button>}
          {!canSubmit && !canReview && !canApprove && !canReturn && (
            <span style={{ color: "#999", fontSize: 13 }}>
              当前角色「{ROLE_LABELS[currentRole]}」在「{STATUS_LABELS[record.status]}」状态下无可用操作
              {record.status === "returned" && currentRole === "breeder" && "，请先补传被驳回附件后重新提交"}
              {record.status === "draft" && currentRole !== "breeder" && "，草稿需由饲养员提交"}
              {record.status === "submitted" && currentRole === "breeder" && "，需等待兽医主管审核"}
              {record.status === "under_review" && currentRole === "vet_supervisor" && "，需等待场长批准"}
              {record.status === "approved" && "，该记录已完成审批"}
            </span>
          )}
        </div>
      </div>

      {record.rechecks?.length > 0 && (
        <div className="card">
          <div className="card-title">🔄 异常复查</div>
          <table>
            <thead>
              <tr>
                <th>异常类型</th>
                <th>描述</th>
                <th>状态</th>
                <th>截止日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {record.rechecks.map((rc: any) => (
                <tr key={rc.id}>
                  <td>{rc.abnormal_type}</td>
                  <td>{rc.description}</td>
                  <td><span className={`status-tag recheck-status-${rc.status}`}>{rc.status}</span></td>
                  <td>{rc.deadline_at ? new Date(rc.deadline_at).toLocaleDateString("zh-CN") : "-"}</td>
                  <td>
                    <button className="btn btn-sm btn-default" onClick={() => navigate(`/rechecks/${rc.id}`)}>查看</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-title">📜 审计日志</div>
        <div className="audit-timeline">
          {record.audit_logs?.map((log: any) => (
            <div key={log.id} className={`audit-item ${log.failure_reason ? "failure" : ""}`}>
              <div className="audit-dot" />
              <div className="audit-time">{log.actor_name}（{ROLE_LABELS[log.actor_role] || log.actor_role}）· {new Date(log.created_at).toLocaleString("zh-CN")}</div>
              <div className="audit-action">{log.action}</div>
              <div className="audit-detail">{log.detail}</div>
              {log.failure_reason && (
                <div className="audit-failure">
                  ❌ 失败原因: {log.failure_reason}
                </div>
              )}
              {log.next_step_suggestion && (
                <div className="audit-suggestion">
                  💡 下一步建议: {log.next_step_suggestion}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showReview && (
        <div className="modal-overlay" onClick={() => setShowReview(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔍 审核免疫记录（兽医主管）</div>
            <div className="form-group">
              <label className="form-label">接种结果</label>
              <select className="form-select" value={reviewForm.result} onChange={e => setReviewForm({...reviewForm, result: e.target.value})}>
                <option value="">请选择</option>
                <option value="normal">正常</option>
                <option value="adverse_reaction">不良反应</option>
                <option value="ineffective">无效</option>
                <option value="incomplete">未完成</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">审计备注</label>
              <textarea className="form-textarea" value={reviewForm.audit_note} onChange={e => setReviewForm({...reviewForm, audit_note: e.target.value})} placeholder="填写审核意见..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowReview(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleReview}>确认审核</button>
            </div>
          </div>
        </div>
      )}

      {showReturn && (
        <div className="modal-overlay" onClick={() => setShowReturn(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">↩️ 退回免疫记录（{ROLE_LABELS[currentRole]}）</div>
            <div className="form-group">
              <label className="form-label">退回原因 *</label>
              <textarea className="form-textarea" value={returnForm.return_reason} onChange={e => setReturnForm({...returnForm, return_reason: e.target.value})} placeholder="请说明退回原因..." />
            </div>
            {canRejectAttachment && (
              <div className="form-group">
                <label className="form-label">驳回附件（可选）</label>
                {record.attachments?.filter((a: any) => a.file_path && a.attachment_type !== "rejected").map((att: any) => (
                  <label key={att.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <input type="checkbox" checked={returnForm.reject_attachment_ids.includes(att.id)} onChange={() => toggleRejectAttachment(att.id)} />
                    {att.label} ({att.file_name})
                  </label>
                ))}
              </div>
            )}
            {returnForm.reject_attachment_ids.length > 0 && (
              <div className="form-group">
                <label className="form-label">附件驳回原因</label>
                <input className="form-input" value={returnForm.rejection_reason} onChange={e => setReturnForm({...returnForm, rejection_reason: e.target.value})} placeholder="附件为何被驳回" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">审计备注</label>
              <textarea className="form-textarea" value={returnForm.audit_note} onChange={e => setReturnForm({...returnForm, audit_note: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowReturn(false)}>取消</button>
              <button className="btn btn-danger" onClick={handleReturn}>确认退回</button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📎 上传附件（饲养员）</div>
            <div className="form-group">
              <label className="form-label">附件类型</label>
              <select className="form-select" value={uploadForm.attachment_type} onChange={e => setUploadForm({...uploadForm, attachment_type: e.target.value})}>
                <option value="supplementary">补传附件</option>
                <option value="required">必传附件</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">附件名称</label>
              <input className="form-input" value={uploadForm.file_name} onChange={e => setUploadForm({...uploadForm, file_name: e.target.value})} placeholder="如 接种证明.pdf" />
            </div>
            <div className="form-group">
              <label className="form-label">标签/说明</label>
              <input className="form-input" value={uploadForm.label} onChange={e => setUploadForm({...uploadForm, label: e.target.value})} placeholder="如 重新拍照的接种证明" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-default" onClick={() => setShowUpload(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpload}>上传</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
