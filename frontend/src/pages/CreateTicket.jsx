import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ticketApi } from '../api'
import { useAuth } from '../hooks/useAuth'

const CreateTicket = () => {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [form, setForm] = useState({
    title: '',
    content: '',
    complainant: '',
    contact: '',
    priority: 'normal',
    deadline: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      alert('请填写标题')
      return
    }
    if (!form.content.trim()) {
      alert('请填写投诉内容')
      return
    }
    if (!form.complainant.trim()) {
      alert('请填写投诉人')
      return
    }

    setSubmitting(true)
    try {
      const result = await ticketApi.create({
        title: form.title,
        content: form.content,
        complainant: form.complainant,
        contact: form.contact || undefined,
        priority: form.priority,
        deadline: form.deadline || undefined,
      })
      alert('工单创建成功！')
      navigate(`/tickets/${result.id}`)
    } catch (e) {
      alert(e.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (currentUser?.role !== 'registrar') {
    return (
      <div className="card">
        <div className="card-body">
          <div className="empty">
            只有投诉登记员可以新建工单，请切换角色后再试。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="page-title">新建投诉工单</h2>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>投诉标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleChange('title', e.target.value)}
                  placeholder="请简要描述投诉问题"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>投诉人 *</label>
                <input
                  type="text"
                  value={form.complainant}
                  onChange={e => handleChange('complainant', e.target.value)}
                  placeholder="请输入投诉人姓名"
                />
              </div>
              <div className="form-group">
                <label>联系方式</label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={e => handleChange('contact', e.target.value)}
                  placeholder="手机号或其他联系方式"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>优先级</label>
                <select
                  value={form.priority}
                  onChange={e => handleChange('priority', e.target.value)}
                >
                  <option value="low">低</option>
                  <option value="normal">普通</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              </div>
              <div className="form-group">
                <label>截止时间</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={e => handleChange('deadline', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>投诉内容 *</label>
              <textarea
                value={form.content}
                onChange={e => handleChange('content', e.target.value)}
                placeholder="请详细描述投诉内容..."
                rows={6}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => navigate(-1)}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? '提交中...' : '提交工单'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateTicket
