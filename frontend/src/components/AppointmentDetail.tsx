import { useState } from 'react'
import { XCircle, Clock, AlertTriangle, Edit, FileCheck, CheckCircle, ListOrdered } from 'lucide-react'
import { useStore } from '@/store'
import type { AppointmentStatus, EvidenceType } from '@/types'

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_review: '待审核',
  pending_archive: '待归档',
  rejected_for_correction: '退回补正',
  rejected_for_review: '退回审核',
  archived: '已归档',
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending_review: 'bg-blue-100 text-blue-700',
  pending_archive: 'bg-green-100 text-green-700',
  rejected_for_correction: 'bg-orange-100 text-orange-700',
  rejected_for_review: 'bg-orange-100 text-orange-700',
  archived: 'bg-gray-100 text-gray-500',
}

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  reservation: '观众预约',
  check_in: '入场核销',
  data_recovery: '数据回收',
}

export default function AppointmentDetail() {
  const currentAppointment = useStore((s) => s.currentAppointment)
  const clearCurrentAppointment = useStore((s) => s.clearCurrentAppointment)
  const user = useStore((s) => s.user)
  const correctAppointment = useStore((s) => s.correctAppointment)
  const reviewAppointment = useStore((s) => s.reviewAppointment)
  const archiveAppointment = useStore((s) => s.archiveAppointment)
  const addEvidence = useStore((s) => s.addEvidence)
  const loadAppointmentDetail = useStore((s) => s.loadAppointmentDetail)
  const openBatchDetail = useStore((s) => s.openBatchDetail)

  const [correcting, setCorrecting] = useState(false)
  const [correctForm, setCorrectForm] = useState({ visitor_name: '', visitor_phone: '', visitor_id_number: '', exhibition_name: '' })
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState<{ type: EvidenceType; content: string }>({ type: 'reservation', content: '' })
  const [operating, setOperating] = useState(false)

  if (!currentAppointment) return null

  const apt = currentAppointment

  const startCorrect = () => {
    setCorrectForm({
      visitor_name: apt.visitor_name,
      visitor_phone: apt.visitor_phone,
      visitor_id_number: apt.visitor_id_number,
      exhibition_name: apt.exhibition_name,
    })
    setCorrecting(true)
  }

  const handleCorrect = async () => {
    if (operating) return
    setOperating(true)
    const ok = await correctAppointment(apt.id, { ...correctForm, version: apt.version })
    setOperating(false)
    if (ok) setCorrecting(false)
  }

  const handleReview = async (action: 'approve' | 'reject') => {
    if (operating) return
    setOperating(true)
    await reviewAppointment(apt.id, action, apt.version)
    setOperating(false)
  }

  const handleArchive = async (action: 'archive' | 'reject') => {
    if (operating) return
    setOperating(true)
    await archiveAppointment(apt.id, action, apt.version)
    setOperating(false)
  }

  const handleAddEvidence = async () => {
    if (operating) return
    setOperating(true)
    const ok = await addEvidence(apt.id, evidenceForm.type, evidenceForm.content)
    setOperating(false)
    if (ok) {
      setAddingEvidence(false)
      setEvidenceForm({ type: 'reservation', content: '' })
    }
  }

  const role = user?.role
  const evidenceTypes: EvidenceType[] = ['reservation', 'check_in', 'data_recovery']

  const canCorrect = role === 'registrar' && apt.status === 'rejected_for_correction'
  const canApprove = role === 'reviewer' && apt.status === 'pending_review'
  const canArchive = role === 'archivist' && apt.status === 'pending_archive'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-navy">预约单详情</h2>
            <span className="text-sm text-gray-400">#{apt.id.slice(0, 8)}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
              {STATUS_LABELS[apt.status]}
            </span>
            <span className="text-xs text-gray-400">v{apt.version}</span>
          </div>
          <button onClick={clearCurrentAppointment} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 表单字段 */}
          <section>
            <h3 className="text-sm font-semibold text-navy mb-3">基本信息</h3>
            {correcting ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">访客姓名</label>
                  <input value={correctForm.visitor_name} onChange={(e) => setCorrectForm({ ...correctForm, visitor_name: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">手机号</label>
                  <input value={correctForm.visitor_phone} onChange={(e) => setCorrectForm({ ...correctForm, visitor_phone: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">身份证号</label>
                  <input value={correctForm.visitor_id_number} onChange={(e) => setCorrectForm({ ...correctForm, visitor_id_number: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">展会名称</label>
                  <input value={correctForm.exhibition_name} onChange={(e) => setCorrectForm({ ...correctForm, exhibition_name: e.target.value })} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">访客姓名</span><p className="font-medium text-navy">{apt.visitor_name}</p></div>
                <div><span className="text-gray-400">手机号</span><p className="font-medium text-navy">{apt.visitor_phone}</p></div>
                <div><span className="text-gray-400">身份证号</span><p className="font-medium text-navy">{apt.visitor_id_number}</p></div>
                <div><span className="text-gray-400">展会名称</span><p className="font-medium text-navy">{apt.exhibition_name}</p></div>
              </div>
            )}
          </section>

          {/* 证据面板 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-navy">证据</h3>
              {role === 'registrar' && (
                <button
                  onClick={() => setAddingEvidence(true)}
                  className="text-xs text-amber hover:text-amber/80 transition-colors"
                >
                  + 添加证据
                </button>
              )}
            </div>
            <div className="space-y-2">
              {evidenceTypes.map((type) => {
                const list = apt.evidence[type] || []
                const isEmpty = list.length === 0
                return (
                  <div key={type} className={`rounded-lg border p-3 ${isEmpty ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isEmpty ? 'text-red-600' : 'text-gray-700'}`}>{EVIDENCE_LABELS[type]}</span>
                      {isEmpty ? (
                        <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5" />缺失</span>
                      ) : (
                        <span className="text-xs text-green-600">{list.length} 条</span>
                      )}
                    </div>
                    {!isEmpty && list.map((ev) => <div key={ev.id} className="text-xs text-gray-500 mt-1">{ev.content}</div>)}
                  </div>
                )
              })}
            </div>
            {addingEvidence && (
              <div className="mt-3 border border-amber/30 rounded-lg p-3 bg-amber/5 space-y-2">
                <select value={evidenceForm.type} onChange={(e) => setEvidenceForm({ ...evidenceForm, type: e.target.value as EvidenceType })} className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                  {evidenceTypes.map((t) => <option key={t} value={t}>{EVIDENCE_LABELS[t]}</option>)}
                </select>
                <textarea value={evidenceForm.content} onChange={(e) => setEvidenceForm({ ...evidenceForm, content: e.target.value })} placeholder="证据内容" className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" rows={3} />
                <div className="flex gap-2">
                  <button onClick={handleAddEvidence} disabled={operating} className="bg-navy text-white px-4 py-1.5 rounded-md text-sm hover:bg-navy/90 disabled:opacity-50">确认添加</button>
                  <button onClick={() => setAddingEvidence(false)} className="border border-gray-200 px-4 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-50">取消</button>
                </div>
              </div>
            )}
          </section>

          {/* 版本时间线 */}
          <section>
            <h3 className="text-sm font-semibold text-navy mb-3">版本记录</h3>
            <div className="space-y-3">
              {apt.version_history.map((vr) => (
                <div key={vr.version} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                    <div className="w-px flex-1 bg-gray-200" />
                  </div>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy">v{vr.version}</span>
                      <span className="text-gray-500">{vr.action}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {vr.operator}({vr.operator_role}) · {new Date(vr.timestamp).toLocaleString()}
                    </div>
                    {vr.changes && <div className="text-xs text-gray-500 mt-1">{vr.changes}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 操作日志 */}
          <section>
            <h3 className="text-sm font-semibold text-navy mb-3">操作日志</h3>
            <div className="space-y-2">
              {apt.operation_logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700">{log.action}</span>
                    <span className="text-gray-400 ml-2">{log.operator}({log.operator_role})</span>
                    <div className="text-xs text-gray-400">{new Date(log.timestamp).toLocaleString()}</div>
                    {log.detail && <div className="text-xs text-gray-500 mt-0.5">{log.detail}</div>}
                    {log.batch_id && (
                      <div className="text-xs mt-1">
                        <button
                          onClick={() => openBatchDetail(log.batch_id!)}
                          className="inline-flex items-center gap-1 text-navy hover:underline"
                        >
                          <ListOrdered className="w-3 h-3" />
                          关联批次 {log.batch_id}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 关联批次 */}
          {apt.batch_records && apt.batch_records.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-navy mb-3">关联批次</h3>
              <div className="space-y-2">
                {apt.batch_records.map((br) => (
                  <div
                    key={br.batch_id}
                    className={`p-3 rounded-md text-sm ${
                      br.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {br.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <button
                        onClick={() => openBatchDetail(br.batch_id)}
                        className="font-semibold text-navy hover:underline"
                      >
                        {br.batch_id}
                      </button>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        br.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {br.success ? '处理成功' : br.error_code || '处理失败'}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(br.created_at).toLocaleString()}
                      </span>
                    </div>
                    {br.error_message && (
                      <div className="text-xs text-red-600 mt-1 ml-6">{br.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {correcting ? (
            <div className="flex gap-2">
              <button onClick={handleCorrect} disabled={operating} className="bg-navy text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-navy/90 disabled:opacity-50">
                {operating ? '提交中...' : '确认补正'}
              </button>
              <button onClick={() => setCorrecting(false)} className="border border-gray-200 px-5 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50">
                取消
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {/* 登记员操作 */}
              {role === 'registrar' && (
                <>
                  <button
                    onClick={startCorrect}
                    disabled={!canCorrect}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canCorrect ? 'bg-amber text-white hover:bg-amber/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!canCorrect ? '仅退回补正状态可操作' : ''}
                  >
                    <Edit className="w-4 h-4" />
                    补正
                    {!canCorrect && <span className="text-xs">(仅退回补正可操作)</span>}
                  </button>
                  <button
                    onClick={() => setAddingEvidence(true)}
                    className="flex items-center gap-1.5 border border-navy text-navy px-4 py-2 rounded-md text-sm font-medium hover:bg-navy/5 transition-colors"
                  >
                    <FileCheck className="w-4 h-4" />
                    添加证据
                  </button>
                </>
              )}
              {/* 审核主管操作 */}
              {role === 'reviewer' && (
                <>
                  <button
                    onClick={() => handleReview('approve')}
                    disabled={!canApprove}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canApprove ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!canApprove ? '仅待审核状态可操作' : ''}
                  >
                    <CheckCircle className="w-4 h-4" />
                    审核通过
                    {!canApprove && <span className="text-xs">(仅待审核可操作)</span>}
                  </button>
                  <button
                    onClick={() => handleReview('reject')}
                    disabled={!canApprove}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canApprove ? 'border border-orange-400 text-orange-600 hover:bg-orange-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!canApprove ? '仅待审核状态可操作' : ''}
                  >
                    <XCircle className="w-4 h-4" />
                    退回
                    {!canApprove && <span className="text-xs">(仅待审核可操作)</span>}
                  </button>
                </>
              )}
              {/* 复核负责人操作 */}
              {role === 'archivist' && (
                <>
                  <button
                    onClick={() => handleArchive('archive')}
                    disabled={!canArchive}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canArchive ? 'bg-navy text-white hover:bg-navy/90' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!canArchive ? '仅待归档状态可操作' : ''}
                  >
                    <FileCheck className="w-4 h-4" />
                    归档
                    {!canArchive && <span className="text-xs">(仅待归档可操作)</span>}
                  </button>
                  <button
                    onClick={() => handleArchive('reject')}
                    disabled={!canArchive}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      canArchive ? 'border border-orange-400 text-orange-600 hover:bg-orange-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title={!canArchive ? '仅待归档状态可操作' : ''}
                  >
                    <XCircle className="w-4 h-4" />
                    退回
                    {!canArchive && <span className="text-xs">(仅待归档可操作)</span>}
                  </button>
                </>
              )}
              <button
                onClick={() => loadAppointmentDetail(apt.id)}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors ml-auto"
              >
                刷新
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
