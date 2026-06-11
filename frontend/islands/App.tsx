import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import {
  api,
  type User,
  type Selection,
  type SelectionStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
} from "../utils/api.ts";

interface Stats {
  total: number;
  exception_total: number;
  status_count: Record<string, number>;
  exception_by_status: Record<string, Selection[]>;
}

interface Props {}

const EXCEPTION_STATUSES: SelectionStatus[] = [
  "missing_attachment",
  "rejected",
  "timeout",
];

const EXCEPTION_LABELS: Record<SelectionStatus, string> = {
  missing_attachment: "📎 缺材料待补正",
  rejected: "🚫 已退回",
  timeout: "⏰ 超时未处理",
  draft: "",
  pending: "",
  approved: "",
  archived: "",
};

export default function App(_props: Props) {
  const users = useSignal<User[]>([]);
  const usersLoaded = useSignal(false);
  const currentUserId = useSignal<string>("");
  const statusFilter = useSignal<string>("all");
  const keyword = useSignal<string>("");
  const selections = useSignal<Selection[]>([]);
  const stats = useSignal<Stats | null>(null);
  const loading = useSignal(false);
  const error = useSignal("");
  const success = useSignal("");
  const selectedIds = useSignal<string[]>([]);
  const showCreateModal = useSignal(false);

  const isExceptionView = useComputed(() => statusFilter.value === "__exception__");

  const currentUser = useComputed(
    () => users.value.find((u) => u.id === currentUserId.value)
  );

  const filteredSelections = useComputed(() => {
    let list = selections.value;
    if (isExceptionView.value && stats.value) {
      const merged: Selection[] = [];
      for (const st of EXCEPTION_STATUSES) {
        const items = stats.value.exception_by_status[st] || [];
        merged.push(...items);
      }
      list = merged;
    }
    const kw = keyword.value.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (s) =>
          s.product_name.toLowerCase().includes(kw) ||
          s.brand.toLowerCase().includes(kw) ||
          s.id.toLowerCase().includes(kw)
      );
    }
    return list;
  });

  const loadSelections = async () => {
    loading.value = true;
    error.value = "";
    try {
      if (isExceptionView.value) {
        const [listData, statsData] = await Promise.all([
          api.listSelections(currentUserId.value, ""),
          api.getStats(currentUserId.value),
        ]);
        selections.value = listData;
        stats.value = statsData;
      } else {
        const data = await api.listSelections(
          currentUserId.value,
          statusFilter.value === "all" ? "" : statusFilter.value
        );
        selections.value = data;
        stats.value = null;
      }
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
    if (currentUserId.value && usersLoaded.value) {
      loadSelections();
    }
  }, [currentUserId.value, statusFilter.value, usersLoaded.value]);

  const handleRoleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    currentUserId.value = target.value;
    selectedIds.value = [];
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.value.length === filteredSelections.value.length) {
      selectedIds.value = [];
    } else {
      selectedIds.value = filteredSelections.value.map((s) => s.id);
    }
  };

  const batchAction = async (
    action: "approve" | "reject" | "archive",
    reason?: string
  ) => {
    if (selectedIds.value.length === 0) {
      error.value = "请先选择要处理的选品单";
      return;
    }
    if (action === "reject" && !reason) {
      reason = prompt("请输入批量退回原因：");
      if (!reason) return;
    }
    try {
      const res = await api.batchProcess(currentUserId.value, {
        ids: selectedIds.value,
        action,
        reason,
      });
      const successCount = res.results.filter((r) => r.success).length;
      const msgs = res.results
        .map(
          (r) =>
            `${r.product_name || r.id}：${r.success ? "✅ " + r.message : "❌ " + r.message}`
        )
        .join("\n");
      success.value = `批量处理完成，成功 ${successCount}/${res.results.length} 条\n\n${msgs}`;
      selectedIds.value = [];
      loadSelections();
      setTimeout(() => (success.value = ""), 8000);
    } catch (e: any) {
      error.value = e.message;
    }
  };

  const renderSelectionRow = (s: Selection, showCheckbox: boolean) => (
    <tr key={s.id}>
      {showCheckbox && (
        <td>
          <input
            type="checkbox"
            checked={selectedIds.value.includes(s.id)}
            onInput={() => toggleSelect(s.id)}
          />
        </td>
      )}
      <td>
        <code style={{ fontSize: 12 }}>{s.id}</code>
      </td>
      <td>
        <a href={`/selections/${s.id}`} class="link">
          <strong>{s.product_name}</strong>
        </a>
        <span
          style={{
            marginLeft: 6,
            fontSize: 11,
            color: "#ef4444",
          }}
        >
          ⚠️
        </span>
      </td>
      <td>
        {s.brand}
        <div style={{ fontSize: 12, color: "#6b7280" }}>{s.product_category}</div>
      </td>
      <td>
        <span class="price">¥{s.estimated_price.toFixed(2)}</span>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          佣金 {Math.round(s.commission_rate * 100)}%
        </div>
      </td>
      <td>
        <span
          class="status-badge"
          style={{
            background: STATUS_COLORS[s.status as SelectionStatus],
          }}
        >
          {STATUS_LABELS[s.status as SelectionStatus]}
        </span>
        {s.reject_reason && (
          <div
            style={{
              fontSize: 11,
              color: "#b91c1c",
              marginTop: 4,
              maxWidth: 220,
            }}
            title={s.reject_reason}
          >
            {s.reject_reason.length > 28
              ? s.reject_reason.slice(0, 28) + "..."
              : s.reject_reason}
          </div>
        )}
      </td>
      <td style={{ fontSize: 12 }}>{s.created_by_name}</td>
      <td style={{ fontSize: 12, color: "#6b7280" }}>
        {new Date(s.created_at).toLocaleString("zh-CN", {
          hour12: false,
        })}
      </td>
      <td>
        <a href={`/selections/${s.id}`} class="btn btn-outline btn-sm">
          立即处理
        </a>
      </td>
    </tr>
  );

  const renderExceptionWorkbench = () => {
    const st = stats.value;
    if (!st) {
      return <div class="empty">加载异常工作台...</div>;
    }
    const showCheckbox = currentUser.value?.role !== "registrar";
    return (
      <div>
        <div class="grid-3" style={{ marginBottom: 20 }}>
          {EXCEPTION_STATUSES.map((stKey) => {
            const count = st.exception_by_status[stKey]?.length || 0;
            return (
              <div
                key={stKey}
                class="card"
                style={{ margin: 0, borderLeft: `4px solid ${STATUS_COLORS[stKey]}` }}
              >
                <div class="card-body" style={{ padding: "16px 20px" }}>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    {EXCEPTION_LABELS[stKey]}
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: STATUS_COLORS[stKey],
                      marginTop: 4,
                    }}
                  >
                    {count}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    {stKey === "missing_attachment" && "等待登记员补齐附件"}
                    {stKey === "rejected" && "等待登记员修改后重提"}
                    {stKey === "timeout" && "超过截止时间未处理"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {EXCEPTION_STATUSES.map((stKey) => {
          const items = st.exception_by_status[stKey] || [];
          const kw = keyword.value.trim().toLowerCase();
          const filtered = kw
            ? items.filter(
                (s) =>
                  s.product_name.toLowerCase().includes(kw) ||
                  s.brand.toLowerCase().includes(kw) ||
                  s.id.toLowerCase().includes(kw)
              )
            : items;
          return (
            <div class="card" key={stKey} style={{ marginBottom: 20 }}>
              <div class="card-header">
                <h2 style={{ color: STATUS_COLORS[stKey] }}>
                  {EXCEPTION_LABELS[stKey]}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: 13,
                      color: "#6b7280",
                      marginLeft: 8,
                    }}
                  >
                    共 {filtered.length} 条
                  </span>
                </h2>
              </div>
              <div class="card-body" style={{ padding: 0 }}>
                {filtered.length === 0 ? (
                  <div class="empty">暂无此类型异常</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        {showCheckbox && (
                          <th style={{ width: 40 }}>
                            <input
                              type="checkbox"
                              checked={
                                selectedIds.value.length === filtered.length &&
                                filtered.length > 0 &&
                                filtered.every((x) => selectedIds.value.includes(x.id))
                              }
                              onInput={() => {
                                if (
                                  filtered.every((x) =>
                                    selectedIds.value.includes(x.id)
                                  )
                                ) {
                                  selectedIds.value = selectedIds.value.filter(
                                    (x) => !filtered.some((f) => f.id === x)
                                  );
                                } else {
                                  const add = filtered
                                    .filter((x) => !selectedIds.value.includes(x.id))
                                    .map((x) => x.id);
                                  selectedIds.value = [
                                    ...selectedIds.value,
                                    ...add,
                                  ];
                                }
                              }}
                            />
                          </th>
                        )}
                        <th>编号</th>
                        <th>商品名称</th>
                        <th>品牌/分类</th>
                        <th>价格/佣金</th>
                        <th>异常详情</th>
                        <th>创建人</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => renderSelectionRow(s, showCheckbox))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNormalList = () => {
    const showCheckbox = currentUser.value?.role !== "registrar";
    return (
      <div class="card">
        <div class="card-header">
          <h2>
            直播选品单列表
            <span
              style={{
                color: "#6b7280",
                fontWeight: 400,
                fontSize: 13,
                marginLeft: 8,
              }}
            >
              共 {filteredSelections.value.length} 条
              {currentUser.value && (
                <> ｜ 当前视角：{ROLE_LABELS[currentUser.value.role]}</>
              )}
            </span>
          </h2>
        </div>
        <div class="card-body" style={{ padding: 0 }}>
          {loading.value ? (
            <div class="empty">加载中...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {showCheckbox && (
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.value.length ===
                            filteredSelections.value.length &&
                          filteredSelections.value.length > 0
                        }
                        onInput={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th>编号</th>
                  <th>商品名称</th>
                  <th>品牌/分类</th>
                  <th>价格/佣金</th>
                  <th>状态</th>
                  <th>创建人</th>
                  <th>创建时间</th>
                  <th>处理</th>
                </tr>
              </thead>
              <tbody>
                {filteredSelections.value.length === 0 ? (
                  <tr>
                    <td colSpan={showCheckbox ? 9 : 8}>
                      <div class="empty">暂无选品单数据</div>
                    </td>
                  </tr>
                ) : (
                  filteredSelections.value.map((s) => {
                    const isException =
                      s.status === "missing_attachment" ||
                      s.status === "rejected" ||
                      s.status === "timeout";
                    return (
                      <tr key={s.id}>
                        {showCheckbox && (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.value.includes(s.id)}
                              onInput={() => toggleSelect(s.id)}
                            />
                          </td>
                        )}
                        <td>
                          <code style={{ fontSize: 12 }}>{s.id}</code>
                        </td>
                        <td>
                          <a href={`/selections/${s.id}`} class="link">
                            <strong>{s.product_name}</strong>
                          </a>
                          {isException && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 11,
                                color: "#ef4444",
                              }}
                            >
                              ⚠️
                            </span>
                          )}
                        </td>
                        <td>
                          {s.brand}
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {s.product_category}
                          </div>
                        </td>
                        <td>
                          <span class="price">¥{s.estimated_price.toFixed(2)}</span>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            佣金 {Math.round(s.commission_rate * 100)}%
                          </div>
                        </td>
                        <td>
                          <span
                            class="status-badge"
                            style={{
                              background: STATUS_COLORS[s.status as SelectionStatus],
                            }}
                          >
                            {STATUS_LABELS[s.status as SelectionStatus]}
                          </span>
                          {s.reject_reason && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#b91c1c",
                                marginTop: 4,
                                maxWidth: 200,
                              }}
                              title={s.reject_reason}
                            >
                              {s.reject_reason.length > 25
                                ? s.reject_reason.slice(0, 25) + "..."
                                : s.reject_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{s.created_by_name}</td>
                        <td style={{ fontSize: 12, color: "#6b7280" }}>
                          {new Date(s.created_at).toLocaleString("zh-CN", {
                            hour12: false,
                          })}
                        </td>
                        <td>
                          <a
                            href={`/selections/${s.id}`}
                            class="btn btn-outline btn-sm"
                          >
                            详情
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  return (
    <div class="container">
      <div class="header">
        <h1>🎬 直播电商团队 - 附件缺失补正直播选品单系统</h1>
        <p>
          角色切换：直播选品登记员 发起/补正 → 直播选品审核主管 审核办理 →
          复核负责人 复核归档
        </p>
      </div>

      {error.value && (
        <div class="alert alert-error" onClick={() => (error.value = "")}>
          ❌ {error.value}
        </div>
      )}
      {success.value && (
        <div
          class="alert alert-success"
          style={{ whiteSpace: "pre-wrap" }}
          onClick={() => (success.value = "")}
        >
          ✅ {success.value}
        </div>
      )}

      <div class="toolbar">
        <div class="role-switcher">
          <label>当前角色：</label>
          <select value={currentUserId.value} onChange={handleRoleChange}>
            {users.value.map((u) => (
              <option value={u.id}>
                [{ROLE_LABELS[u.role]}] {u.name}
              </option>
            ))}
          </select>
        </div>

        {currentUser.value?.role === "registrar" && (
          <button class="btn btn-primary" onClick={() => (showCreateModal.value = true)}>
            ➕ 新建选品单
          </button>
        )}

        {selectedIds.value.length > 0 && currentUser.value?.role === "supervisor" && (
          <>
            <button class="btn btn-success btn-sm" onClick={() => batchAction("approve")}>
              ✅ 批量通过 ({selectedIds.value.length})
            </button>
            <button class="btn btn-danger btn-sm" onClick={() => batchAction("reject")}>
              🚫 批量退回 ({selectedIds.value.length})
            </button>
          </>
        )}

        {selectedIds.value.length > 0 && currentUser.value?.role === "reviewer" && (
          <button class="btn btn-primary btn-sm" onClick={() => batchAction("archive")}>
            📦 批量归档 ({selectedIds.value.length})
          </button>
        )}

        <div class="filter-group">
          <label>搜索：</label>
          <input
            type="text"
            placeholder="商品名/品牌/编号"
            value={keyword.value}
            onInput={(e: Event) =>
              (keyword.value = (e.target as HTMLInputElement).value)
            }
          />
          <label>视图：</label>
          <select
            value={statusFilter.value}
            onChange={(e: Event) =>
              (statusFilter.value = (e.target as HTMLSelectElement).value)
            }
          >
            <option value="all">📋 全部选品单</option>
            <option value="__exception__">🚨 异常工作台</option>
            <option value="draft">草稿</option>
            <option value="pending">待审核</option>
            <option value="missing_attachment">缺材料待补正</option>
            <option value="rejected">已退回</option>
            <option value="approved">审核通过</option>
            <option value="archived">已归档</option>
            <option value="timeout">超时</option>
          </select>
        </div>
      </div>

      {loading.value ? (
        <div class="empty">加载中...</div>
      ) : isExceptionView.value ? (
        renderExceptionWorkbench()
      ) : (
        renderNormalList()
      )}

      {showCreateModal.value && (
        <CreateSelectionModal
          userId={currentUserId.value}
          onClose={() => (showCreateModal.value = false)}
          onCreated={() => {
            showCreateModal.value = false;
            loadSelections();
          }}
          onError={(m) => (error.value = m)}
        />
      )}
    </div>
  );
}

function CreateSelectionModal(props: {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const form = useSignal({
    product_name: "",
    product_category: "美妆护肤",
    brand: "",
    supplier: "",
    estimated_price: 0,
    commission_rate: 0.2,
    description: "",
  });

  const submit = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createSelection(props.userId, form.value);
      props.onCreated();
    } catch (err: any) {
      props.onError(err.message);
    }
  };

  return (
    <div class="modal-backdrop" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>📝 新建直播选品单</h3>
          <button class="modal-close" onClick={props.onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div class="modal-body">
            <div class="grid-2">
              <div class="form-group">
                <label>
                  商品名称<span class="required">*</span>
                </label>
                <input
                  required
                  value={form.value.product_name}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      product_name: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>
              <div class="form-group">
                <label>商品分类</label>
                <select
                  value={form.value.product_category}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      product_category: (e.target as HTMLSelectElement).value,
                    })
                  }
                >
                  <option>美妆护肤</option>
                  <option>食品生鲜</option>
                  <option>服饰鞋包</option>
                  <option>数码家电</option>
                  <option>家居生活</option>
                  <option>母婴玩具</option>
                  <option>其他</option>
                </select>
              </div>
              <div class="form-group">
                <label>品牌</label>
                <input
                  value={form.value.brand}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      brand: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>
              <div class="form-group">
                <label>供应商</label>
                <input
                  value={form.value.supplier}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      supplier: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>
              <div class="form-group">
                <label>预估价格 (元)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.value.estimated_price}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      estimated_price: parseFloat(
                        (e.target as HTMLInputElement).value
                      ),
                    })
                  }
                />
              </div>
              <div class="form-group">
                <label>佣金比例 (0-1)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={form.value.commission_rate}
                  onInput={(e: Event) =>
                    (form.value = {
                      ...form.value,
                      commission_rate: parseFloat(
                        (e.target as HTMLInputElement).value
                      ),
                    })
                  }
                />
              </div>
            </div>
            <div class="form-group">
              <label>商品描述</label>
              <textarea
                value={form.value.description}
                onInput={(e: Event) =>
                  (form.value = {
                    ...form.value,
                    description: (e.target as HTMLTextAreaElement).value,
                  })
                }
              />
            </div>
            <div class="alert alert-info">
              💡 创建后请在详情页上传品牌授权书、质检报告等至少 2 份附件，再提交审核
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" onClick={props.onClose}>
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              保存草稿
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
