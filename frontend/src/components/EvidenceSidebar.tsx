import { AlertTriangle, FileCheck } from 'lucide-react'
import { useStore } from '@/store'
import type { EvidenceType } from '@/types'

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  reservation: '观众预约',
  check_in: '入场核销',
  data_recovery: '数据回收',
}

export default function EvidenceSidebar() {
  const currentAppointment = useStore((s) => s.currentAppointment)

  if (!currentAppointment) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-400">
        <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">请选择一条预约单查看证据</p>
      </div>
    )
  }

  const evidenceMap = currentAppointment.evidence
  const types: EvidenceType[] = ['reservation', 'check_in', 'data_recovery']

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-navy text-sm">证据摘要</h3>
      {types.map((type) => {
        const list = evidenceMap[type] || []
        const isEmpty = list.length === 0
        return (
          <div
            key={type}
            className={`rounded-lg border p-3 ${isEmpty ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${isEmpty ? 'text-red-600' : 'text-gray-700'}`}>
                {EVIDENCE_LABELS[type]}
              </span>
              {isEmpty ? (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  缺失
                </span>
              ) : (
                <span className="text-xs text-green-600 font-medium">{list.length} 条</span>
              )}
            </div>
            {!isEmpty && (
              <div className="mt-2 space-y-1">
                {list.map((ev) => (
                  <div key={ev.id} className="text-xs text-gray-500 truncate">
                    {ev.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
