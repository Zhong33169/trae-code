import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, auth, NodeTracking, OperationLog, SeedRecordDetail } from '~/app/api'
import { formatTime, nodeLabel, roleLabel, statusColor, statusLabel } from '~/app/constants'
import { useRecordDetail } from '~/app/hooks'

export const Route = createFileRoute('/records/$id')({
  component: RecordDetailPage,
})

function RecordDetailPage() {
  const { id } = Route.useParams() as { id: string } as { id: string }
  const nav = useNavigate()
  const user = auth.getUser()
  const { loading, data, msg, showMsg, refresh } = useRecordDetail(id)
  const [activeTab, setActiveTab] = useState<'record' | 'nodes' | 'logs'>('record')

  if (loading) return <div style={{ padding: 40 }}>加载中...</div>
  if (!data) return <div style={{ padding: 40, color: '#b91c1c' }}>{msg?.text || '加载失败'}</div>

  const rec = data.record
  const isFinalized = rec.overall_status === 'completed'
  const hasTimeoutNode = isFinalized ? false : data.nodes.some(n => n.is_timeout && n.status !== 'completed')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#0f172a' }}>苗种记录详情 · {rec.batch_no}</h2>
          <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>
            当前节点：<b style={{ color: '#1d4ed8' }}>{nodeLabel(rec.current_node)}</b>　
            记录状态：
            <span style={{
              padding: '3px 10px', borderRadius: 10, fontSize: 12, marginLeft: 4,
              background: statusColor(rec.overall_status) + '1a',
              color: statusColor(rec.overall_status), fontWeight: 600,
            }}>{statusLabel(rec.overall_status)}</span>
            {hasTimeoutNode && (
              <span style={{
                marginLeft: 12, padding: '3px 10px', borderRadius: 10, fontSize: 12,
                background: '#fee2e2', color: '#b91c1c', fontWeight: 600,
              }}>⚠ 存在节点超时</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} style={btnGhost}>刷新</button>
          <button onClick={() => nav({ to: '/' })} style={btnGhost}>返回列表</button>
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 12px', borderRadius: 6, marginBottom: 14,
          background: msg.type === 'ok' ? '#ecfdf5' : '#fef2f2',
          color: msg.type === 'ok' ? '#047857' : '#b91c1c', fontSize: 14,
        }}>{msg.text}</div>
      )}

      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        borderBottom: '1px solid #e2e8f0',
      }}>
        <TabBtn label="记录信息" active={activeTab === 'record'} onClick={() => setActiveTab('record')} />
        <TabBtn
          label={`节点追踪（${data.nodes.length}）${hasTimeoutNode ? ' ⚠' : ''}`}
          active={activeTab === 'nodes'} onClick={() => setActiveTab('nodes')} />
        <TabBtn
          label={`操作记录（${data.logs.length}）`}
          active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
      </div>

      {activeTab === 'record' && (
        <RecordPanel
          rec={rec}
          userRole={user?.role || ''}
          onMsg={showMsg}
          onDone={refresh}
          nodes={data.nodes}
        />
      )}
      {activeTab === 'nodes' && (
        <NodesPanel
          nodes={data.nodes}
          rec={rec}
          userRole={user?.role || ''}
          onMsg={showMsg}
          onDone={refresh}
        />
      )}
      {activeTab === 'logs' && <LogsPanel logs={data.logs} />}
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 18px', background: active ? '#fff' : 'transparent',
      border: active ? '1px solid #e2e8f0' : 'none',
      borderBottom: active ? '2px solid #047857' : 'none',
      fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? '#0f172a' : '#64748b',
      marginBottom: -1, borderRadius: '6px 6px 0 0',
    }}>{label}</button>
  )
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', fontSize: 14,
    }}>
      <div style={{ width: 140, color: '#64748b', flexShrink: 0 }}>{k}</div>
      <div style={{ color: '#0f172a', flex: 1 }}>{v || '-'}</div>
    </div>
  )
}

function RecordPanel({
  rec, userRole, onMsg, onDone, nodes,
}: {
  rec: SeedRecordDetail['record']
  userRole: string
  onMsg: (t: 'ok' | 'err', m: string) => void
  onDone: () => void
  nodes: NodeTracking[]
}) {
  const { id } = Route.useParams() as { id: string }
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')

  const [pondOpen, setPondOpen] = useState(false)
  const [pondId, setPondId] = useState('')
  const [pondQty, setPondQty] = useState(rec.pond_quantity || rec.quantity)
  const [pondRemark, setPondRemark] = useState('')
  const [pondDeadline, setPondDeadline] = useState(48)

  const [survOpen, setSurvOpen] = useState(false)
  const [survRate, setSurvRate] = useState<number>(rec.survival_rate || 90)
  const [survRemark, setSurvRemark] = useState('')
  const [survDeadline, setSurvDeadline] = useState(240)

  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveRemark, setArchiveRemark] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    seed_type: rec.seed_type, seed_species: rec.seed_species,
    quantity: rec.quantity, unit: rec.unit, source: rec.source,
    supplier: rec.supplier || '',
  })

  const [timeoutOpen, setTimeoutOpen] = useState(false)
  const [timeoutReason, setTimeoutReason] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [timeoutRemark, setTimeoutRemark] = useState('')
  const [timeoutEvidence, setTimeoutEvidence] = useState('')

  const hasTimeout = rec.overall_status === 'completed' ? false : nodes.some(n => n.is_timeout && n.status !== 'completed')
  const isFinalized = rec.overall_status === 'completed'

  const doApprove = async () => {
    const r = await api.approveAudit(id, { evidence_note: evidenceNote || undefined, deadline_hours: pondDeadline })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setEvidenceNote(''); onDone() }
  }
  const doReject = async () => {
    if (!rejectReason.trim()) { onMsg('err', '请填写驳回原因'); return }
    const r = await api.rejectAudit(id, { reason: rejectReason.trim(), evidence_note: evidenceNote || undefined })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setRejectReason(''); setEvidenceNote(''); setRejectOpen(false); onDone() }
  }
  const doPond = async () => {
    if (!pondId.trim() || pondQty <= 0) { onMsg('err', '池塘编号和入塘数量（>0）为必填'); return }
    const r = await api.pondEntry(id, { pond_id: pondId.trim(), pond_quantity: pondQty, remark: pondRemark || undefined, deadline_hours: survDeadline })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setPondOpen(false); onDone() }
  }
  const doSurv = async () => {
    if (!(survRate >= 0 && survRate <= 100)) { onMsg('err', '成活率应在 0 到 100 之间'); return }
    const r = await api.survivalObserve(id, { survival_rate: survRate, remark: survRemark || undefined, deadline_hours: 72 })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setSurvOpen(false); onDone() }
  }
  const doArchive = async () => {
    if (!archiveRemark.trim()) { onMsg('err', '请填写归档复核意见'); return }
    const r = await api.archive(id, { archive_remark: archiveRemark.trim() })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setArchiveOpen(false); onDone() }
  }
  const doEdit = async () => {
    const r = await api.updateRecord(id, editForm)
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setEditOpen(false); onDone() }
  }
  const doHandleTimeout = async () => {
    if (!timeoutReason.trim() || !followUp.trim()) { onMsg('err', '超时原因与后续处理措施均为必填'); return }
    const r = await api.handleTimeout(id, {
      timeout_reason: timeoutReason.trim(), follow_up_action: followUp.trim(),
      timeout_remark: timeoutRemark || undefined, evidence_note: timeoutEvidence || undefined,
    })
    onMsg(r.success ? 'ok' : 'err', r.message)
    if (r.success) { setTimeoutOpen(false); setTimeoutReason(''); setFollowUp(''); setTimeoutRemark(''); setTimeoutEvidence(''); onDone() }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#0f172a' }}>基本信息</div>
          <KV k="批次号" v={rec.batch_no} />
          <KV k="苗种类型" v={rec.seed_type} />
          <KV k="苗种品种" v={rec.seed_species} />
          <KV k="数量" v={`${rec.quantity} ${rec.unit}`} />
          <KV k="来源" v={rec.source} />
          <KV k="供应商" v={rec.supplier} />
          <KV k="登记员" v={`${rec.register_name}（${roleLabel('registrar')}）`} />
          <KV k="登记时间" v={formatTime(rec.register_time)} />
          <KV k="最后更新" v={formatTime(rec.updated_at)} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#0f172a' }}>节点信息</div>
          <KV k="当前节点" v={nodeLabel(rec.current_node)} />
          <KV k="入塘时间" v={formatTime(rec.pond_entry_time)} />
          <KV k="池塘编号" v={rec.pond_id} />
          <KV k="入塘数量" v={rec.pond_quantity != null ? `${rec.pond_quantity} ${rec.unit}` : undefined} />
          <KV k="成活率" v={rec.survival_rate != null ? `${rec.survival_rate.toFixed(2)}%` : undefined} />
          <KV k="观察时间" v={formatTime(rec.survival_observe_time)} />
          <KV k="归档时间" v={formatTime(rec.archive_time)} />
          <KV k="归档意见" v={rec.archive_remark} />
        </div>
      </div>

      {isFinalized ? (
        <div style={{ ...card, marginTop: 16, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#065f46' }}>✓ 批次已结案归档</div>
          <div style={{ fontSize: 13, color: '#047857' }}>
            该苗种记录已完成全部节点流程，状态与节点信息已固定，不再允许变更或登记超时处理。
            {rec.archive_remark && <div style={{ marginTop: 6, color: '#0f766e' }}>归档复核意见：{rec.archive_remark}</div>}
          </div>
        </div>
      ) : (
        <div style={{ ...card, marginTop: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>操作动作（按当前岗位可见）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {hasTimeout && (
              <button onClick={() => setTimeoutOpen(true)} style={{ ...btnPrimary, background: '#b91c1c' }}>
                ⚠ 登记节点超时原因与处理
              </button>
            )}

            {userRole === 'registrar' && (rec.overall_status === 'correction' || rec.overall_status === 'pending') && (
              <button onClick={() => setEditOpen(true)} style={btnPrimary}>
                {rec.overall_status === 'correction' ? '补正并重新提交审核' : '修改苗种记录'}
              </button>
            )}

            {userRole === 'registrar' && rec.current_node === 'pond_entry' && (
              <button onClick={() => setPondOpen(true)} style={btnPrimary}>登记苗种入塘</button>
            )}

            {userRole === 'registrar' && rec.current_node === 'survival_observe' && (
              <button onClick={() => setSurvOpen(true)} style={btnPrimary}>登记成活观察</button>
            )}

            {userRole === 'auditor' && rec.current_node === 'audit' && (
              <>
                <button onClick={doApprove} style={btnPrimary}>审核通过（进入入塘节点）</button>
                <button onClick={() => setRejectOpen(true)} style={btnDanger}>审核驳回（退回补正）</button>
              </>
            )}

            {userRole === 'reviewer' && rec.current_node === 'archive_review' && (
              <button onClick={() => setArchiveOpen(true)} style={btnPrimary}>批次归档复核</button>
            )}

            {!['registrar', 'auditor', 'reviewer'].includes(userRole) && (
              <span style={{ color: '#64748b', fontSize: 13 }}>当前岗位无待办操作</span>
            )}
            {['registrar', 'auditor', 'reviewer'].includes(userRole) &&
              !hasTimeout &&
              !((userRole === 'registrar' && (rec.overall_status === 'correction' || rec.overall_status === 'pending' || rec.current_node === 'pond_entry' || rec.current_node === 'survival_observe'))
                || (userRole === 'auditor' && rec.current_node === 'audit')
                || (userRole === 'reviewer' && rec.current_node === 'archive_review')) && (
              <span style={{ color: '#64748b', fontSize: 13 }}>当前记录无待办动作</span>
            )}
          </div>
        </div>
      )}

      {editOpen && (
        <Modal title="修改/补正苗种记录" onClose={() => setEditOpen(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="苗种类型">
              <input value={editForm.seed_type}
                onChange={e => setEditForm({ ...editForm, seed_type: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="苗种品种">
              <input value={editForm.seed_species}
                onChange={e => setEditForm({ ...editForm, seed_species: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="数量">
              <input type="number" min={1} value={editForm.quantity}
                onChange={e => setEditForm({ ...editForm, quantity: Number(e.target.value) })} style={inputStyle} />
            </Field>
            <Field label="单位">
              <input value={editForm.unit}
                onChange={e => setEditForm({ ...editForm, unit: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="来源">
              <input value={editForm.source}
                onChange={e => setEditForm({ ...editForm, source: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="供应商">
              <input value={editForm.supplier}
                onChange={e => setEditForm({ ...editForm, supplier: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          <ModalFooter>
            <button onClick={() => setEditOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doEdit} style={btnPrimary}>提交</button>
          </ModalFooter>
        </Modal>
      )}

      {rejectOpen && (
        <Modal title="审核驳回（退回登记员补正）" onClose={() => setRejectOpen(false)}>
          <Field label="驳回原因（必填）">
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="请说明驳回原因，登记员将据此补正" />
          </Field>
          <Field label="证据说明（选填）">
            <textarea value={evidenceNote} onChange={e => setEvidenceNote(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <ModalFooter>
            <button onClick={() => setRejectOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doReject} style={btnDanger}>确认驳回</button>
          </ModalFooter>
        </Modal>
      )}

      {pondOpen && (
        <Modal title="登记苗种入塘" onClose={() => setPondOpen(false)}>
          <Field label="池塘编号（必填）">
            <input value={pondId} onChange={e => setPondId(e.target.value)}
              style={inputStyle} placeholder="如：A-03、B塘1号" />
          </Field>
          <Field label="入塘数量（必填）">
            <input type="number" min={1} value={pondQty}
              onChange={e => setPondQty(Number(e.target.value))} style={inputStyle} />
          </Field>
          <Field label="入塘备注（选填）">
            <input value={pondRemark} onChange={e => setPondRemark(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="下一节点（成活观察）时限（小时，默认 240 = 10天）">
            <input type="number" min={1} value={survDeadline}
              onChange={e => setSurvDeadline(Number(e.target.value))} style={inputStyle} />
          </Field>
          <ModalFooter>
            <button onClick={() => setPondOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doPond} style={btnPrimary}>提交入塘登记</button>
          </ModalFooter>
        </Modal>
      )}

      {survOpen && (
        <Modal title="登记成活观察" onClose={() => setSurvOpen(false)}>
          <Field label="成活率（%，0-100）">
            <input type="number" min={0} max={100} step="0.01" value={survRate}
              onChange={e => setSurvRate(Number(e.target.value))} style={inputStyle} />
          </Field>
          <Field label="观察备注（选填）">
            <textarea value={survRemark} onChange={e => setSurvRemark(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <Field label="下一节点（归档复核）时限（小时，默认 72）">
            <input type="number" min={1} value={72}
              onChange={e => { /* keep default */ }} style={inputStyle} disabled />
          </Field>
          <ModalFooter>
            <button onClick={() => setSurvOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doSurv} style={btnPrimary}>提交成活观察</button>
          </ModalFooter>
        </Modal>
      )}

      {archiveOpen && (
        <Modal title="批次归档复核" onClose={() => setArchiveOpen(false)}>
          <Field label="归档复核意见（必填）">
            <textarea value={archiveRemark} onChange={e => setArchiveRemark(e.target.value)}
              rows={4} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="请填写复核结论与意见，归档后记录不可再变更" />
          </Field>
          <ModalFooter>
            <button onClick={() => setArchiveOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doArchive} style={btnPrimary}>确认归档</button>
          </ModalFooter>
        </Modal>
      )}

      {timeoutOpen && (
        <Modal title="登记节点超时原因与后续处理（留痕留证据）" onClose={() => setTimeoutOpen(false)}>
          <Field label="超时原因（必填）">
            <textarea value={timeoutReason} onChange={e => setTimeoutReason(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="请如实说明节点超时的客观/主观原因" />
          </Field>
          <Field label="后续处理措施（必填）">
            <textarea value={followUp} onChange={e => setFollowUp(e.target.value)}
              rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="请说明将如何推进该节点的后续处理" />
          </Field>
          <Field label="超时处理备注（选填）">
            <textarea value={timeoutRemark} onChange={e => setTimeoutRemark(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <Field label="证据说明/附记（选填）">
            <textarea value={timeoutEvidence} onChange={e => setTimeoutEvidence(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <ModalFooter>
            <button onClick={() => setTimeoutOpen(false)} style={btnGhost}>取消</button>
            <button onClick={doHandleTimeout} style={btnPrimary}>提交超时登记</button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

function NodesPanel({ nodes, rec, userRole, onMsg, onDone }: {
  nodes: NodeTracking[]
  rec: SeedRecordDetail['record']
  userRole: string
  onMsg: (t: 'ok' | 'err', m: string) => void
  onDone: () => void
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
        节点按流程顺序展示，已超时节点会高亮并要求登记原因与后续处理措施。责任（岗位/办理人）、证据（备注/证据说明）、状态三者集中在同一视图下管理。
      </div>
      {nodes.map((n, idx) => (
        <div key={n.id} style={{
          border: n.is_timeout && n.status !== 'completed' ? '2px solid #dc2626' : '1px solid #e2e8f0',
          borderRadius: 10, padding: 16, marginBottom: 12,
          background: n.is_timeout && n.status !== 'completed' ? '#fef2f2' : '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                background: n.status === 'completed' ? '#047857' : n.is_timeout ? '#dc2626' : '#f59e0b',
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>{idx + 1}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{n.node_name}</span>
              <span style={{
                padding: '3px 10px', borderRadius: 10, fontSize: 12,
                background: n.status === 'completed' ? '#d1fae5' : n.is_timeout ? '#fee2e2' : '#fef3c7',
                color: n.status === 'completed' ? '#065f46' : n.is_timeout ? '#b91c1c' : '#92400e',
                fontWeight: 600,
              }}>
                {n.status === 'completed' ? '已完成' : n.is_timeout ? '⚠ 已超时' : '待处理/处理中'}
              </span>
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>类型：{n.node_type}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, fontSize: 13 }}>
            <KVInline k="办理人" v={n.assignee_name || '-'} />
            <KVInline k="责任岗位" v={n.assignee_name ? inferRoleByNode(n.node_type) : '-'} />
            <KVInline k="时限" v={formatTime(n.deadline)} />
            <KVInline k="完成时间" v={formatTime(n.completed_at)} />
          </div>

          {n.is_timeout && (
            <div style={{
              marginTop: 12, padding: 12, background: '#fff', border: '1px solid #fecaca',
              borderRadius: 6, fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 8 }}>超时处理记录（责任·证据·状态不分散）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <KVInline k="超时原因" v={n.timeout_reason} />
                <KVInline k="后续处理措施" v={n.follow_up_action} />
                <KVInline k="超时处理备注" v={n.timeout_remark} />
                <KVInline k="节点备注/证据" v={n.remark} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function inferRoleByNode(node_type: string) {
  switch (node_type) {
    case 'registration':
    case 'pond_entry':
    case 'survival_observe': return roleLabel('registrar')
    case 'audit': return roleLabel('auditor')
    case 'archive_review': return roleLabel('reviewer')
    default: return '-'
  }
}

function LogsPanel({ logs }: { logs: OperationLog[] }) {
  if (!logs.length) return <div style={card}>暂无操作记录</div>
  return (
    <div style={card}>
      <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
        所有状态变更、节点推进、超时处理均会在此留下操作人、动作、详情、状态前后值以及证据说明。
      </div>
      {logs.map(l => (
        <div key={l.id} style={{
          padding: '12px 14px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#e0f2fe', color: '#0369a1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>{l.user_name.slice(0, 1)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
              <b>{l.user_name}</b>（{roleLabel(l.user_role)}）· {l.action}
              {l.old_status || l.new_status ? (
                <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>
                  {l.old_status ? statusLabel(l.old_status) : ''}
                  {l.old_status && l.new_status ? ' → ' : ''}
                  {l.new_status ? statusLabel(l.new_status) : ''}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>{l.action_target}</div>
            {l.detail && <div style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>详情：{l.detail}</div>}
            {l.evidence_note && <div style={{ fontSize: 13, color: '#0f766e' }}>证据：{l.evidence_note}</div>}
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{formatTime(l.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, color: '#334155', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function KVInline({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 2 }}>{k}</div>
      <div style={{ color: '#0f172a' }}>{v || '-'}</div>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 560, maxWidth: '90vw',
        maxHeight: '85vh', overflow: 'auto', padding: 22,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 14, color: '#0f172a' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>{children}</div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: 14, outline: 'none', background: '#fff',
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', background: '#047857', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
}
const btnDanger: React.CSSProperties = {
  padding: '8px 18px', background: '#dc2626', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500,
}
const btnGhost: React.CSSProperties = {
  padding: '8px 18px', background: '#fff', color: '#334155',
  border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13,
}
