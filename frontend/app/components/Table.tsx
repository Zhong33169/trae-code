import React from "react";

export interface Column<T> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  render?: (record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
  ellipsis?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | ((record: T) => string);
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (record: T, index: number) => void;
  selectedRowKeys?: string[];
  onSelectChange?: (keys: string[], records: T[]) => void;
  selectable?: boolean;
  rowSelectionMode?: "checkbox" | "radio";
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  rowKey = "id",
  loading = false,
  emptyText = "暂无数据",
  onRowClick,
  selectedRowKeys = [],
  onSelectChange,
  selectable = false,
  rowSelectionMode = "checkbox",
}: TableProps<T>) {
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    return String(record[rowKey] ?? index);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = data.map((record, index) => getRowKey(record, index));
      onSelectChange?.(allKeys, [...data]);
    } else {
      onSelectChange?.([], []);
    }
  };

  const handleSelectRow = (record: T, index: number, checked: boolean) => {
    const key = getRowKey(record, index);
    if (rowSelectionMode === "radio") {
      onSelectChange?.(checked ? [key] : [], checked ? [record] : []);
    } else {
      if (checked) {
        const newKeys = [...selectedRowKeys, key];
        const newRecords = [...data.filter((r, i) => newKeys.includes(getRowKey(r, i)))];
        onSelectChange?.(newKeys, newRecords);
      } else {
        const newKeys = selectedRowKeys.filter((k) => k !== key);
        const newRecords = [...data.filter((r, i) => newKeys.includes(getRowKey(r, i)))];
        onSelectChange?.(newKeys, newRecords);
      }
    }
  };

  const allSelected = data.length > 0 && data.every((r, i) => selectedRowKeys.includes(getRowKey(r, i)));
  const someSelected = data.some((r, i) => selectedRowKeys.includes(getRowKey(r, i)));

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "#fff",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f9fafb" }}>
            {selectable && (
              <th
                style={{
                  padding: "12px",
                  textAlign: "left",
                  borderBottom: "1px solid #e5e7eb",
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#374151",
                  width: "50px",
                }}
              >
                <input
                  type={rowSelectionMode === "radio" ? "radio" : "checkbox"}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  style={{ cursor: "pointer" }}
                  disabled={loading}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "12px",
                  textAlign: col.align || "left",
                  borderBottom: "1px solid #e5e7eb",
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#374151",
                  width: col.width,
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#6b7280",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    width: "24px",
                    height: "24px",
                    border: "2px solid #e5e7eb",
                    borderTopColor: "#3b82f6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <div style={{ marginTop: "8px" }}>加载中...</div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "#9ca3af",
                }}
              >
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>📋</div>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((record, index) => {
              const key = getRowKey(record, index);
              const isSelected = selectedRowKeys.includes(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(record, index)}
                  style={{
                    backgroundColor: isSelected ? "#eff6ff" : "#fff",
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f9fafb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#fff";
                    }
                  }}
                >
                  {selectable && (
                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type={rowSelectionMode === "radio" ? "radio" : "checkbox"}
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(record, index, e.target.checked)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "12px",
                        textAlign: col.align || "left",
                        borderBottom: "1px solid #e5e7eb",
                        fontSize: "13px",
                        color: "#374151",
                        maxWidth: col.ellipsis ? "200px" : undefined,
                        overflow: col.ellipsis ? "hidden" : undefined,
                        textOverflow: col.ellipsis ? "ellipsis" : undefined,
                        whiteSpace: col.ellipsis ? "nowrap" : undefined,
                      }}
                    >
                      {col.render
                        ? col.render(record, index)
                        : col.dataIndex
                        ? record[col.dataIndex] ?? "-"
                        : "-"}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
