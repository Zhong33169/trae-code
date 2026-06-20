import { useState } from 'react'
import { XCircle, Plus } from 'lucide-react'
import { useStore } from '@/store'

interface Props {
  onClose: () => void
}

export default function CreateForm({ onClose }: Props) {
  const [form, setForm] = useState({
    visitor_name: '',
    visitor_phone: '',
    visitor_id_number: '',
    exhibition_name: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const createAppointment = useStore((s) => s.createAppointment)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    const ok = await createAppointment(form)
    setSubmitting(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-navy">发起预约单</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">访客姓名</label>
            <input
              type="text"
              value={form.visitor_name}
              onChange={(e) => setForm({ ...form, visitor_name: e.target.value })}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
            <input
              type="tel"
              value={form.visitor_phone}
              onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
            <input
              type="text"
              value={form.visitor_id_number}
              onChange={(e) => setForm({ ...form, visitor_id_number: e.target.value })}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">展会名称</label>
            <input
              type="text"
              value={form.exhibition_name}
              onChange={(e) => setForm({ ...form, exhibition_name: e.target.value })}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-transparent"
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 bg-amber text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-amber/90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {submitting ? '提交中...' : '提交'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-200 px-5 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
