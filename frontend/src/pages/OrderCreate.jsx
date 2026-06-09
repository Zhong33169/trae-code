import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api'
import { OFFLINE_STATUS_OPTIONS, MATERIAL_ITEMS } from '../utils/constants'

export default function OrderCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    patient_name: '',
    patient_id_card: '',
    batch_no: '',
    lens_type: '',
    lens_power: '',
    frame_model: '',
    prescription_no: '',
    has_prescription: false,
    has_insurance: false,
    has_id_copy: false,
    has_receipt: false,
    offline_status: 'not_recorded',
  })
  const [message, setMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_name.trim()) {
      setMessage({ text: '请输入患者姓名', type: 'error' })
      return
    }
    if (!form.batch_no.trim()) {
      setMessage({ text: '请输入批次号', type: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createOrder(form)
      setMessage({ text: '创建成功', type: 'success' })
      setTimeout(() => {
        navigate(`/orders/${result.id}`)
      }, 1000)
    } catch (err) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="order-create-page">
      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="page-header">
        <div>
          <Link to="/" className="back-link">← 返回列表</Link>
          <h2>新建配镜订单</h2>
          <p className="page-desc">配镜登记员 - 新建离线台账订单</p>
        </div>
      </div>

      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h4>患者信息</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>患者姓名 *</label>
              <input
                type="text"
                value={form.patient_name}
                onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
                placeholder="请输入患者姓名"
              />
            </div>
            <div className="form-group">
              <label>身份证号</label>
              <input
                type="text"
                value={form.patient_id_card}
                onChange={(e) => setForm({ ...form, patient_id_card: e.target.value })}
                placeholder="请输入身份证号"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>订单信息</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>批次号 *</label>
              <input
                type="text"
                value={form.batch_no}
                onChange={(e) => setForm({ ...form, batch_no: e.target.value })}
                placeholder="例如：BATCH-2026-0601"
              />
            </div>
            <div className="form-group">
              <label>线下台账状态</label>
              <select
                value={form.offline_status}
                onChange={(e) => setForm({ ...form, offline_status: e.target.value })}
              >
                {OFFLINE_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>配镜信息</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>镜片类型</label>
              <input
                type="text"
                value={form.lens_type}
                onChange={(e) => setForm({ ...form, lens_type: e.target.value })}
                placeholder="例如：渐进多焦点"
              />
            </div>
            <div className="form-group">
              <label>镜片度数</label>
              <input
                type="text"
                value={form.lens_power}
                onChange={(e) => setForm({ ...form, lens_power: e.target.value })}
                placeholder="例如：右：-3.00DS"
              />
            </div>
            <div className="form-group">
              <label>镜架型号</label>
              <input
                type="text"
                value={form.frame_model}
                onChange={(e) => setForm({ ...form, frame_model: e.target.value })}
                placeholder="例如：雷朋 RB5154"
              />
            </div>
            <div className="form-group">
              <label>处方单号</label>
              <input
                type="text"
                value={form.prescription_no}
                onChange={(e) => setForm({ ...form, prescription_no: e.target.value })}
                placeholder="例如：CF20260528001"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>材料清单</h4>
          <div className="checkbox-group">
            {MATERIAL_ITEMS.map((item) => (
              <label key={item.key} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={form[item.key]}
                  onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '创建中...' : '创建订单'}
          </button>
        </div>
      </form>
    </div>
  )
}
