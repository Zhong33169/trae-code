import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useStore } from '@/store'

export default function BatchActionBar() {
  const selectedIds = useStore((s) => s.selectedIds)
  const user = useStore((s) => s.user)
  const batchReview = useStore((s) => s.batchReview)
  const batchArchive = useStore((s) => s.batchArchive)
  const clearSelection = useStore((s) => s.clearSelection)

  const [operating, setOperating] = useState(false)

  if (selectedIds.size === 0) return null

  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (operating) return
    setOperating(true)
    await batchReview(action)
    setOperating(false)
  }

  const handleBatchArchive = async (action: 'archive' | 'reject') => {
    if (operating) return
    setOperating(true)
    await batchArchive(action)
    setOperating(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span className="text-sm text-gray-600">
          已选择 <strong className="text-navy">{selectedIds.size}</strong> 条记录
        </span>
        <div className="flex items-center gap-2">
          {user?.role === 'reviewer' && (
            <>
              <button
                onClick={() => handleBatchReview('approve')}
                disabled={operating}
                className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {operating ? '处理中...' : '批量审核通过'}
              </button>
              <button
                onClick={() => handleBatchReview('reject')}
                disabled={operating}
                className="flex items-center gap-1.5 border border-orange-400 text-orange-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-50 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                批量退回
              </button>
            </>
          )}
          {user?.role === 'archivist' && (
            <>
              <button
                onClick={() => handleBatchArchive('archive')}
                disabled={operating}
                className="flex items-center gap-1.5 bg-navy text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-navy/90 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {operating ? '处理中...' : '批量归档'}
              </button>
              <button
                onClick={() => handleBatchArchive('reject')}
                disabled={operating}
                className="flex items-center gap-1.5 border border-orange-400 text-orange-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-50 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                批量退回
              </button>
            </>
          )}
          <button
            onClick={clearSelection}
            disabled={operating}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            取消选择
          </button>
        </div>
      </div>
    </div>
  )
}

