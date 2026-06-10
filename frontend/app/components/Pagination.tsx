import React from "react";

interface PaginationProps {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
  showSizeChanger?: boolean;
  pageSizeOptions?: number[];
  showQuickJumper?: boolean;
}

export function Pagination({
  current,
  pageSize,
  total,
  onChange,
  showSizeChanger = false,
  pageSizeOptions = [10, 20, 50, 100],
  showQuickJumper = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (current - 1) * pageSize + 1;
  const endIndex = Math.min(current * pageSize, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (current >= totalPages - 2) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", current - 1, current, current + 1, "...", totalPages);
      }
    }

    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page !== current && page >= 1 && page <= totalPages) {
      onChange(page, pageSize);
    }
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(1, parseInt(e.target.value));
  };

  const handleQuickJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        onChange(value, pageSize);
      }
      (e.target as HTMLInputElement).value = "";
    }
  };

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    minWidth: "32px",
    height: "32px",
    padding: "0 8px",
    border: `1px solid ${active ? "#3b82f6" : "#d1d5db"}`,
    backgroundColor: active ? "#3b82f6" : "#fff",
    color: active ? "#fff" : "#374151",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px",
        backgroundColor: "#fff",
        borderTop: "1px solid #e5e7eb",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "13px", color: "#6b7280" }}>
        共 <span style={{ color: "#374151", fontWeight: 600 }}>{total}</span> 条，
        第 <span style={{ color: "#374151", fontWeight: 600 }}>{startIndex}</span>-
        <span style={{ color: "#374151", fontWeight: 600 }}>{endIndex}</span> 条
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={() => handlePageClick(current - 1)}
          disabled={current === 1}
          style={{
            ...buttonStyle(false),
            opacity: current === 1 ? 0.5 : 1,
            cursor: current === 1 ? "not-allowed" : "pointer",
          }}
        >
          上一页
        </button>

        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {typeof page === "number" ? (
              <button
                onClick={() => handlePageClick(page)}
                style={buttonStyle(page === current)}
              >
                {page}
              </button>
            ) : (
              <span style={{ padding: "0 4px", color: "#9ca3af" }}>{page}</span>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => handlePageClick(current + 1)}
          disabled={current === totalPages}
          style={{
            ...buttonStyle(false),
            opacity: current === totalPages ? 0.5 : 1,
            cursor: current === totalPages ? "not-allowed" : "pointer",
          }}
        >
          下一页
        </button>

        {showSizeChanger && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>每页</span>
            <select
              value={pageSize}
              onChange={handleSizeChange}
              style={{
                height: "32px",
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "13px",
                backgroundColor: "#fff",
                cursor: "pointer",
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>条</span>
          </div>
        )}

        {showQuickJumper && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>跳至</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              onKeyDown={handleQuickJump}
              placeholder={String(totalPages)}
              style={{
                width: "60px",
                height: "32px",
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "13px",
                textAlign: "center",
              }}
            />
            <span style={{ fontSize: "13px", color: "#6b7280" }}>页</span>
          </div>
        )}
      </div>
    </div>
  );
}
