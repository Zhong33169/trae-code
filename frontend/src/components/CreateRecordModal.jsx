import { useState, useEffect } from 'preact/hooks'
import { api, todayStr } from '../utils/api.js'

export default function CreateRecordModal({ onClose, onCreated, defaultDate }) {
  const [children, setChildren] = useState([])
  const [formData, setFormData] = useState({
    child_id: '',
    check_date: defaultDate || todayStr(),
    temperature: '',
    mental_status: '',
    skin_condition: '',
    throat_condition: '',
    hand_foot_condition: '',
    other_symptoms: '',
    registration_note: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadChildren()
  }, [])

  const loadChildren = async () => {
    setLoading(true)
    try {
      const res = await api.getChildren({ pageSize: 100 })
      setChildren(res.list)
      if (res.list.length > 0 && !formData.child_id) {
        setFormData(f => ({ ...f, child_id: res.list[0].id }))
      }
    } catch (err) {
      alert(err.message || '加载幼儿列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.child_id) {
      alert('请选择幼儿')
      return
    }
    if (!formData.check_date) {
      alert('请选择检查日期')
      return
    }
    setSaving(true)
    try {
      await api.createRecord({
        child_id: parseInt(formData.child_id),
        check_date: formData.check_date,
        temperature: formData.temperature ? parseFloat(formData.temperature) : null,
        mental_status: formData.mental_status,
        skin_condition: formData.skin_condition,
        throat_condition: formData.throat_condition,
        hand_foot_condition: formData.hand_foot_condition,
        other_symptoms: formData.other_symptoms,
        registration_note: formData.registration_note,
      })
      alert('创建成功')
      onCreated?.()
    } catch (err) {
      alert(err.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h3>新建晨检记录</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {loading ? (
              <div className="empty">加载中...</div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-item">
                    <label>幼儿</label>
                    <select
                      value={formData.child_id}
                      onChange={(e) => setFormData({ ...formData, child_id: e.target.value })}
                    >
                      {children.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.class_name}）
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-item">
                    <label>检查日期</label>
                    <input
                      type="date"
                      value={formData.check_date}
                      onInput={(e) => setFormData({ ...formData, check_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>体温 (℃)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onInput={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      placeholder="如 36.5"
                    />
                  </div>
                  <div className="form-item">
                    <label>精神状态</label>
                    <select
                      value={formData.mental_status}
                      onChange={(e) => setFormData({ ...formData, mental_status: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="良好">良好</option>
                      <option value="一般">一般</option>
                      <option value="较差">较差</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>皮肤情况</label>
                    <select
                      value={formData.skin_condition}
                      onChange={(e) => setFormData({ ...formData, skin_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="皮疹">皮疹</option>
                      <option value="黄疸">黄疸</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-item">
                    <label>咽喉情况</label>
                    <select
                      value={formData.throat_condition}
                      onChange={(e) => setFormData({ ...formData, throat_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="红肿">红肿</option>
                      <option value="化脓">化脓</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-item">
                    <label>手足情况</label>
                    <select
                      value={formData.hand_foot_condition}
                      onChange={(e) => setFormData({ ...formData, hand_foot_condition: e.target.value })}
                    >
                      <option value="">请选择</option>
                      <option value="正常">正常</option>
                      <option value="疱疹">疱疹</option>
                      <option value="皮疹">皮疹</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-item">
                    <label>其他症状</label>
                    <input
                      type="text"
                      value={formData.other_symptoms}
                      onInput={(e) => setFormData({ ...formData, other_symptoms: e.target.value })}
                      placeholder="如有请描述"
                    />
                  </div>
                </div>
                <div className="form-item">
                  <label>登记备注</label>
                  <textarea
                    value={formData.registration_note}
                    onInput={(e) => setFormData({ ...formData, registration_note: e.target.value })}
                    placeholder="登记备注信息"
                  />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={saving || loading}>
              {saving ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
