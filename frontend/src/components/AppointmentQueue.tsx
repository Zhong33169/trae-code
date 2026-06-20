import { Eye, Plus } from 'lucide-react'
import { useStore } from '@/store'
import type { Appointment, AppointmentStatus } from '@/types'

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending_review: 'bg-blue-100 text-blue-700',
  pending_archive: 'bg-green-100 text-green-700',
  rejected_for_correction: 'bg-orange-100 text-orange-700',
  rejected_for_review: 'bg-orange-100 text-orange-700',
  archived: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_review: '待审核',
  pending_archive: '待归档',
  rejected_for_correction: '退回补正',
  rejected_for_review: '退回审核',
  archived: '已归档',
}

function maskIdNumber(id: string) {
  if (id.length <= 6) return id
  return id.slice(0, 3) + '*'.repeat(id.length - 6) + id.slice(-3)
}

interface Props {
  onOpenDetail: (id: string) => void
  onOpenCreate: () => void
}

export default function AppointmentQueue({ onOpenDetail, onOpenCreate }: Props) {
  const appointments = useStore((s) => s.appointments)
  const selectedIds = useStore((s) => s.selectedIds)
  const toggleSelect = useStore((s) => s.toggleSelect)
  const selectAll = useStore((s) => s.selectAll)
  const user = useStore((s) => s.user)
  const loading = useStore((s) => s.loading)

  const allSelected = appointments.length > 0 && appointments.every((a) => selectedIds.has(a.id))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => selectAll(allSelected ? [] : appointments.map((a) => a.id))}
            className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy"
          />
          <span className="text-sm text-gray-500">
            {appointments.length} 条记录，已选 {selectedIds.size} 条
          </span>
        </div>
        {user?.role === 'registrar' && (
          <button
            onClick={onOpenCreate}
            className="flex items-center gap-1 bg-amber text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-amber/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            发起预约
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无数据</div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt: Appointment) => (
            <div
              key={apt.id}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                selectedIds.has(apt.id) ? 'border-amber bg-amber/5' : 'border-gray-200 bg-white'
              }`}
              onClick={() => onOpenDetail(apt.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(apt.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleSelect(apt.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-navy">{apt.visitor_name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[apt.status]}`}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>身份证: {maskIdNumber(apt.visitor_id_number)}</span>
                    <span>展会: {apt.exhibition_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>v{apt.version}</span>
                  <Eye className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
