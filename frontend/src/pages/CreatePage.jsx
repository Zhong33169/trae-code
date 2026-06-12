import { createSignal } from 'solid-js'
import { useApi } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function CreatePage(props) {
  const api = useApi()
  const { currentUser } = useAuth()

  const [title, setTitle] = createSignal('')
  const [description, setDescription] = createSignal('')
  const [contactName, setContactName] = createSignal('')
  const [contactPhone, setContactPhone] = createSignal('')
  const [address, setAddress] = createSignal('')
  const [riskLevel, setRiskLevel] = createSignal('medium')
  const [dueDays, setDueDays] = createSignal(7)
  const [submitting, setSubmitting] = createSignal(false)

  const canCreate = currentUser().role === 'registrar'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canCreate) {
      alert('只有维修登记员可以创建工单')
      return
    }
    if (!title() || !description() || !contactName() || !contactPhone() || !address()) {
      alert('请填写所有必填字段')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.post('/orders', {
        title: title(),
        description: description(),
        contact_name: contactName(),
        contact_phone: contactPhone(),
        address: address(),
        risk_level: riskLevel(),
        due_days: dueDays(),
      })
      alert(`创建成功！工单号：${result.order_no}\n${result.message}`)
      props.onCreated()
    } catch (err) {
      alert('创建失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 class="page-title">新建维修工单</h2>

      <div class="detail-card">
        <Show when={!canCreate}>
          <div class="conflict-note" style="background: #fef2f2; border-color: #fca5a5; color: #991b1b;">
            ⚠️ 只有维修登记员可以创建工单，请切换角色。
          </div>
        </Show>

        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label>工单标题 *</label>
            <input
              value={title()}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入工单标题，如：电梯故障维修"
              disabled={!canCreate}
            />
          </div>

          <div class="form-group">
            <label>故障描述 *</label>
            <textarea
              value={description()}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述故障现象、位置等信息..."
              disabled={!canCreate}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>联系人 *</label>
              <input
                value={contactName()}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="报修人姓名"
                disabled={!canCreate}
              />
            </div>
            <div class="form-group">
              <label>联系电话 *</label>
              <input
                value={contactPhone()}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="联系电话"
                disabled={!canCreate}
              />
            </div>
          </div>

          <div class="form-group">
            <label>维修地址 *</label>
            <input
              value={address()}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="如：园区3号楼2单元"
              disabled={!canCreate}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>风险等级</label>
              <select
                value={riskLevel()}
                onChange={(e) => setRiskLevel(e.target.value)}
                disabled={!canCreate}
              >
                <option value="high">高风险（需要4份证据，优先级90）</option>
                <option value="medium">中风险（需要2份证据，优先级50）</option>
                <option value="low">低风险（需要1份证据，优先级20）</option>
              </select>
            </div>
            <div class="form-group">
              <label>处理期限（天）</label>
              <input
                type="number"
                min="1"
                max="30"
                value={dueDays()}
                onChange={(e) => setDueDays(parseInt(e.target.value) || 7)}
                disabled={!canCreate}
              />
            </div>
          </div>

          <div class="form-group">
            <label>说明</label>
            <div style="font-size: 0.85rem; color: #6b7280; background: #f9fafb; padding: 0.75rem; border-radius: 6px;">
              <p>• <strong>高风险</strong>：涉及人员安全、重大经济损失风险，需4份证据，优先级最高</p>
              <p>• <strong>中风险</strong>：普通维修任务，需2份证据，正常优先级</p>
              <p>• <strong>低风险</strong>：简单维修、维护任务，需1份证据，优先级较低</p>
              <p>• 逾期工单优先级自动 +30</p>
            </div>
          </div>

          <div class="action-buttons">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={!canCreate || submitting()}
            >
              {submitting() ? '提交中...' : '📝 提交工单'}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => props.onCreated()}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
