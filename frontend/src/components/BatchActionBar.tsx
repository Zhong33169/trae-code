import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useStore } from '@/store'
import type { BatchResult } from '@/types'

const ERROR_CODE_LABELS: Record<string, string> = {
  ROLE_MISMATCH: '角色不匹配',
  WRONG_STATUS: '状态错误',
  MISSING_EVIDENCE: '证据不全',
  VERSION_CONFLICT: '版本冲突',
  DUPLICATE: '重复预约',
  NOT_FOUND: '单据不存在',
  BAD_REQUEST: '请求错误',
}

export default function BatchActionBar() {
  const selectedIds = useStore((s) => s.selectedIds)
  const user = useStore((s) => s.user)
  const batchReview = useStore((s) => s.batchReview)
  const batchArchive = useStore((s) => s.batchArchive)
  const clearSelection = useStore((s) => s.clearSelection)

  const [operating, setOperating] = useState(false)
  const [results, setResults] = useState<BatchResult[] | null>(null)

  const hasSelection = selectedIds.size > 0
  const hasResults = results !== null
  const shouldShowBar = hasSelection || operating
  const shouldRender = shouldShowBar || hasResults

  if (!shouldRender) return null

  const successCount = results ? results.filter((r) => r.success).length : 0
  const failCount = results ? results.filter((r) => !r.success).length : 0

  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (operating) return
    setOperating(true)
    const res = await batchReview(action)
    setOperating(false)
    if (res) setResults(res)
  }

  const handleBatchArchive = async (action: 'archive' | 'reject') => {
    if (operating) return
    setOperating(true)
    const res = await batchArchive(action)
    setOperating(false)
    if (res) setResults(res)
  }

  const closeResults = () => {
    setResults(null)
    clearSelection()
  }

  return (
    <>
      {shouldShowBar && (
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
      )}

      {hasResults && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-navy mb-2">批量操作结果</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  成功 {successCount} 条
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  失败 {failCount} 条
                </span>
                <span className="text-gray-400">共 {results.length} 条</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                      r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {r.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="truncate">#{r.id}</span>
                        {r.success ? (
                          <span className="text-xs text-green-600">处理成功</span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            {r.error_code ? ERROR_CODE_LABELS[r.error_code] || r.error_code : '失败'}
                          </span>
                        )}
                      </div>
                      {!r.success && r.error && (
                        <div className="text-xs mt-1 text-red-500 break-all">{r.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={closeResults}
                className="w-full bg-navy text-white py-2.5 rounded-md text-sm font-medium hover:bg-navy/90 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
