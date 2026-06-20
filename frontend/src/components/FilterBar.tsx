import { Search, Filter } from 'lucide-react'
import { useStore, ROLE_DEFAULT_FILTER } from '@/store'
import type { AppointmentStatus } from '@/types'

const STATUS_OPTIONS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending_review', label: '待审核' },
  { value: 'pending_archive', label: '待归档' },
  { value: 'rejected_for_correction', label: '退回补正' },
  { value: 'rejected_for_review', label: '退回审核' },
  { value: 'archived', label: '已归档' },
]

export default function FilterBar() {
  const user = useStore((s) => s.user)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter({ status: e.target.value as AppointmentStatus | '' })
  }

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter({ keyword: e.target.value })
  }

  const handleReset = () => {
    if (user) {
      setFilter({ status: ROLE_DEFAULT_FILTER[user.role], keyword: '' })
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-sm text-gray-500">
        <Filter className="w-4 h-4" />
        <span>筛选</span>
      </div>
      <select
        value={filter.status}
        onChange={handleStatusChange}
        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent bg-white"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filter.keyword}
          onChange={handleKeywordChange}
          placeholder="搜索访客姓名或展会名称"
          className="w-full border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
        />
      </div>
      <button
        onClick={handleReset}
        className="text-sm text-amber hover:text-amber/80 transition-colors whitespace-nowrap"
      >
        重置
      </button>
    </div>
  )
}
