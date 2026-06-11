import React from 'react'
import { STATUS_LABELS } from '../pages/Dashboard'

const STATUS_COLORS = {
  draft: '#888',
  pending_clerk: '#f59e0b',
  pending_foreman: '#3b82f6',
  pending_manager: '#8b5cf6',
  verified: '#10b981',
  rejected: '#ef4444',
  archived: '#6b7280'
}

export default function FormList({ forms, loading, selectedId, selectedIds, onSelect, onToggleSelect }) {
  if (loading) return <div className="loading small">加载队列...</div>
  if (forms.length === 0) return <div className="empty-list">暂无分包进场单</div>

  return (
    <div className="form-list">
      {forms.map((f) => {
        const isSelected = selectedId === f.id
        const isChecked = selectedIds.has(f.id)
        return (
          <div
            key={f.id}
            className={`form-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(f.id)}
          >
            <div className="form-card-header">
              <label
                className="checkbox"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleSelect(f)}
                />
              </label>
              <span className="form-code">{f.code}</span>
              <span
                className="status-badge"
                style={{ background: STATUS_COLORS[f.status] }}
              >
                {STATUS_LABELS[f.status]}
              </span>
            </div>
            <div className="form-card-body">
              <div className="form-subcontractor">{f.subcontractor_name}</div>
              <div className="form-meta">
                <span>{f.project_name}</span>
                <span>· {f.workers_count}人</span>
                <span>· v{f.version}</span>
              </div>
              <div className="form-content">{f.work_content}</div>
              {f.reject_reason && (
                <div className="reject-tag">
                  驳回原因：{f.reject_reason}
                </div>
              )}
            </div>
            <div className="form-card-footer">
              <span>进场：{new Date(f.entry_date).toLocaleDateString('zh-CN')}</span>
              <span>更新：{new Date(f.updated_at).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
