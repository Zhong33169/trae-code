import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import {
  api,
  type Selection,
  type Attachment,
  type User,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
} from "../utils/api.ts";

interface Props {
  selectionId: string;
}

export default function SelectionDetail(props: Props) {
  const users = useSignal<User[]>([]);
  const usersLoaded = useSignal(false);
  const currentUserId = useSignal<string>("");
  const selection = useSignal<Selection | null>(null);
  const loading = useSignal(true);
  const error = useSignal("");
  const success = useSignal("");
  const activeTab = useSignal<"info" | "attachments" | "result" | "audit">("info");
  const showAttachModal = useSignal(false);
  const showReviewModal = useSignal(false);
  const showReturnModal = useSignal(false);
  const showArchiveModal = useSignal(false);
  const showResultModal = useSignal(false);
  const selectedRejectAttachIds = useSignal<string[]>([]);
  const attachReasons = useSignal<Record<string, string>>({});

  const currentUser = useComputed(
    () => users.value.find((u) => u.id === currentUserId.value)
  );

  const loadDetail = async () => {
    if (!currentUserId.value) return;
    loading.value = true;
    error.value = "";
    try {
      selection.value = await api.getSelection(
        currentUserId.value,
        props.selectionId
      );
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  };

  useEffect(() => {
    (async () => {
      if (!usersLoaded.value) {
        try {
          const u = await api.listUsers();
          users.value = u;
          const reg = u.find((x) => x.role === "registrar");
          if (reg) currentUserId.value = reg.id;
          usersLoaded.value = true;
        } catch (e: any) {
          error.value = "加载用户失败: " + e.message;
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (currentUserId.value) {
      loadDetail();
    }
  }, [currentUserId.value, usersLoaded.value]);

  const showMessage = (type: "error" | "success", msg: string) => {
    if (type === "error") error.value = msg;
    else success.value = msg;
    setTimeout(() => {
      error.value = "";
      success.value = "";
    }, 5000);
  };

  const submitForReview = async () => {
    try {
      await api.submitForReview(currentUserId.value, props.selectionId);
      showMessage("success", "已提交审核");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  const doReview = async (form: any) => {
    try {
      await api.review(currentUserId.value, props.selectionId, {
        approved: form.approved,
        reason: form.reason,
        reject_attach_ids: form.approved ? [] : selectedRejectAttachIds.value,
        attach_reasons: form.approved ? {} : attachReasons.value,
      });
      showReviewModal.value = false;
      selectedRejectAttachIds.value = [];
      attachReasons.value = {};
      showMessage("success", form.approved ? "已审核通过" : "已退回/要求补正");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  const addAttachment = async (data: { name: string; type: string; url: string }) => {
    try {
      await api.addAttachment(currentUserId.value, props.selectionId, data);
      showAttachModal.value = false;
      showMessage("success", "附件已上传");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  const setResult = async (result: string, note?: string) => {
    try {
      await api.setProcessResult(currentUserId.value, props.selectionId, {
        result,
        note,
      });
      showResultModal.value = false;
      showMessage("success", "处理结果已更新");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  const doArchive = async (note?: string) => {
    try {
      await api.archive(currentUserId.value, props.selectionId, { note });
      showArchiveModal.value = false;
      showMessage("success", "已归档");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  const doReturn = async (reason: string) => {
    try {
      await api.returnSelection(currentUserId.value, props.selectionId, reason);
      showReturnModal.value = false;
      showMessage("success", "已退回");
      loadDetail();
    } catch (e: any) {
      showMessage("error", e.message);
    }
  };

  if (loading.value) {
    return (
      <div class="container">
        <div class="empty">加载中...</div>
      </div>
    );
  }

  if (!selection.value) {
    return (
      <div class="container">
        <div class="alert alert-error">选品单不存在或您无权限查看</div>
        <a href="/" class="btn btn-secondary">返回列表</a>
      </div>
    );
  }

  const s = selection.value;
  const cu = currentUser.value;
  const totalAttCount = s.attachments?.length || 0;
  const validAttCount = s.attachments?.filter((a) => !a.rejected).length || 0;
  const rejectedAttCount = totalAttCount - validAttCount;
  const REQUIRED_ATT = 2;
  const needMore = Math.max(0, REQUIRED_ATT - validAttCount);
  const canSubmit = validAttCount >= REQUIRED_ATT;
  const isRemediationStatus =
    s.status === "missing_attachment" ||
    s.status === "rejected" ||
    s.status === "draft";

  const renderRemediationPanel = () => {
    if (!isRemediationStatus) return null;
    const titleMap: Record<string, string> = {
      missing_attachment: "📎 附件缺失补正",
      rejected: "↩️ 退回补正",
      draft: "📝 草稿完善",
    };
    const hintMap: Record<string, string> = {
      missing_attachment: "审核主管标记缺材料，需补齐附件后重新提交",
      rejected: `审核主管已退回：${s.reject_reason || "请查看审计日志了解详情"}，请补正后重新提交`,
      draft: "草稿未提交，请补充材料后提交审核",
    };
    const progress = Math.min(100, Math.round((validAttCount / REQUIRED_ATT) * 100));
    return (
      <div
        class="card"
        style={{
          borderLeft: `4px solid ${
            canSubmit ? "#10b981" : "#ef4444"
          }`,
          marginBottom: 16,
        }}
      >
        <div class="card-header">
          <h2 style={{ color: canSubmit ? "#059669" : "#dc2626" }}>
            {titleMap[s.status]} - 补正进度
          </h2>
          {canSubmit ? (
            <span
              class="status-badge"
              style={{ background: "#10b981" }}
            >
              ✅ 材料已满足，可提交审核
            </span>
          ) : (
            <span
              class="status-badge"
              style={{ background: "#ef4444" }}
            >
              ⚠️ 还需补齐 {needMore} 份有效附件
            </span>
          )}
        </div>
        <div class="card-body">
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
            {hintMap[s.status]}
          </div>

          <div class="grid-3" style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: canSubmit ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${canSubmit ? "#a7f3d0" : "#fecaca"}`,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                ✅ 有效附件
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: canSubmit ? "#059669" : "#dc2626",
                }}
              >
                {validAttCount}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>
                  {" "}
                  / 需 {REQUIRED_ATT} 份
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: rejectedAttCount > 0 ? "#fef2f2" : "#f9fafb",
                border: `1px solid ${rejectedAttCount > 0 ? "#fecaca" : "#e5e7eb"}`,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>🚫 已驳回附件</div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: rejectedAttCount > 0 ? "#b91c1c" : "#6b7280",
                }}
              >
                {rejectedAttCount}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>
                  {" "}
                  份
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
              }}
            >
              <div style={{ fontSize: 12, color: "#6b7280" }}>📎 合计附件</div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#1d4ed8",
                }}
              >
                {totalAttCount}
                <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}>
                  {" "}
                  份
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#6b7280",
                marginBottom: 4,
              }}
            >
              <span>补正进度</span>
              <span>
                {validAttCount} / {REQUIRED_ATT} 份有效附件（{progress}%）
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 10,
                background: "#f3f4f6",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: canSubmit
                    ? "linear-gradient(90deg,#10b981,#059669)"
                    : "linear-gradient(90deg,#ef4444,#dc2626)",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 6,
              background: canSubmit ? "#ecfdf5" : "#fffbeb",
              color: canSubmit ? "#065f46" : "#92400e",
              border: `1px solid ${canSubmit ? "#a7f3d0" : "#fde68a"}`,
            }}
          >
            {canSubmit
              ? "✅ 已满足可提交条件：有效附件 ≥ 2 份。可以点击上方「提交审核」将选品单送回处理队列。"
              : `⚠️ 可提交条件：至少 2 份有效附件（未被驳回的品牌授权书、质检报告等）。当前还差 ${needMore} 份，请点击「上传附件」补齐。`}
          </div>

          {s.status === "rejected" && s.reject_reason && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 6,
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: 13,
              }}
            >
              <strong>退回原因：</strong>
              {s.reject_reason}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div class="container">
      <div class="breadcrumb">
        <a href="/">← 返回选品单列表</a> / 选品单详情
      </div>

      <div class="toolbar">
        <div class="role-switcher">
          <label>角色切换：</label>
          <select
            value={currentUserId.value}
            onChange={(e: Event) =>
              (currentUserId.value = (e.target as HTMLSelectElement).value)
            }
          >
            {users.value.map((u) => (
              <option value={u.id}>
                [{ROLE_LABELS[u.role]}] {u.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span class="status-badge" style={{ background: STATUS_COLORS[s.status] }}>
            {STATUS_LABELS[s.status]}
          </span>
        </div>
      </div>

      {error.value && (
        <div class="alert alert-error" onClick={() => (error.value = "")}>
          ❌ {error.value}
        </div>
      )}
      {success.value && (
        <div class="alert alert-success" onClick={() => (success.value = "")}>
          ✅ {success.value}
        </div>
      )}

      {renderRemediationPanel()}

      <div class="card">
        <div class="card-header">
          <h2>
            选品单：<code>{s.id}</code> - {s.product_name}
          </h2>
          <div class="row">
            {cu?.role === "registrar" &&
              (s.status === "draft" ||
                s.status === "missing_attachment" ||
                s.status === "rejected") && (
                <>
                  <button class="btn btn-primary" onClick={submitForReview}>
                    ✅ 提交审核
                  </button>
                  <button
                    class="btn btn-secondary"
                    onClick={() => (showAttachModal.value = true)}
                  >
                    📎 上传附件
                  </button>
                </>
              )}

            {cu?.role === "supervisor" &&
              (s.status === "pending" || s.status === "missing_attachment") && (
                <>
                  <button
                    class="btn btn-warning"
                    onClick={() => (showResultModal.value = true)}
                  >
                    📝 记录处理结果
                  </button>
                  <button
                    class="btn btn-primary"
                    onClick={() => (showReviewModal.value = true)}
                  >
                    ⚖️ 开始审核
                  </button>
                </>
              )}

            {cu?.role === "reviewer" && s.status === "approved" && (
              <>
                <button
                  class="btn btn-danger"
                  onClick={() => (showReturnModal.value = true)}
                >
                  ↩️ 复核退回
                </button>
                <button
                  class="btn btn-success"
                  onClick={() => (showArchiveModal.value = true)}
                >
                  📦 复核归档
                </button>
              </>
            )}

            {cu?.role === "reviewer" && s.status === "timeout" && (
              <button
                class="btn btn-success"
                onClick={() => (showArchiveModal.value = true)}
              >
                📦 归档结案
              </button>
            )}

            {(s.status === "missing_attachment" ||
              s.status === "rejected" ||
              s.status === "timeout") && (
              <span class="alert alert-warning" style={{ margin: 0, padding: "6px 12px" }}>
                ⚠️ 当前为异常状态，需按流程处理
              </span>
            )}
          </div>
        </div>
      </div>

      <div class="tabs">
        <div
          class={`tab ${activeTab.value === "info" ? "active" : ""}`}
          onClick={() => (activeTab.value = "info")}
        >
          📋 基本信息
        </div>
        <div
          class={`tab ${activeTab.value === "attachments" ? "active" : ""}`}
          onClick={() => (activeTab.value = "attachments")}
        >
          📎 附件 ({validAttCount}份有效 / {s.attachments?.length || 0}份)
        </div>
        <div
          class={`tab ${activeTab.value === "result" ? "active" : ""}`}
          onClick={() => (activeTab.value = "result")}
        >
          ✅ 处理结果 / 退回原因
        </div>
        <div
          class={`tab ${activeTab.value === "audit" ? "active" : ""}`}
          onClick={() => (activeTab.value = "audit")}
        >
          📜 审计日志 ({s.audit_logs?.length || 0})
        </div>
      </div>

      {activeTab.value === "info" && (
        <div class="card">
          <div class="card-body">
            <div class="grid-2">
              <div>
                <div class="info-item">
                  <div class="label">商品名称</div>
                  <div class="value">{s.product_name}</div>
                </div>
                <div class="info-item">
                  <div class="label">商品分类</div>
                  <div class="value">{s.product_category}</div>
                </div>
                <div class="info-item">
                  <div class="label">品牌</div>
                  <div class="value">{s.brand}</div>
                </div>
                <div class="info-item">
                  <div class="label">供应商</div>
                  <div class="value">{s.supplier}</div>
                </div>
                <div class="info-item">
                  <div class="label">商品描述</div>
                  <div class="value">{s.description || "-"}</div>
                </div>
              </div>
              <div>
                <div class="info-item">
                  <div class="label">预估价格</div>
                  <div class="value price">¥{s.estimated_price.toFixed(2)}</div>
                </div>
                <div class="info-item">
                  <div class="label">佣金比例</div>
                  <div class="value">{Math.round(s.commission_rate * 100)}%</div>
                </div>
                <div class="info-item">
                  <div class="label">创建人</div>
                  <div class="value">{s.created_by_name}</div>
                </div>
                <div class="info-item">
                  <div class="label">创建时间</div>
                  <div class="value">
                    {new Date(s.created_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                <div class="info-item">
                  <div class="label">最后更新</div>
                  <div class="value">
                    {new Date(s.updated_at).toLocaleString("zh-CN")}
                  </div>
                </div>
                {s.planned_live_date && (
                  <div class="info-item">
                    <div class="label">计划直播时间</div>
                    <div class="value">
                      {new Date(s.planned_live_date).toLocaleString("zh-CN")}
                    </div>
                  </div>
                )}
                {s.deadline && (
                  <div class="info-item">
                    <div class="label">处理截止</div>
                    <div class="value">
                      {new Date(s.deadline).toLocaleString("zh-CN")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab.value === "attachments" && (
        <div class="card">
          <div class="card-header">
            <h2>
              附件列表
              <span style={{ fontWeight: 400, fontSize: 13, color: "#6b7280", marginLeft: 8 }}>
                有效附件 {validAttCount} 份，至少需要 2 份才能提交审核
              </span>
            </h2>
            {cu?.role === "registrar" &&
              (s.status === "draft" ||
                s.status === "missing_attachment" ||
                s.status === "rejected") && (
                <button
                  class="btn btn-primary btn-sm"
                  onClick={() => (showAttachModal.value = true)}
                >
                  ➕ 上传附件
                </button>
              )}
          </div>
          <div class="card-body">
            {s.attachments?.length === 0 ? (
              <div class="empty">暂无附件</div>
            ) : (
              s.attachments?.map((a) => (
                <AttachmentItem key={a.id} att={a} />
              ))
            )}
            {validAttCount < 2 && s.status !== "archived" && (
              <div class="alert alert-warning" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  ⚠️ 补正要求：有效附件不足 2 份，补齐后才能回到处理队列
                </div>
                <div style={{ fontSize: 12 }}>
                  当前：{validAttCount} 份有效 / {rejectedAttCount} 份驳回 / {totalAttCount} 份合计。
                  请上传 <strong>品牌授权书</strong>、<strong>质检报告</strong> 等至少 2 份未被驳回的附件。
                  被驳回的附件不会计入有效数量，需要重新上传。
                </div>
              </div>
            )}
            {validAttCount >= 2 && isRemediationStatus && (
              <div class="alert alert-success" style={{ marginTop: 12 }}>
                ✅ 补正完成：有效附件 {validAttCount} 份，已满足 ≥2 份的要求，可以点击上方「提交审核」。
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab.value === "result" && (
        <div class="card">
          <div class="card-body">
            <div class="grid-2">
              <div>
                <div class="info-item">
                  <div class="label">处理结果</div>
                  <div class="value">{s.process_result || "（暂无）"}</div>
                </div>
                <div class="info-item">
                  <div class="label">退回原因</div>
                  <div class="value" style={{ color: "#b91c1c" }}>
                    {s.reject_reason || "（无）"}
                  </div>
                </div>
              </div>
              <div>
                <div class="info-item">
                  <div class="label">审计备注</div>
                  <div class="value" style={{ whiteSpace: "pre-wrap" }}>
                    {s.audit_note || "（暂无）"}
                  </div>
                </div>
              </div>
            </div>
            {cu?.role === "supervisor" && s.status === "pending" && (
              <div style={{ marginTop: 14 }}>
                <button
                  class="btn btn-warning btn-sm"
                  onClick={() => (showResultModal.value = true)}
                >
                  📝 更新处理结果
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab.value === "audit" && (
        <div class="card">
          <div class="card-header">
            <h2>审计日志 - 可追溯谁、什么时候、为什么没处理成功</h2>
          </div>
          <div class="card-body">
            {s.audit_logs?.length === 0 ? (
              <div class="empty">暂无审计记录</div>
            ) : (
              s.audit_logs?.map((log) => (
                <div class="audit-item" key={log.id}>
                  <div class="top">
                    <span class="action">{log.action}</span>
                    <span class="time">
                      {new Date(log.created_at).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div class="user">操作人：{log.user_name}</div>
                  {log.detail && <div class="detail">详情：{log.detail}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAttachModal.value && (
        <AddAttachmentModal
          onClose={() => (showAttachModal.value = false)}
          onSubmit={addAttachment}
        />
      )}

      {showReviewModal.value && (
        <ReviewModal
          attachments={s.attachments || []}
          selectedRejectIds={selectedRejectAttachIds}
          attachReasons={attachReasons}
          onClose={() => {
            showReviewModal.value = false;
            selectedRejectAttachIds.value = [];
            attachReasons.value = {};
          }}
          onSubmit={doReview}
        />
      )}

      {showResultModal.value && (
        <ResultModal
          onClose={() => (showResultModal.value = false)}
          onSubmit={setResult}
          current={s.process_result || ""}
        />
      )}

      {showArchiveModal.value && (
        <ArchiveModal
          onClose={() => (showArchiveModal.value = false)}
          onSubmit={doArchive}
        />
      )}

      {showReturnModal.value && (
        <ReturnModal
          onClose={() => (showReturnModal.value = false)}
          onSubmit={doReturn}
        />
      )}
    </div>
  );
}

function AttachmentItem({ att }: { att: Attachment }) {
  return (
    <div class={`attachment-item ${att.rejected ? "rejected" : ""}`}>
      <div class="attachment-info">
        <div class="name">
          {att.rejected && "🚫 "}
          {att.name}
          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>
            （{att.type}）
          </span>
        </div>
        <div class="meta">
          上传时间：{new Date(att.uploaded_at).toLocaleString("zh-CN")}
          {att.rejected && att.rejected_by && (
            <>
              　｜驳回人：{att.rejected_by}
              {att.rejected_at && (
                <> 于 {new Date(att.rejected_at).toLocaleString("zh-CN")}</>
              )}
            </>
          )}
        </div>
        {att.rejected && att.reject_reason && (
          <div class="reject-reason">❌ 驳回原因：{att.reject_reason}</div>
        )}
      </div>
      <a
        href={att.url}
        target="_blank"
        rel="noopener"
        class="btn btn-outline btn-sm"
      >
        查看
      </a>
    </div>
  );
}

function AddAttachmentModal(props: {
  onClose: () => void;
  onSubmit: (d: { name: string; type: string; url: string }) => void;
}) {
  const form = useSignal({ name: "", type: "授权文件", url: "" });
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>📎 上传附件</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>附件名称<span class="required">*</span></label>
            <input
              placeholder="如：品牌授权书.pdf"
              value={form.value.name}
              onInput={(e: Event) =>
                (form.value = {
                  ...form.value,
                  name: (e.target as HTMLInputElement).value,
                })
              }
            />
          </div>
          <div class="form-group">
            <label>附件类型</label>
            <select
              value={form.value.type}
              onInput={(e: Event) =>
                (form.value = {
                  ...form.value,
                  type: (e.target as HTMLSelectElement).value,
                })
              }
            >
              <option>授权文件</option>
              <option>质检文件</option>
              <option>图片资料</option>
              <option>合同</option>
              <option>其他</option>
            </select>
          </div>
          <div class="form-group">
            <label>附件地址 (URL)<span class="required">*</span></label>
            <input
              placeholder="https://..."
              value={form.value.url}
              onInput={(e: Event) =>
                (form.value = {
                  ...form.value,
                  url: (e.target as HTMLInputElement).value,
                })
              }
            />
          </div>
          <div class="alert alert-info">
            💡 为演示方便，此处填写 URL 即可。系统要求至少上传品牌授权书、质检报告 2 份有效附件。
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>取消</button>
          <button
            class="btn btn-primary"
            onClick={() => {
              if (!form.value.name || !form.value.url) return;
              props.onSubmit(form.value);
            }}
          >
            上传
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal(props: {
  attachments: Attachment[];
  selectedRejectIds: ReturnType<typeof useSignal<string[]>>;
  attachReasons: ReturnType<typeof useSignal<Record<string, string>>>;
  onClose: () => void;
  onSubmit: (d: { approved: boolean; reason: string }) => void;
}) {
  const decision = useSignal<"approve" | "reject_att" | "reject_all">("approve");
  const reason = useSignal("");

  const toggleAttach = (id: string) => {
    const cur = props.selectedRejectIds.value;
    if (cur.includes(id)) {
      props.selectedRejectIds.value = cur.filter((x) => x !== id);
    } else {
      props.selectedRejectIds.value = [...cur, id];
    }
  };

  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>⚖️ 审核直播选品单</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>审核结论</label>
            <div class="checkbox-group" style={{ flexDirection: "column" }}>
              <label class="checkbox-item">
                <input
                  type="radio"
                  name="decision"
                  checked={decision.value === "approve"}
                  onInput={() => (decision.value = "approve")}
                />
                ✅ 审核通过 - 材料齐全，流程完整
              </label>
              <label class="checkbox-item">
                <input
                  type="radio"
                  name="decision"
                  checked={decision.value === "reject_att"}
                  onInput={() => (decision.value = "reject_att")}
                />
                📎 标记缺材料 - 驳回部分附件，要求补正后重新提交
              </label>
              <label class="checkbox-item">
                <input
                  type="radio"
                  name="decision"
                  checked={decision.value === "reject_all"}
                  onInput={() => (decision.value = "reject_all")}
                />
                🚫 直接退回 - 选品整体不符合要求
              </label>
            </div>
          </div>

          {decision.value === "reject_att" && props.attachments.length > 0 && (
            <div class="form-group">
              <label>选择要驳回的附件（被驳回的附件会保留原因）</label>
              {props.attachments.map((a) => (
                <div key={a.id} style={{ margin: "8px 0", padding: 8, border: "1px solid #e5e7eb", borderRadius: 6 }}>
                  <label class="checkbox-item">
                    <input
                      type="checkbox"
                      checked={props.selectedRejectIds.value.includes(a.id)}
                      onInput={() => toggleAttach(a.id)}
                    />
                    <strong>{a.name}</strong>（{a.type}）
                  </label>
                  {props.selectedRejectIds.value.includes(a.id) && (
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="text"
                        placeholder="驳回原因（必填）"
                        style={{ width: "100%" }}
                        value={props.attachReasons.value[a.id] || ""}
                        onInput={(e: Event) =>
                          (props.attachReasons.value = {
                            ...props.attachReasons.value,
                            [a.id]: (e.target as HTMLInputElement).value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div class="form-group">
            <label>{decision.value === "approve" ? "审核意见（选填）" : "退回/补正原因"}</label>
            <textarea
              placeholder={decision.value === "approve" ? "可记录通过说明" : "请说明退回或要求补正的原因"}
              value={reason.value}
              onInput={(e: Event) => (reason.value = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>取消</button>
          <button
            class={decision.value === "approve" ? "btn btn-success" : "btn btn-danger"}
            onClick={() => {
              if (decision.value !== "approve" && !reason.value.trim()) {
                alert("请填写原因");
                return;
              }
              if (decision.value === "reject_att" && props.selectedRejectIds.value.length === 0) {
                alert("请选择要驳回的附件");
                return;
              }
              props.onSubmit({
                approved: decision.value === "approve",
                reason: reason.value,
              });
            }}
          >
            提交审核结论
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultModal(props: {
  onClose: () => void;
  onSubmit: (result: string, note?: string) => void;
  current: string;
}) {
  const result = useSignal(props.current);
  const note = useSignal("");
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>📝 处理结果 / 审计备注</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>处理结果</label>
            <textarea
              placeholder="如：材料基本齐全，待品牌方补充最终授权后通过"
              value={result.value}
              onInput={(e: Event) => (result.value = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="form-group">
            <label>审计备注（会追加到选品单审计备注中，可追溯）</label>
            <textarea
              placeholder="记录过程中的关键信息"
              value={note.value}
              onInput={(e: Event) => (note.value = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>取消</button>
          <button
            class="btn btn-primary"
            onClick={() => props.onSubmit(result.value, note.value)}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function ArchiveModal(props: {
  onClose: () => void;
  onSubmit: (note?: string) => void;
}) {
  const note = useSignal("");
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>📦 复核归档</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>归档备注（选填，写入审计）</label>
            <textarea
              placeholder="归档说明"
              value={note.value}
              onInput={(e: Event) => (note.value = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="alert alert-info">
            ✅ 归档后该选品单完成流程，不可再修改
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>取消</button>
          <button class="btn btn-success" onClick={() => props.onSubmit(note.value)}>
            确认归档
          </button>
        </div>
      </div>
    </div>
  );
}

function ReturnModal(props: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const reason = useSignal("");
  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>↩️ 复核退回</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>退回原因<span class="required">*</span></label>
            <textarea
              placeholder="请详细说明复核不通过的原因"
              value={reason.value}
              onInput={(e: Event) => (reason.value = (e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <div class="alert alert-warning">
            ⚠️ 退回后，该选品单返回给登记员，需要重新修改并提交
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onClick={props.onClose}>取消</button>
          <button
            class="btn btn-danger"
            onClick={() => {
              if (!reason.value.trim()) {
                alert("请填写退回原因");
                return;
              }
              props.onSubmit(reason.value);
            }}
          >
            确认退回
          </button>
        </div>
      </div>
    </div>
  );
}
