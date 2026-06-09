import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStatusInfo, getAnomalyInfo } from '../utils/constants'

export default function OrderTable({ orders, selectedIds, onSelectionChange, currentRole, selectable = true }) {
  const navigate = useNavigate()

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectionChange(orders.map((o) => o.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (id, checked) => {
    if (checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter((i) => i !== id))
    }
  }

  const allSelected = orders.length > 0 && selectedIds.length === orders.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < orders.length

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="order-table-wrapper">
      <table className="order-table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            <th>订单编号</th>
            <th>批次号</th>
            <th>患者姓名</th>
            <th>状态</th>
            <th>线下状态</th>
            <th>异常标记</th>
            <th>登记人</th>
            <th>创建时间</th>
            <th style={{ width: 100 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={selectable ? 10 : 9} className="empty-row">
                暂无数据
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const statusInfo = getStatusInfo(order.status)
              const isSelected = selectedIds.includes(order.id)
              const isOverdue = order.is_overdue

              return (
                <tr
                  key={order.id}
                  className={`order-row ${isSelected ? 'selected' : ''} ${isOverdue ? 'overdue' : ''}`}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  {selectable && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                      />
                    </td>
                  )}
                  <td className="order-no">{order.order_no}</td>
                  <td>{order.batch_no}</td>
                  <td>{order.patient_name}</td>
                  <td>
                    <span
                      className="status-tag"
                      style={{ background: statusInfo.color + '20', color: statusInfo.color, borderColor: statusInfo.color }}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="offline-status">{order.offline_status_label}</td>
                  <td>
                    {order.anomaly_types && order.anomaly_types.length > 0 ? (
                      <div className="anomaly-tags">
                        {order.anomaly_types.map((type) => {
                          const a = getAnomalyInfo(type)
                          return (
                            <span
                              key={type}
                              className="anomaly-tag"
                              title={order.anomaly_remark}
                              style={{ background: a.color + '20', color: a.color, borderColor: a.color }}
                            >
                              {a.label}
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="no-anomaly">—</span>
                    )}
                  </td>
                  <td>{order.registered_by || '-'}</td>
                  <td>{formatDate(order.created_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="link-btn" onClick={() => navigate(`/orders/${order.id}`)}>
                      查看详情
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
