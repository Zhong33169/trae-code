import { useState, useEffect } from 'preact/hooks'
import { route } from 'preact-router'
import { api, formatDate, formatDateTime, formatDuration, todayStr } from '../utils/api.js'

export default function Dashboard({ user }) {
  const [records, setRecords] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkDate, setCheckDate] = useState(todayStr())

  const loadData = async () => {
    setLoading(true)
    try {
      const [recordsRes, statsRes] = await Promise.all([
        api.getRecords({ queue: '1', check_date: checkDate, pageSize: 50 }),
        api.getStats({ check_date: checkDate }),
      ])
      setRecords(recordsRes.list)
      setStats(statsRes)
    } catch (err) {
      console.error('加载失败', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [checkDate])

  const getQueueTitle = () => {
    if (user.role === 'registrar') return '登记/补正队列'
    if (user.role === 'auditor') return '审核队列'
    if (user.role === 'reviewer') return '复核队列'
    return '待办队列'
  }

  const getQueueDesc = () => {
    if (user.role === 'registrar') return '需要您发起登记或补正后重新提交的记录'
    if (user.role === 'auditor') return '等待您审核的晨检记录'
    if (user.role === 'reviewer') return '等待您复核归档的晨检记录'
    return ''
  }

  const canHandle = (record) => {
    if (user.role === 'registrar') {
      return record.status === 'pending_registration' || record.status === 'pending_correction'
    }
    if (user.role === 'auditor') {
      return record.status === 'pending_audit'
    }
    if (user.role === 'reviewer') {
      return record.status === 'pending_review'
    }
    return false
  }

  const getActionText = (record) => {
    if (user.role === 'registrar') {
      if (record.status === 'pending_registration') return '去登记'
      if (record.status === 'pending_correction') return '去补正'
    }
    if (user.role === 'auditor') return '去审核'
    if (user.role === 'reviewer') return '去复核'
    return '查看'
  }

  const getStatCards = () => {
    const cards = []
    cards.push({
      label: '我的待办',
      value: stats?.my_queue_count || 0,
      type: 'primary',
    })
    if (user.role === 'auditor' || user.role === 'reviewer') {
      cards.push({
        label: '超时记录',
        value: stats?.timeout_count || 0,
        type: 'danger',
      })
    }
    cards.push({
      label: '今日总数',
      value: stats?.total || 0,
      type: 'warning',
    })
    cards.push({
      label: '已归档',
      value: stats?.by_status?.archived || 0,
      type: 'success',
    })
    return cards
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="card">加载中...</div>
      </div>
    )
  }

  const statCards = getStatCards()

  return (
    <div>
      <div className="page-header">
        <h1>工作台</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#606266' }}>检查日期：</span>
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
        <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${statCards.length}, 1fr)` }}>
          {statCards.map((card, idx) => (
            <div key={idx} className={`stat-card ${card.type}`}>
              <div className="stat-label">{card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>
              {getQueueTitle()}
              {stats && stats.my_queue_count > 0 && (
                <span className="badge">{stats.my_queue_count}</span>
              )}
            </h2>
            <span style={{ fontSize: '12px', color: '#909399' }}>{getQueueDesc()}</span>
          </div>

          {records.length === 0 ? (
            <div className="empty">暂无待办记录 🎉</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>幼儿姓名</th>
                  <th>班级</th>
                  <th>检查日期</th>
                  <th>状态</th>
                  <th>当前节点</th>
                  {user.role !== 'registrar' && <th>体温</th>}
                  <th>超时情况</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id}>
                    <td>{record.child_name}</td>
                    <td>{record.class_name}</td>
                    <td>{record.check_date}</td>
                    <td>
                      <span className={`status-tag status-${record.status}`}>
                        {record.status_name}
                      </span>
                    </td>
                    <td>{record.current_node_name}</td>
                    {user.role !== 'registrar' && (
                      <td>{record.temperature ? record.temperature + '℃' : '-'}</td>
                    )}
                    <td>
                      {record.timeout?.isTimeout ? (
                        <span className="timeout-tag">
                          已超时 {formatDuration(record.timeout.overdueMs)}
                        </span>
                      ) : (
                        <span className="timeout-tag normal">
                          剩余 {formatDuration(record.timeout?.remainingMs || 0)}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn btn-small ${canHandle(record) ? 'btn-primary' : ''}`}
                        onClick={() => route(`/records/${record.id}`)}
                      >
                        {getActionText(record)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>快速操作</h2>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {user.role === 'registrar' && (
              <>
                <button className="btn btn-primary" onClick={() => route('/records')}>
                  晨检记录管理
                </button>
                <button className="btn" onClick={() => route('/children')}>
                  幼儿档案管理
                </button>
              </>
            )}
            {user.role === 'auditor' && (
              <>
                <button className="btn btn-primary" onClick={() => route('/records')}>
                  审核记录管理
                </button>
                <button className="btn" onClick={() => route('/stats')}>
                  数据统计
                </button>
                <button className="btn" onClick={() => route('/logs')}>
                  操作日志
                </button>
              </>
            )}
            {user.role === 'reviewer' && (
              <>
                <button className="btn btn-primary" onClick={() => route('/records')}>
                  复核记录管理
                </button>
                <button className="btn" onClick={() => route('/children')}>
                  幼儿档案管理
                </button>
                <button className="btn" onClick={() => route('/stats')}>
                  数据统计
                </button>
                <button className="btn" onClick={() => route('/logs')}>
                  操作日志
                </button>
              </>
            )}
          </div>
        </div>

        {user.role !== 'registrar' && stats && (
          <div className="card">
            <div className="card-header">
              <h2>状态分布</h2>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {Object.entries(stats.by_status_names || {}).map(([name, count]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#909399', fontSize: '13px' }}>{name}：</span>
                  <span style={{ fontWeight: 600, fontSize: '16px', color: '#303133' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
