import React, { useState, useEffect } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useToast } from "~/hooks/useToast";
import { formatDate, debounce } from "~/utils/helpers";
import { StatusBadge } from "~/components/StatusBadge";
import { Table } from "~/components/Table";
import { Pagination } from "~/components/Pagination";
import { getChargingPiles, type ChargingPile } from "~/services/inspection";

export default function PilesPage() {
  const { user, loading: authLoading } = useAuth();
  const { success, error, warning, info } = useToast();

  const [piles, setPiles] = useState<ChargingPile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    keyword: "",
    is_active: "",
  });

  const [selectedPile, setSelectedPile] = useState<ChargingPile | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadPiles();
  }, [page, pageSize, filters]);

  const debouncedSearch = React.useCallback(
    debounce((value: string) => {
      setFilters((prev) => ({ ...prev, keyword: value }));
      setPage(1);
    }, 300),
    []
  );

  async function loadPiles() {
    try {
      setLoading(true);
      const params: any = {
        page,
        page_size: pageSize,
      };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.is_active !== "")
        params.is_active = filters.is_active === "true";

      const response = await getChargingPiles(params);
      setPiles(response.items);
      setTotal(response.total);
    } catch (err: any) {
      error("加载充电桩列表失败：" + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleResetFilters() {
    setFilters({
      keyword: "",
      is_active: "",
    });
    setPage(1);
  }

  function handleViewDetail(pile: ChargingPile) {
    setSelectedPile(pile);
    setShowDetail(true);
  }

  function handleCreateInspection(pile: ChargingPile) {
    const url = `/inspections/new?pile_id=${pile.id}`;
    window.open(url, "_blank");
  }

  const columns = [
    {
      key: "id",
      title: "ID",
      width: 60,
    },
    {
      key: "pile_code",
      title: "充电桩编号",
      render: (record: ChargingPile) => (
        <span style={{ fontFamily: "monospace", fontWeight: 500, color: "#111827" }}>
          {record.pile_code}
        </span>
      ),
    },
    {
      key: "pile_name",
      title: "充电桩名称",
      render: (record: ChargingPile) => (
        <div>
          <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>
            {record.pile_name}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {record.location || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "station",
      title: "所属充电站",
      render: (record: ChargingPile) => (
        <div>
          <div style={{ fontSize: 14, color: "#111827" }}>
            {record.station_name}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
            {record.station_code}
          </div>
        </div>
      ),
    },
    {
      key: "power_rating",
      title: "功率",
      render: (record: ChargingPile) => record.power_rating || "-",
    },
    {
      key: "qr_code",
      title: "二维码",
      render: (record: ChargingPile) => (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "#6b7280",
            backgroundColor: "#f3f4f6",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {record.qr_code}
        </span>
      ),
    },
    {
      key: "is_active",
      title: "状态",
      render: (record: ChargingPile) => (
        <StatusBadge
          status={record.is_active ? "archived" : "cancelled"}
          label={record.is_active ? "启用" : "停用"}
        />
      ),
    },
    {
      key: "last_inspection_at",
      title: "上次巡检",
      render: (record: ChargingPile) =>
        record.last_inspection_at ? (
          <div>
            <div style={{ fontSize: 13, color: "#374151" }}>
              {formatDate(record.last_inspection_at)}
            </div>
          </div>
        ) : (
          <span style={{ color: "#9ca3af" }}>未巡检</span>
        ),
    },
    {
      key: "actions",
      title: "操作",
      width: 150,
      render: (record: ChargingPile) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={styles.actionButton}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </button>
          <button
            style={{ ...styles.actionButton, backgroundColor: "#eff6ff", color: "#3b82f6" }}
            onClick={() => handleCreateInspection(record)}
          >
            创建巡检
          </button>
        </div>
      ),
    },
  ];

  const activeCount = piles.filter((p) => p.is_active).length;
  const inactiveCount = piles.filter((p) => !p.is_active).length;

  if (authLoading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: 16, color: "#6b7280" }}>加载中...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>充电桩管理</h1>
          <p style={styles.subtitle}>查看和管理所有充电桩信息</p>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statItem}>
          <div style={styles.statIcon}>🔌</div>
          <div>
            <div style={styles.statValue}>{total}</div>
            <div style={styles.statLabel}>充电桩总数</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, color: "#10b981" }}>✓</div>
          <div>
            <div style={{ ...styles.statValue, color: "#10b981" }}>{activeCount}</div>
            <div style={styles.statLabel}>启用中</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statIcon, color: "#6b7280" }}>○</div>
          <div>
            <div style={{ ...styles.statValue, color: "#6b7280" }}>{inactiveCount}</div>
            <div style={styles.statLabel}>已停用</div>
          </div>
        </div>
        <div style={styles.statItem}>
          <div style={styles.statIcon}>📅</div>
          <div>
            <div style={styles.statValue}>
              {piles.filter((p) => p.last_inspection_at).length}
            </div>
            <div style={styles.statLabel}>已巡检</div>
          </div>
        </div>
      </div>

      <div style={styles.filtersSection}>
        <div style={styles.filtersRow}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>关键词搜索</label>
            <input
              type="text"
              style={styles.filterInput}
              placeholder="搜索编号、名称、充电站..."
              defaultValue={filters.keyword}
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>状态</label>
            <select
              style={styles.filterSelect}
              value={filters.is_active}
              onChange={(e) => handleFilterChange("is_active", e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="true">启用</option>
              <option value="false">停用</option>
            </select>
          </div>
          <div style={styles.filterActions}>
            <button style={styles.resetButton} onClick={handleResetFilters}>
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <div style={styles.tableSection}>
        <Table
          columns={columns}
          data={piles}
          loading={loading}
          rowKey="id"
          emptyText="暂无充电桩数据"
          onRowClick={(record) => handleViewDetail(record)}
        />
        <div style={styles.paginationWrapper}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={(newPage, newPageSize) => {
              setPage(newPage);
              setPageSize(newPageSize);
            }}
          />
        </div>
      </div>

      {showDetail && selectedPile && (
        <div style={styles.modalOverlay} onClick={() => setShowDetail(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>充电桩详情</h3>
              <button
                style={styles.closeButton}
                onClick={() => setShowDetail(false)}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailSection}>
                <div style={styles.detailHeader}>
                  <div style={styles.detailTitle}>
                    {selectedPile.pile_name}
                  </div>
                  <StatusBadge
                    status={selectedPile.is_active ? "archived" : "cancelled"}
                    label={selectedPile.is_active ? "启用" : "停用"}
                  />
                </div>
                <div style={styles.detailCode}>
                  编号：{selectedPile.pile_code}
                </div>
              </div>

              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>充电站</span>
                  <span style={styles.detailValue}>
                    {selectedPile.station_name}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>充电站编号</span>
                  <span style={styles.detailValue}>
                    {selectedPile.station_code}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>位置</span>
                  <span style={styles.detailValue}>
                    {selectedPile.location || "-"}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>功率</span>
                  <span style={styles.detailValue}>
                    {selectedPile.power_rating || "-"}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>二维码内容</span>
                  <span style={styles.detailValueCode}>
                    {selectedPile.qr_code}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>上次巡检</span>
                  <span style={styles.detailValue}>
                    {selectedPile.last_inspection_at
                      ? formatDate(selectedPile.last_inspection_at)
                      : "未巡检"}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>创建时间</span>
                  <span style={styles.detailValue}>
                    {formatDate(selectedPile.created_at)}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>更新时间</span>
                  <span style={styles.detailValue}>
                    {selectedPile.updated_at
                      ? formatDate(selectedPile.updated_at)
                      : "-"}
                  </span>
                </div>
              </div>

              <div style={styles.qrSection}>
                <div style={styles.qrTitle}>二维码</div>
                <div style={styles.qrCode}>
                  <div style={styles.qrPlaceholder}>
                    <svg
                      width="120"
                      height="120"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="1"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3h-3z" />
                      <path d="M20 14v3" />
                      <path d="M14 20h3" />
                      <path d="M12 8h1" />
                      <path d="M12 10h1" />
                      <path d="M8 12h1" />
                      <path d="M10 12h1" />
                      <path d="M12 12h1" />
                      <path d="M16 12h1" />
                      <path d="M18 12h1" />
                    </svg>
                  </div>
                </div>
                <div style={styles.qrText}>{selectedPile.qr_code}</div>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowDetail(false)}
              >
                关闭
              </button>
              <button
                style={styles.primaryButton}
                onClick={() => handleCreateInspection(selectedPile)}
              >
                创建巡检单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 24,
    maxWidth: 1400,
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
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  statItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  statIcon: {
    fontSize: 28,
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 600,
    color: "#111827",
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  filtersSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  filtersRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap" as const,
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 200,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  filterInput: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
  },
  filterSelect: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    outline: "none",
    backgroundColor: "#fff",
  },
  filterActions: {
    display: "flex",
    gap: 8,
  },
  resetButton: {
    padding: "8px 16px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    color: "#374151",
    fontSize: 14,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tableSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  paginationWrapper: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
  actionButton: {
    padding: "4px 12px",
    border: "none",
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
    color: "#374151",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    animation: "fadeIn 0.2s ease-out",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "90%",
    maxWidth: 600,
    maxHeight: "85vh",
    overflow: "auto",
    animation: "slideInUp 0.3s ease-out",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
    margin: 0,
  },
  closeButton: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: "50%",
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  modalBody: {
    padding: 24,
  },
  detailSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottom: "1px solid #e5e7eb",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#111827",
  },
  detailCode: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  detailItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: 500,
  },
  detailValueCode: {
    fontSize: 13,
    color: "#111827",
    fontWeight: 500,
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    padding: "4px 8px",
    borderRadius: 4,
    display: "inline-block",
  },
  qrSection: {
    textAlign: "center" as const,
    padding: 20,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  qrTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 12,
  },
  qrCode: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 140,
    height: 140,
    backgroundColor: "#fff",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #e5e7eb",
  },
  qrText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
    wordBreak: "break-all" as const,
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "16px 24px",
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
  primaryButton: {
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
