import React, { useState } from 'react'
import { api } from '../api'

export default function CreateFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    subcontractor_name: '',
    project_name: '',
    entry_date: new Date().toISOString().slice(0, 10),
    workers_count: 10,
    work_content: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.subcontractor_name.trim()) return setError('请填写分包单位名称')
    if (!form.project_name.trim()) return setError('请填写项目名称')
    if (!form.work_content.trim()) return setError('请填写施工内容')
    if (!form.workers_count || form.workers_count <= 0) return setError('进场人数必须大于0')

    setLoading(true)
    try {
      await api.createForm(form)
      onCreated()
    } catch (err) {
      setError(err.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  const update = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>新建分包进场单（资料员）</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>分包单位名称 <span className="required">*</span></label>
            <input
              type="text"
              className="input"
              value={form.subcontractor_name}
              onChange={(e) => update('subcontractor_name', e.target.value)}
              placeholder="例如：安徽宏建劳务有限公司"
            />
          </div>
          <div className="form-group">
            <label>项目名称 <span className="required">*</span></label>
            <input
              type="text"
              className="input"
              value={form.project_name}
              onChange={(e) => update('project_name', e.target.value)}
              placeholder="例如：中央商务区A座"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>进场日期</label>
              <input
                type="date"
                className="input"
                value={form.entry_date}
                onChange={(e) => update('entry_date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>进场人数 <span className="required">*</span></label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.workers_count}
                onChange={(e) => update('workers_count', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>施工内容 <span className="required">*</span></label>
            <textarea
              rows={3}
              className="input"
              value={form.work_content}
              onChange={(e) => update('work_content', e.target.value)}
              placeholder="例如：主体结构钢筋绑扎"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-text" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '创建中...' : '创建草稿'}
            </button>
          </div>
        </form>
        <div className="tip">创建后为草稿状态，上传登记资料后可提交至施工负责人核验。</div>
      </div>
    </div>
  )
}
