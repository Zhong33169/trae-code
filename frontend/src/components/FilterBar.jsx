import { useState } from 'react'
import { STATUS_OPTIONS, ANOMALY_OPTIONS } from '../utils/constants'

export default function FilterBar({ filters, onFilterChange, onReset, currentRole }) {
  const [searchText, setSearchText] = useState(filters.search || '')

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchText(value)
    if (!value) {
      onFilterChange({ ...filters, search: '' })
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      onFilterChange({ ...filters, search: searchText })
    }
  }

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label>搜索：</label>
        <input
          type="text"
          placeholder="订单号/批次号/患者姓名"
          value={searchText}
          onChange={handleSearch}
          onKeyDown={handleSearchKeyDown}
          className="filter-input"
        />
      </div>

      <div className="filter-group">
        <label>状态：</label>
        <select
          value={filters.status || ''}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          className="filter-select"
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>异常类型：</label>
        <select
          value={filters.anomaly_type || ''}
          onChange={(e) => onFilterChange({ ...filters, anomaly_type: e.target.value })}
          className="filter-select"
        >
          <option value="">全部异常</option>
          {ANOMALY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>超时：</label>
        <select
          value={filters.is_overdue ?? ''}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              is_overdue: e.target.value === '' ? '' : e.target.value === 'true',
            })
          }
          className="filter-select"
        >
          <option value="">全部</option>
          <option value="true">已超时</option>
          <option value="false">未超时</option>
        </select>
      </div>

      <button className="btn btn-secondary" onClick={onReset}>
        重置筛选
      </button>
    </div>
  )
}
