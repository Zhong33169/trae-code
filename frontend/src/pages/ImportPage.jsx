import { useState, useEffect } from 'react'
import { importApi } from '../api'
import { useAuth } from '../hooks/useAuth'

const statusLabels = {
  success: '成功',
  failed: '失败',
  conflict: '冲突',
  duplicate: '重复',
  pending: '处理中',
}

const ImportPage = () => {
  const { currentUser } = useAuth()
  const [source, setSource] = useState('offline_excel')
  const [batches, setBatches] = useState([])
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [batchRecords, setBatchRecords] = useState([])
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [activeTab, setActiveTab] = useState('import')

  const loadBatches = async () => {
    try {
      const data = await importApi.listBatches()
      setBatches(data)
    } catch (e) {
      console.error('加载批次失败', e)
    }
  }

  useEffect(() => {
    loadBatches()
  }, [])

  const handleViewBatch = async (batchId) => {
    try {
      const [batchData, recordsData] = await Promise.all([
        importApi.getBatch(batchId),
        importApi.listRecords(batchId),
      ])
      setSelectedBatch(batchData)
      setBatchRecords(recordsData)
    } catch (e) {
      alert(e.message || '加载批次详情失败')
    }
  }

  const generateSampleData = () => {
    const sample = [
      {
        ticket_no: 'OFF-TEST001',
        title: '测试导入-服务态度问题',
        content: '家政人员服务态度不好，要求换人。',
        complainant: '测试用户1',
        contact: '13800000001',
        priority: 'normal',
        status: 'pending_audit',
      },
      {
        ticket_no: 'TS202606001',
        title: '测试导入-已存在的工单',
        content: '这个工单号已经存在，应该提示重复。',
        complainant: '测试用户2',
        contact: '13800000002',
        priority: 'high',
        status: 'pending_audit',
      },
      {
        ticket_no: 'TS202606002',
        title: '测试导入-状态冲突',
        content: '线上状态是processing，线下状态是pending_audit，应该冲突。',
        complainant: '测试用户3',
        contact: '13800000003',
        priority: 'normal',
        status: 'pending_audit',
      },
      {
        ticket_no: 'OFF-TEST004',
        title: '测试导入-正常工单2',
        content: '保洁服务质量问题，需要重新安排。',
        complainant: '测试用户4',
        contact: '13800000004',
        priority: 'low',
        status: 'pending_audit',
      },
    ]
    setImportText(JSON.stringify(sample, null, 2))
  }

  const handleImport = async () => {
    if (!importText.trim()) {
      alert('请输入导入数据')
      return
    }

    let items
    try {
      items = JSON.parse(importText)
      if (!Array.isArray(items)) {
        throw new Error('数据格式错误，应为数组')
      }
    } catch (e) {
      alert(`JSON解析失败：${e.message}`)
      return
    }

    setImporting(true)
    setLastResult(null)
    try {
      const result = await importApi.importTickets({
        source,
        items,
      })
      setLastResult(result)
      loadBatches()
      alert(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`)
    } catch (e) {
      alert(e.message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN')
  }

  const canImport = currentUser?.role === 'registrar' || currentUser?.role === 'auditor'

  return (
    <div>
      <h2 className="page-title">离线台账回填</h2>

      <div className="tabs">
        <div
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          批量导入
        </div>
        <div
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          导入历史
        </div>
      </div>

      {activeTab === 'import' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">批量导入投诉工单</div>
          </div>
          <div className="card-body">
            {!canImport ? (
              <div className="empty">
                只有投诉登记员和审核主管可以进行离线台账回填。
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>数据来源</label>
                    <select value={source} onChange={e => setSource(e.target.value)}>
                      <option value="offline_excel">离线Excel</option>
                      <option value="phone_backup">电话记录补录</option>
                      <option value="paper_ticket">纸质工单补录</option>
                      <option value="other">其他来源</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    导入数据 (JSON格式)
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginLeft: 10 }}
                      onClick={generateSampleData}
                    >
                      生成示例数据
                    </button>
                  </label>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder='[{"ticket_no":"...","title":"...","content":"...","complainant":"...","contact":"...","priority":"normal","status":"pending_audit"}]'
                    rows={14}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? '导入中...' : '开始导入'}
                  </button>
                </div>

                {lastResult && (
                  <div className="import-result">
                    <div className="section-title" style={{ marginBottom: 12 }}>
                      导入结果
                    </div>
                    <div className="summary">
                      <div className="summary-item total">
                        <div className="num">{lastResult.total}</div>
                        <div style={{ color: '#666', fontSize: 13 }}>总计</div>
                      </div>
                      <div className="summary-item success">
                        <div className="num">{lastResult.success}</div>
                        <div style={{ color: '#666', fontSize: 13 }}>成功</div>
                      </div>
                      <div className="summary-item failed">
                        <div className="num">{lastResult.failed}</div>
                        <div style={{ color: '#666', fontSize: 13 }}>失败</div>
                      </div>
                    </div>
                    <div className="import-record-list">
                      {lastResult.records?.map(record => (
                        <div key={record.id} className="import-record">
                          <div>
                            <span style={{ fontFamily: 'monospace' }}>
                              {record.original_ticket_no}
                            </span>
                            {record.error_message && (
                              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                {record.error_message}
                              </div>
                            )}
                            {record.diff_detail && (
                              <div style={{ fontSize: 12, color: '#cc8f00', marginTop: 4 }}>
                                差异：{record.diff_detail}
                              </div>
                            )}
                          </div>
                          <span className={`status status-${record.status}`}>
                            {statusLabels[record.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 20,
                  padding: 12,
                  background: '#f8f9fa',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#666',
                }}>
                  <strong style={{ color: '#333' }}>说明：</strong>
                  <ul style={{ margin: '8px 0 0 20px', lineHeight: 1.8 }}>
                    <li><strong style={{ color: '#26a269' }}>成功</strong>：工单号不存在，正常导入</li>
                    <li><strong style={{ color: '#613583' }}>重复</strong>：工单号已存在且内容一致，不静默覆盖</li>
                    <li><strong style={{ color: '#e5a50a' }}>冲突</strong>：线上线下状态或内容不一致，不静默覆盖</li>
                    <li><strong style={{ color: '#e01b24' }}>失败</strong>：数据格式错误或其他问题</li>
                    <li>所有导入结果均会记录到审计日志，可追溯</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">导入批次历史</div>
          </div>
          <div className="card-body">
            {batches.length === 0 ? (
              <div className="empty">暂无导入记录</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>批次号</th>
                    <th>来源</th>
                    <th>总数</th>
                    <th>成功</th>
                    <th>失败</th>
                    <th>导入人</th>
                    <th>导入时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => (
                    <tr key={batch.id}>
                      <td style={{ fontFamily: 'monospace' }}>{batch.batch_no}</td>
                      <td>{batch.source}</td>
                      <td>{batch.total_count}</td>
                      <td style={{ color: '#26a269' }}>{batch.success_count}</td>
                      <td style={{ color: '#e01b24' }}>{batch.fail_count}</td>
                      <td>{batch.imported_by_name || '-'}</td>
                      <td>{formatDate(batch.imported_at)}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleViewBatch(batch.id)}
                        >
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedBatch && (
              <div className="modal-mask" onClick={() => { setSelectedBatch(null); setBatchRecords([]) }}>
                <div className="modal" style={{ minWidth: 640 }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <span>批次详情 - {selectedBatch.batch_no}</span>
                    <span className="modal-close" onClick={() => { setSelectedBatch(null); setBatchRecords([]) }}>×</span>
                  </div>
                  <div className="modal-body">
                    <div className="detail-grid" style={{ marginBottom: 16 }}>
                      <div className="label">批次号</div>
                      <div className="value">{selectedBatch.batch_no}</div>
                      <div className="label">来源</div>
                      <div className="value">{selectedBatch.source}</div>
                      <div className="label">总计/成功/失败</div>
                      <div className="value">
                        {selectedBatch.total_count} / 
                        <span style={{ color: '#26a269' }}> {selectedBatch.success_count} </span> / 
                        <span style={{ color: '#e01b24' }}> {selectedBatch.fail_count}</span>
                      </div>
                      <div className="label">导入人</div>
                      <div className="value">{selectedBatch.imported_by_name || '-'}</div>
                      <div className="label">导入时间</div>
                      <div className="value">{formatDate(selectedBatch.imported_at)}</div>
                    </div>
                    <div className="section-title">明细记录</div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {batchRecords.map(record => (
                        <div key={record.id} className="import-record">
                          <div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                              {record.original_ticket_no}
                            </span>
                            {record.error_message && (
                              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                {record.error_message}
                              </div>
                            )}
                            {record.diff_detail && (
                              <div style={{ fontSize: 12, color: '#cc8f00', marginTop: 4 }}>
                                差异：{record.diff_detail}
                              </div>
                            )}
                          </div>
                          <span className={`status status-${record.status}`}>
                            {statusLabels[record.status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn" onClick={() => { setSelectedBatch(null); setBatchRecords([]) }}>
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportPage
