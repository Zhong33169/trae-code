import React, { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className={`modal modal-${size}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function StatusBadge({ status, statusName }: { status: string; statusName?: string }) {
  const map: Record<string, string> = {
    draft: 'badge-gray',
    pending_review: 'badge-blue',
    returned: 'badge-yellow',
    reviewed: 'badge-info',
    pending_confirm: 'badge-purple',
    room_confirmed: 'badge-orange',
    pending_handover: 'badge-info',
    completed: 'badge-green',
    rejected: 'badge-red',
  }
  const nameMap: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审核',
    returned: '已退回',
    reviewed: '审核通过',
    pending_confirm: '待房态确认',
    room_confirmed: '待复核归档',
    pending_handover: '待入住交接',
    completed: '已完成',
    rejected: '已拒绝',
  }
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{statusName || nameMap[status] || status}</span>
}

export function NodeBadge({ nodeType, nodeName }: { nodeType: string; nodeName?: string }) {
  const map: Record<string, string> = {
    contract_signing: 'badge-blue',
    review: 'badge-purple',
    room_confirm: 'badge-orange',
    handover: 'badge-info',
    archive: 'badge-green',
  }
  const nameMap: Record<string, string> = {
    contract_signing: '租客签约',
    review: '租约审核',
    room_confirm: '房态确认',
    handover: '入住交接',
    archive: '复核归档',
  }
  return <span className={`badge ${map[nodeType] || 'badge-gray'}`}>{nodeName || nameMap[nodeType] || nodeType}</span>
}

export function RoleBadge({ role, roleName }: { role: string; roleName?: string }) {
  const map: Record<string, string> = {
    registrar: 'badge-blue',
    auditor: 'badge-purple',
    reviewer: 'badge-green',
  }
  const nameMap: Record<string, string> = {
    registrar: '租约登记员',
    auditor: '租约审核主管',
    reviewer: '复核负责人',
  }
  return <span className={`badge ${map[role] || 'badge-gray'}`}>{roleName || nameMap[role] || role}</span>
}

interface PaginationProps {
  total: number
  page: number
  pageSize: number
  onChange: (page: number) => void
}

export function Pagination({ total, page, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, start + 4)

  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="pagination">
      <div className="page-info">
        共 <b>{total}</b> 条，第 <b>{page}</b> / {totalPages} 页
      </div>
      <div className="page-actions">
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(1)}>首页</button>
        <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
        {pages.map(p => (
          <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一页</button>
        <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(totalPages)}>末页</button>
      </div>
    </div>
  )
}

export function EmptyState({ text = '暂无数据' }: { text?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📋</div>
      <div className="empty-state-text">{text}</div>
    </div>
  )
}

export function Loading({ size = '' }: { size?: '' | 'sm' | 'lg' }) {
  return <div className={`loading ${size ? 'loading-' + size : ''}`} />
}

export function formatDate(d: string | Date | undefined, withTime = true): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return String(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (!withTime) return base
  return `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

export function getOverdueDays(dueTime?: string): number {
  if (!dueTime) return 0
  const diff = Date.now() - new Date(dueTime).getTime()
  if (diff <= 0) return 0
  return Math.ceil(diff / (24 * 3600 * 1000))
}
