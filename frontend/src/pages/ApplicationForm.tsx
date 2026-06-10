import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { applicationApi } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { LeaseApplication } from '../types'
import { Loading, StatusBadge } from '../components/Common'

export default function ApplicationForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { showToast } = useToast()
  const isEdit = !!id
  const appId = Number(id)

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [origApp, setOrigApp] = useState<LeaseApplication | null>(null)
  const [form, setForm] = useState({
    tenantName: '',
    tenantIdCard: '',
    tenantPhone: '',
    apartmentName: '',
    roomNo: '',
    roomArea: 0,
    monthlyRent: 0,
    leaseStartDate: '',
    leaseEndDate: '',
    depositAmount: 0,
    paymentMethod: '押二付一',
    remark: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hasRole('registrar')) {
      showToast('只有租约登记员可以创建/编辑租约申请', 'error')
      navigate('/applications')
      return
    }
    if (isEdit) loadDetail()
  }, [id])

  async function loadDetail() {
    setLoading(true)
    try {
      const app = await applicationApi.getDetail(appId)
      if (app.status !== 'draft' && app.status !== 'returned') {
        showToast('只有草稿和已退回状态可以编辑', 'error')
        navigate(`/applications/${appId}`)
        return
      }
      setOrigApp(app)
      setForm({
        tenantName: app.tenantName,
        tenantIdCard: app.tenantIdCard,
        tenantPhone: app.tenantPhone,
        apartmentName: app.apartmentName,
        roomNo: app.roomNo,
        roomArea: app.roomArea,
        monthlyRent: app.monthlyRent,
        leaseStartDate: app.leaseStartDate,
        leaseEndDate: app.leaseEndDate,
        depositAmount: app.depositAmount,
        paymentMethod: app.paymentMethod || '押二付一',
        remark: app.remark || '',
      })
    } catch (err: any) {
      showToast(err.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.tenantName.trim()) e.tenantName = '请输入租客姓名'
    if (!form.tenantIdCard.trim()) e.tenantIdCard = '请输入身份证号'
    else if (!/^\d{17}[\dXx]$/.test(form.tenantIdCard.trim())) e.tenantIdCard = '身份证号格式不正确'
    if (!form.tenantPhone.trim()) e.tenantPhone = '请输入联系电话'
    else if (!/^1[3-9]\d{9}$/.test(form.tenantPhone.trim())) e.tenantPhone = '手机号格式不正确'
    if (!form.apartmentName.trim()) e.apartmentName = '请输入公寓名称'
    if (!form.roomNo.trim()) e.roomNo = '请输入房号'
    if (!form.monthlyRent || form.monthlyRent <= 0) e.monthlyRent = '请输入正确的月租金'
    if (!form.leaseStartDate) e.leaseStartDate = '请选择租期开始日期'
    if (!form.leaseEndDate) e.leaseEndDate = '请选择租期结束日期'
    if (form.leaseStartDate && form.leaseEndDate && form.leaseStartDate >= form.leaseEndDate) {
      e.leaseEndDate = '租期结束日期必须晚于开始日期'
    }
    if (!form.depositAmount || form.depositAmount < 0) e.depositAmount = '请输入押金金额'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      showToast('请检查并完善表单信息', 'warning')
      return
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        await applicationApi.update(appId, form)
        showToast('修改成功', 'success')
      } else {
        const res = await applicationApi.create(form)
        showToast('租约申请创建成功', 'success')
        if (confirm('是否立即提交审核？\n点击"确定"直接提交至审核环节，点击"取消"保存为草稿')) {
          await applicationApi.submit(res.id)
          showToast('已提交至审核环节', 'success')
        }
      }
      navigate('/applications')
    } catch (err: any) {
      showToast(err.message || (isEdit ? '修改失败' : '创建失败'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveAndSubmit() {
    if (!validate()) {
      showToast('请检查并完善表单信息', 'warning')
      return
    }
    setSubmitting(true)
    try {
      let targetId = appId
      if (!isEdit) {
        const res = await applicationApi.create(form)
        targetId = res.id
      } else {
        await applicationApi.update(appId, form)
      }
      await applicationApi.submit(targetId)
      showToast('租约申请已提交至审核环节', 'success')
      navigate(`/applications/${targetId}`)
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="center-loading"><Loading size="lg" /></div>

  return (
    <div>
      <div className="mb-16 flex items-center justify-between">
        <div>
          <button className="btn mr-12" onClick={() => navigate(-1)}>← 返回</button>
          <span style={{ fontSize: '18px', fontWeight: 600 }}>
            {isEdit ? '📝 编辑租约申请' : '➕ 新建租约申请'}
            {isEdit && origApp && (
              <span className="ml-12">
                <StatusBadge status={origApp.status} statusName={origApp.statusName} />
                <span className="ml-8" style={{ fontSize: '13px', color: '#6b7280' }}>{origApp.applicationNo}</span>
              </span>
            )}
          </span>
        </div>
      </div>

      {isEdit && origApp?.returnReason && (
        <div className="alert alert-warning mb-16">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>🔄 审核退回原因（请针对性补正）</div>
          <div>{origApp.returnReason}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">👤 租客信息</div>
          </div>
          <div className="card-body">
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label required">租客姓名</label>
                <input
                  type="text" className={`form-control ${errors.tenantName ? '' : ''}`}
                  value={form.tenantName}
                  onChange={e => setForm({ ...form, tenantName: e.target.value })}
                  placeholder="请输入租客姓名"
                />
                {errors.tenantName && <div className="form-error">{errors.tenantName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">身份证号</label>
                <input
                  type="text" className="form-control"
                  value={form.tenantIdCard}
                  onChange={e => setForm({ ...form, tenantIdCard: e.target.value.toUpperCase() })}
                  placeholder="18位身份证号"
                  maxLength={18}
                />
                {errors.tenantIdCard && <div className="form-error">{errors.tenantIdCard}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">联系电话</label>
                <input
                  type="tel" className="form-control"
                  value={form.tenantPhone}
                  onChange={e => setForm({ ...form, tenantPhone: e.target.value })}
                  placeholder="11位手机号"
                  maxLength={11}
                />
                {errors.tenantPhone && <div className="form-error">{errors.tenantPhone}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">🏠 房屋租赁信息</div>
          </div>
          <div className="card-body">
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label required">公寓名称</label>
                <input
                  type="text" className="form-control"
                  value={form.apartmentName}
                  onChange={e => setForm({ ...form, apartmentName: e.target.value })}
                  placeholder="例：幸福公寓"
                  list="apartment-list"
                />
                <datalist id="apartment-list">
                  <option value="幸福公寓" />
                  <option value="阳光公寓" />
                  <option value="和谐家园" />
                  <option value="美好家园" />
                  <option value="安居公寓" />
                </datalist>
                {errors.apartmentName && <div className="form-error">{errors.apartmentName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">房号</label>
                <input
                  type="text" className="form-control"
                  value={form.roomNo}
                  onChange={e => setForm({ ...form, roomNo: e.target.value })}
                  placeholder="例：A-1201"
                />
                {errors.roomNo && <div className="form-error">{errors.roomNo}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">建筑面积 (㎡)</label>
                <input
                  type="number" className="form-control" step="0.1" min="0"
                  value={form.roomArea || ''}
                  onChange={e => setForm({ ...form, roomArea: parseFloat(e.target.value) || 0 })}
                  placeholder="请输入面积"
                />
              </div>
              <div className="form-group">
                <label className="form-label required">月租金 (元)</label>
                <input
                  type="number" className="form-control" step="100" min="0"
                  value={form.monthlyRent || ''}
                  onChange={e => setForm({ ...form, monthlyRent: parseFloat(e.target.value) || 0 })}
                  placeholder="请输入月租金"
                />
                {errors.monthlyRent && <div className="form-error">{errors.monthlyRent}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">押金金额 (元)</label>
                <input
                  type="number" className="form-control" step="100" min="0"
                  value={form.depositAmount || ''}
                  onChange={e => setForm({ ...form, depositAmount: parseFloat(e.target.value) || 0 })}
                  placeholder="一般为2个月租金"
                />
                {errors.depositAmount && <div className="form-error">{errors.depositAmount}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">付款方式</label>
                <select className="form-control"
                  value={form.paymentMethod}
                  onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="押一付一">押一付一</option>
                  <option value="押二付一">押二付一</option>
                  <option value="押二付三">押二付三</option>
                  <option value="押一付三">押一付三</option>
                  <option value="年付">年付</option>
                  <option value="半年付">半年付</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required">租期开始</label>
                <input
                  type="date" className="form-control"
                  value={form.leaseStartDate}
                  onChange={e => setForm({ ...form, leaseStartDate: e.target.value })}
                />
                {errors.leaseStartDate && <div className="form-error">{errors.leaseStartDate}</div>}
              </div>
              <div className="form-group">
                <label className="form-label required">租期结束</label>
                <input
                  type="date" className="form-control"
                  value={form.leaseEndDate}
                  onChange={e => setForm({ ...form, leaseEndDate: e.target.value })}
                />
                {errors.leaseEndDate && <div className="form-error">{errors.leaseEndDate}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">快速设置租期</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { label: '3个月', months: 3 },
                    { label: '6个月', months: 6 },
                    { label: '1年', months: 12 },
                    { label: '2年', months: 24 },
                  ].map(opt => (
                    <button
                      type="button"
                      key={opt.months}
                      className="btn btn-sm"
                      onClick={() => {
                        if (!form.leaseStartDate) { showToast('请先选择开始日期', 'warning'); return }
                        const d = new Date(form.leaseStartDate)
                        d.setMonth(d.getMonth() + opt.months)
                        d.setDate(d.getDate() - 1)
                        const end = d.toISOString().slice(0, 10)
                        setForm({ ...form, leaseEndDate: end })
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-24">
          <div className="card-header">
            <div className="card-title">📝 备注说明</div>
          </div>
          <div className="card-body">
            <textarea
              className="form-control" rows={4}
              value={form.remark}
              onChange={e => setForm({ ...form, remark: e.target.value })}
              placeholder="请填写补充说明信息（如特殊约定、优惠条件等），可选"
            />
          </div>
        </div>

        <div className="card">
          <div className="card-footer" style={{ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/applications" className="btn">取消</Link>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <Loading size="sm" />}
                {submitting ? ' 处理中...' : isEdit ? '💾 保存修改' : '💾 保存为草稿'}
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={submitting}
                onClick={handleSaveAndSubmit}
              >
                {submitting && <Loading size="sm" />}
                {isEdit ? ' 💾 保存并提交审核' : '📤 创建并提交审核'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
