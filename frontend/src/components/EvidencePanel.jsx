import React, { useState } from 'react'

const EVIDENCE_TYPE_LABELS = {
  registration: '登记资料',
  inspection: '过程核验',
  archive: '复核归档'
}

export default function EvidencePanel({ selectedForm, user, onUpload, onNotify }) {
  const [showUpload, setShowUpload] = useState(false)
  const [uploadType, setUploadType] = useState('registration')
  const [uploadName, setUploadName] = useState('')
  const [isSupplemental, setIsSupplemental] = useState(false)
  const [supplementNote, setSupplementNote] = useState('')
  const [filterType, setFilterType] = useState('all')

  if (!selectedForm) {
    return (
      <div className="evidence-panel">
        <h3>关键证据</h3>
        <div className="empty-small">请先选择分包进场单</div>
      </div>
    )
  }

  const evidences = selectedForm.evidences || []
  const supplements = selectedForm.supplements || []

  const filteredEvidences = filterType === 'all'
    ? evidences
    : evidences.filter((e) => e.type === filterType)

  const canUpload =
    (user.role === 'clerk' && ['draft', 'pending_clerk', 'rejected'].includes(selectedForm.form.status)) ||
    (user.role === 'foreman' && selectedForm.form.status === 'pending_foreman' && selectedForm.form.current_handler === user.id) ||
    (user.role === 'manager' && selectedForm.form.status === 'pending_manager' && selectedForm.form.current_handler === user.id)

  const handleSubmit = () => {
    if (!uploadName.trim()) {
      onNotify('请填写证据名称', 'error')
      return
    }
    if (isSupplemental && !supplementNote.trim()) {
      onNotify('补录证据必须填写原因', 'error')
      return
    }
    onUpload({
      form_id: selectedForm.form.id,
      type: uploadType,
      name: uploadName,
      is_supplemental: isSupplemental,
      supplement_note: supplementNote
    })
    setShowUpload(false)
    setUploadName('')
    setSupplementNote('')
    setIsSupplemental(false)
  }

  return (
    <div className="evidence-panel">
      <div className="panel-header">
        <h3>关键证据</h3>
        <div className="evidence-filters">
          <button
            className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >全部</button>
          {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => (
            <button
              key={k}
              className={`filter-tab ${filterType === k ? 'active' : ''}`}
              onClick={() => setFilterType(k)}
            >{v}</button>
          ))}
        </div>
      </div>

      {canUpload && (
        <button className="btn btn-sm btn-primary upload-btn" onClick={() => setShowUpload(true)}>
          + {isSupplemental ? '补录证据' : '上传证据'}
        </button>
      )}

      <div className="evidence-list">
        {filteredEvidences.length === 0 && (
          <div className="empty-small">暂无证据文件</div>
        )}
        {filteredEvidences.map((e) => (
          <div key={e.id} className={`evidence-item ${e.is_supplemental ? 'supplemental' : ''}`}>
            <div className="evidence-icon">📎</div>
            <div className="evidence-info">
              <div className="evidence-name">{e.name}</div>
              <div className="evidence-meta">
                <span className="evidence-type">{EVIDENCE_TYPE_LABELS[e.type]}</span>
                <span>上传于 {new Date(e.uploaded_at).toLocaleString('zh-CN')}</span>
              </div>
              {e.is_supplemental && (
                <div className="supplement-tag">
                  <span className="tag-label">补录</span>
                  {e.supplement_note && <span className="tag-note">{e.supplement_note}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {supplements.length > 0 && (
        <div className="supplement-history">
          <h4>补录 / 操作记录</h4>
          <div className="supplement-list">
            {supplements.slice(0, 10).map((s) => (
              <div key={s.id} className="supplement-item">
                <div className="supplement-action">{s.action}</div>
                <div className="supplement-meta">
                  {new Date(s.performed_at).toLocaleString('zh-CN')}
                </div>
                {s.reason && <div className="supplement-reason">{s.reason}</div>}
                {s.details && Object.keys(s.details).length > 0 && (
                  <div className="supplement-details">
                    {Object.entries(s.details).map(([k, v]) => (
                      <div key={k}><span className="detail-key">{k}:</span> {v}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>上传证据</h3>
            <div className="form-group">
              <label>证据类型</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="input"
              >
                {Object.entries(EVIDENCE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>证据名称</label>
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="例如：分包单位资质证书.pdf"
                className="input"
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={isSupplemental}
                  onChange={(e) => setIsSupplemental(e.target.checked)}
                />
                <span>标记为补录证据（流程中后补的材料）</span>
              </label>
            </div>
            {isSupplemental && (
              <div className="form-group">
                <label>补录原因 <span className="required">*</span></label>
                <textarea
                  value={supplementNote}
                  onChange={(e) => setSupplementNote(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="请说明补录原因（例如：驳回后补充特种作业证）"
                />
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-text" onClick={() => setShowUpload(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit}>确认上传</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
