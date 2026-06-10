import { useState, useEffect } from 'preact/hooks'
import { api, todayStr } from '../utils/api.js'

export default function Stats({ user }) {
  const [stats, setStats] = useState(null)
  const [checkDate, setCheckDate] = useState(todayStr())
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.getStats({ check_date: checkDate })
      setStats(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [checkDate])

  const statusItems = [
    { key: 'pending_registration', label: '待登记', color: 'primary', count: stats?.by_status?.pending_registration || 0 },
    { key: 'pending_correction', label: '待补正', color: 'danger', count: stats?.by_status?.pending_correction || 0 },
    { key: 'pending_audit', label: '待审核', color: 'warning', count: stats?.by_status?.pending_audit || 0 },
    { key: 'pending_review', label: '待复核', color: 'warning', count: stats?.by_status?.pending_review || 0 },
    { key: 'archived', label: '已归档', color: 'success', count: stats?.by_status?.archived || 0 },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>统计概览</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#606266' }}>日期：</span>
          <input
            type="date"
            value={checkDate}
            onInput={(e) => setCheckDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #dcdfe6', borderRadius: '4px' }}
          />
          <button className="btn btn-small" onClick={loadData}>刷新</button>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="card">加载中...</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card primary">
                <div className="stat-label">记录总数</div>
                <div className="stat-value">{stats?.total || 0}</div>
              </div>
              <div className="stat-card danger">
                <div className="stat-label">超时记录</div>
                <div className="stat-value">{stats?.timeout_count || 0}</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-label">我的待办</div>
                <div className="stat-value">{stats?.my_queue_count || 0}</div>
              </div>
              <div className="stat-card success">
                <div className="stat-label">已归档</div>
                <div className="stat-value">{stats?.by_status?.archived || 0}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>状态分布</h2>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {statusItems.map(item => (
                  <div
                    key={item.key}
                    className={`stat-card ${item.color}`}
                    style={{ flex: '1', minWidth: '120px', margin: '0' }}
                  >
                    <div className="stat-label">{item.label}</div>
                    <div className="stat-value">{item.count}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '160px', padding: '0 8px' }}>
                  {statusItems.map(item => {
                    const total = stats?.total || 1
                    const height = (item.count / total) * 140
                    return (
                      <div key={item.key} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', color: '#909399', marginBottom: '4px' }}>
                          {item.count}
                        </div>
                        <div
                          style={{
                            height: Math.max(2, height) + 'px',
                            background: item.color === 'primary' ? '#409eff' :
                                       item.color === 'success' ? '#67c23a' :
                                       item.color === 'warning' ? '#e6a23c' : '#f56c6c',
                            borderRadius: '4px 4px 0 0',
                            margin: '0 auto',
                            width: '40px',
                          }}
                        />
                        <div style={{ fontSize: '12px', color: '#606266', marginTop: '8px' }}>
                          {item.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>节点超时标准</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>节点名称</th>
                    <th>超时时间</th>
                    <th>责任角色</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>登记节点</td>
                    <td>30 分钟</td>
                    <td>晨检登记员</td>
                    <td>从创建记录到提交审核</td>
                  </tr>
                  <tr>
                    <td>审核节点</td>
                    <td>60 分钟</td>
                    <td>晨检审核主管</td>
                    <td>从提交审核到审核完成</td>
                  </tr>
                  <tr>
                    <td>复核节点</td>
                    <td>120 分钟</td>
                    <td>幼儿园复核负责人</td>
                    <td>从审核通过到复核归档</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
