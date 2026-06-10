import React, { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { formatDate, generateRequestId, validateRequired } from "~/utils/helpers";
import { StatusBadge } from "~/components/StatusBadge";
import { ConfirmModal } from "~/components/Modal";
import { createInspectionOrder, getChargingPiles, type ChargingPile } from "~/services/inspection";
import { INSPECTION_TYPE_LABELS } from "~/config";

const CHECK_ITEMS = [
  { key: "appearance", label: "外观检查" },
  { key: "cable", label: "线缆检查" },
  { key: "connector", label: "接头检查" },
  { key: "display", label: "显示屏检查" },
  { key: "charging", label: "充电功能检查" },
  { key: "emergency_stop", label: "急停按钮检查" },
  { key: "grounding", label: "接地检查" },
];

const CHECK_RESULT_OPTIONS = [
  { value: "normal", label: "正常", color: "#10b981" },
  { value: "abnormal", label: "异常", color: "#ef4444" },
  { value: "na", label: "不适用", color: "#9ca3af" },
];

export default function NewInspectionPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { success, error, warning, info } = useToast();

  const [piles, setPiles] = useState<ChargingPile[]>([]);
  const [loadingPiles, setLoadingPiles] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [formData, setFormData] = useState({
    type: "routine",
    charging_pile_id: 0,
    inspection_date: new Date().toISOString().split("T")[0],
    inspector_name: "",
    appearance_check: "",
    appearance_note: "",
    cable_check: "",
    cable_note: "",
    connector_check: "",
    connector_note: "",
    display_check: "",
    display_note: "",
    charging_check: "",
    charging_note: "",
    emergency_stop_check: "",
    emergency_stop_note: "",
    grounding_check: "",
    grounding_note: "",
    overall_result: "",
    registrar_opinion: "",
    request_id: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        inspector_name: user.full_name || user.username,
      }));
    }
  }, [user]);

  useEffect(() => {
    loadPiles();
  }, []);

  async function loadPiles() {
    try {
      setLoadingPiles(true);
      const response = await getChargingPiles({ page_size: 100, is_active: true });
      setPiles(response.items);
      if (response.items.length > 0) {
        setFormData((prev) => ({
          ...prev,
          charging_pile_id: response.items[0].id,
        }));
      }
    } catch (err: any) {
      error("加载充电桩列表失败：" + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingPiles(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    const pileError = validateRequired(formData.charging_pile_id?.toString());
    if (pileError) newErrors.charging_pile_id = "请选择充电桩";

    const dateError = validateRequired(formData.inspection_date);
    if (dateError) newErrors.inspection_date = "请选择巡检日期";

    const inspectorError = validateRequired(formData.inspector_name);
    if (inspectorError) newErrors.inspector_name = "请填写巡检员";

    const overallError = validateRequired(formData.overall_result);
    if (overallError) newErrors.overall_result = "请选择总体结果";

    for (const item of CHECK_ITEMS) {
      const checkKey = `${item.key}_check`;
      const error = validateRequired(formData[checkKey as keyof typeof formData] as string);
      if (error) {
        newErrors[checkKey] = `请选择${item.label}结果`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleInputChange(key: string, value: any) {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  }

  function handleSubmitPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) {
      warning("请完善表单信息");
      return;
    }
    setShowConfirm(true);
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      const requestId = generateRequestId();

      const submitData = {
        ...formData,
        request_id: requestId,
      };

      const result = await createInspectionOrder(submitData);
      success("巡检单创建成功！");
      navigate(`/inspections/${result.id}`);
    } catch (err: any) {
      if (err.response?.status === 409) {
        error("提交冲突，请刷新后重试");
      } else {
        error("创建失败：" + (err.response?.data?.detail || err.message));
      }
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  function handleCancel() {
    navigate("/inspections");
  }

  if (authLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: 16, color: "#6b7280" }}>加载中...</p>
      </div>
    );
  }

  const selectedPile = piles.find((p) => p.id === formData.charging_pile_id);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>创建巡检单</h1>
          <p style={styles.subtitle}>填写巡检信息和检查项</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.cancelButton} onClick={handleCancel}>
            取消
          </button>
          <button style={styles.submitButton} onClick={handleSubmitPreview}>
            提交
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmitPreview} style={styles.form}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>基本信息</h2>
          <div style={styles.grid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                巡检类型 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                style={{
                  ...styles.select,
                  borderColor: errors.type ? "#ef4444" : "#d1d5db",
                }}
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
              >
                {Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.type && <p style={styles.errorText}>{errors.type}</p>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                充电桩 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {loadingPiles ? (
                <div style={styles.input}>加载中...</div>
              ) : (
                <select
                  style={{
                    ...styles.select,
                    borderColor: errors.charging_pile_id ? "#ef4444" : "#d1d5db",
                  }}
                  value={formData.charging_pile_id}
                  onChange={(e) =>
                    handleInputChange("charging_pile_id", parseInt(e.target.value))
                  }
                >
                  <option value={0}>请选择充电桩</option>
                  {piles.map((pile) => (
                    <option key={pile.id} value={pile.id}>
                      {pile.pile_code} - {pile.pile_name} ({pile.station_name})
                    </option>
                  ))}
                </select>
              )}
              {errors.charging_pile_id && (
                <p style={styles.errorText}>{errors.charging_pile_id}</p>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                巡检日期 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="date"
                style={{
                  ...styles.input,
                  borderColor: errors.inspection_date ? "#ef4444" : "#d1d5db",
                }}
                value={formData.inspection_date}
                onChange={(e) => handleInputChange("inspection_date", e.target.value)}
              />
              {errors.inspection_date && (
                <p style={styles.errorText}>{errors.inspection_date}</p>
              )}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                巡检员 <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                style={{
                  ...styles.input,
                  borderColor: errors.inspector_name ? "#ef4444" : "#d1d5db",
                }}
                value={formData.inspector_name}
                onChange={(e) => handleInputChange("inspector_name", e.target.value)}
                placeholder="请输入巡检员姓名"
              />
              {errors.inspector_name && (
                <p style={styles.errorText}>{errors.inspector_name}</p>
              )}
            </div>
          </div>

          {selectedPile && (
            <div style={styles.pileInfo}>
              <div style={styles.pileInfoHeader}>
                <span style={styles.pileInfoTitle}>充电桩信息</span>
                <StatusBadge
                  status={selectedPile.is_active ? "archived" : "cancelled"}
                  label={selectedPile.is_active ? "启用" : "停用"}
                />
              </div>
              <div style={styles.pileInfoGrid}>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>编号：</span>
                  <span style={styles.pileInfoValue}>{selectedPile.pile_code}</span>
                </div>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>名称：</span>
                  <span style={styles.pileInfoValue}>{selectedPile.pile_name}</span>
                </div>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>充电站：</span>
                  <span style={styles.pileInfoValue}>{selectedPile.station_name}</span>
                </div>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>位置：</span>
                  <span style={styles.pileInfoValue}>
                    {selectedPile.location || "-"}
                  </span>
                </div>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>功率：</span>
                  <span style={styles.pileInfoValue}>
                    {selectedPile.power_rating || "-"}
                  </span>
                </div>
                <div style={styles.pileInfoItem}>
                  <span style={styles.pileInfoLabel}>上次巡检：</span>
                  <span style={styles.pileInfoValue}>
                    {selectedPile.last_inspection_at
                      ? formatDate(selectedPile.last_inspection_at)
                      : "未巡检"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            检查项 <span style={{ color: "#ef4444" }}>*</span>
          </h2>
          <div style={styles.checkItemsGrid}>
            {CHECK_ITEMS.map((item) => {
              const checkKey = `${item.key}_check`;
              const noteKey = `${item.key}_note`;
              const checkValue = formData[checkKey as keyof typeof formData] as string;
              const noteValue = formData[noteKey as keyof typeof formData] as string;
              const hasError = !!errors[checkKey];

              return (
                <div key={item.key} style={styles.checkItemCard}>
                  <div style={styles.checkItemHeader}>
                    <span style={styles.checkItemLabel}>{item.label}</span>
                    {hasError && <span style={styles.errorBadge}>必填</span>}
                  </div>
                  <div style={styles.checkItemOptions}>
                    {CHECK_RESULT_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        style={{
                          ...styles.checkOption,
                          borderColor: checkValue === option.value ? option.color : "#e5e7eb",
                          backgroundColor:
                            checkValue === option.value ? `${option.color}15` : "#fff",
                          color: checkValue === option.value ? option.color : "#374151",
                        }}
                      >
                        <input
                          type="radio"
                          name={checkKey}
                          value={option.value}
                          checked={checkValue === option.value}
                          onChange={(e) => handleInputChange(checkKey, e.target.value)}
                          style={{ display: "none" }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <textarea
                    style={styles.checkItemNote}
                    value={noteValue}
                    onChange={(e) => handleInputChange(noteKey, e.target.value)}
                    placeholder={`${item.label}备注（选填）`}
                    rows={2}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            总体结果 <span style={{ color: "#ef4444" }}>*</span>
          </h2>
          <div style={styles.overallResult}>
            <div style={styles.checkItemOptions}>
              {[
                { value: "pass", label: "合格", color: "#10b981" },
                { value: "fail", label: "不合格", color: "#ef4444" },
                { value: "need_repair", label: "需维修", color: "#f59e0b" },
              ].map((option) => (
                <label
                  key={option.value}
                  style={{
                    ...styles.checkOption,
                    minWidth: 100,
                    borderColor:
                      formData.overall_result === option.value
                        ? option.color
                        : "#e5e7eb",
                    backgroundColor:
                      formData.overall_result === option.value
                        ? `${option.color}15`
                        : "#fff",
                    color:
                      formData.overall_result === option.value
                        ? option.color
                        : "#374151",
                  }}
                >
                  <input
                    type="radio"
                    name="overall_result"
                    value={option.value}
                    checked={formData.overall_result === option.value}
                    onChange={(e) =>
                      handleInputChange("overall_result", e.target.value)
                    }
                    style={{ display: "none" }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {errors.overall_result && (
              <p style={styles.errorText}>{errors.overall_result}</p>
            )}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>处理意见</h2>
          <textarea
            style={styles.textarea}
            value={formData.registrar_opinion}
            onChange={(e) => handleInputChange("registrar_opinion", e.target.value)}
            placeholder="请输入处理意见（选填）"
            rows={4}
          />
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={handleCancel}
          >
            取消
          </button>
          <button type="submit" style={styles.submitButton} disabled={submitting}>
            {submitting ? "提交中..." : "提交"}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showConfirm}
        title="确认提交"
        content="确认提交巡检单吗？提交后将进入审核流程。"
        okText="确认提交"
        onOk={handleSubmit}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  );
}

const styles = {
  container: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
  },
  loading: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e5e7eb",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  headerActions: {
    display: "flex",
    gap: 12,
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
    margin: "0 0 20px 0",
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 20,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },
  select: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    backgroundColor: "#fff",
    transition: "border-color 0.2s",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    margin: 0,
  },
  errorBadge: {
    fontSize: 11,
    backgroundColor: "#fef2f2",
    color: "#ef4444",
    padding: "2px 8px",
    borderRadius: 4,
  },
  pileInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
  },
  pileInfoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pileInfoTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },
  pileInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  pileInfoItem: {
    fontSize: 13,
  },
  pileInfoLabel: {
    color: "#6b7280",
  },
  pileInfoValue: {
    color: "#111827",
    fontWeight: 500,
  },
  checkItemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, 1fr)",
    gap: 16,
  },
  checkItemCard: {
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
  },
  checkItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  checkItemLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  },
  checkItemOptions: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap" as const,
  },
  checkOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 20px",
    border: "2px solid #e5e7eb",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
    minWidth: 80,
  },
  checkItemNote: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 13,
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  overallResult: {
    marginTop: 8,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },
  cancelButton: {
    padding: "10px 20px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  submitButton: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
};
