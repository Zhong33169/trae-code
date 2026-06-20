import { X, CheckCircle, XCircle, AlertCircle, Eye, ListOrdered } from 'lucide-react'
import { useStore } from '@/store'
import type { BatchResult, BatchDetailItem } from '@/types'

const ERROR_CODE_LABELS: Record<string, string> = {
  ROLE_MISMATCH: '角色不匹配',
  WRONG_STATUS: '状态错误',
  MISSING_EVIDENCE: '证据不全',
  VERSION_CONFLICT: '版本冲突',
  DUPLICATE: '重复预约',
  NOT_FOUND: '单据不存在',
  BAD_REQUEST: '请求错误',
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  batch_review: '批量审核',
  batch_archive: '批量归档',
}

const ACTION_LABELS: Record<string, string> = {
  approve: '通过',
  reject: '退回',
  archive: '归档',
}

const ROLE_LABELS: Record<string, string> = {
  registrar: '登记员',
  reviewer: '审核主管',
  archivist: '复核负责人',
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return ts
  }
}

interface ResultRowProps {
  appointmentId: string
  success: boolean
  errorCode?: string
  errorMessage?: string
}

function ResultRow({ appointmentId, success, errorCode, errorMessage }: ResultRowProps) {
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-md text-sm ${
        success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {success ? (
        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">#{appointmentId}</span>
          {success ? (
            <span className="text-xs text-green-600">处理成功</span>
          ) : (
            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
              {errorCode ? ERROR_CODE_LABELS[errorCode] || errorCode : '失败'}
            </span>
          )}
        </div>
        {!success && errorMessage && (
          <div className="text-xs mt-1 text-red-500 break-all">{errorMessage}</div>
        )}
      </div>
    </div>
  )
}

export default function BatchHistoryPanel() {
  const showBatchHistory = useStore((s) => s.showBatchHistory)
  const closeBatchHistory = useStore((s) => s.closeBatchHistory)
  const showBatchDetailModal = useStore((s) => s.showBatchDetailModal)
  const closeBatchDetail = useStore((s) => s.closeBatchDetail)
  const openBatchDetail = useStore((s) => s.openBatchDetail)
  const batches = useStore((s) => s.batches)
  const currentBatchDetail = useStore((s) => s.currentBatchDetail)
  const lastBatchResult = useStore((s) => s.lastBatchResult)
  const clearLastBatchResult = useStore((s) => s.clearLastBatchResult)
  const clearSelection = useStore((s) => s.clearSelection)

  if (!showBatchHistory && !showBatchDetailModal && !lastBatchResult) return null

  const handleCloseLastResult = () => {
    clearLastBatchResult()
    clearSelection()
  }

  return (
    <>
      {lastBatchResult && (
        <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-navy mb-2">批量操作结果</h3>
              <div className="text-xs text-gray-400 mb-2">批次号：{lastBatchResult.batch_id}</div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  成功 {lastBatchResult.results.filter((r: BatchResult) => r.success).length} 条
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  失败 {lastBatchResult.results.filter((r: BatchResult) => !r.success).length} 条
                </span>
                <span className="text-gray-400">共 {lastBatchResult.results.length} 条</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {lastBatchResult.results.map((r: BatchResult) => (
                  <ResultRow
                    key={r.id}
                    appointmentId={r.id}
                    success={r.success}
                    errorCode={r.error_code}
                    errorMessage={r.error}
                  />
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={handleCloseLastResult}
                className="w-full bg-navy text-white py-2.5 rounded-md text-sm font-medium hover:bg-navy/90 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchHistory && (
        <div className="fixed inset-0 bg-black/40 z-[70]">
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                  <ListOrdered className="w-5 h-5" />
                  批次办理记录
                </h3>
                <p className="text-xs text-gray-400 mt-1">共 {batches.length} 条历史</p>
              </div>
              <button
                onClick={closeBatchHistory}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {batches.length === 0 ? (
                <div className="text-center text-gray-400 py-12 text-sm">
                  暂无批次记录
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((b) => (
                    <div
                      key={b.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-navy/30 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => openBatchDetail(b.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {ACTION_TYPE_LABELS[b.action_type] || b.action_type}
                            <span className="text-gray-400 ml-2">
                              {ACTION_LABELS[b.action] || b.action}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{b.id}</div>
                        </div>
                        <button className="text-navy/60 hover:text-navy p-1 -m-1" onClick={(e) => { e.stopPropagation(); openBatchDetail(b.id) }}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span>操作人：{b.operator}（{ROLE_LABELS[b.operator_role] || b.operator_role}）</span>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">{formatTime(b.created_at)}</div>
                      {b.comment && (
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mb-2">
                          备注：{b.comment}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-green-600">
                          <CheckCircle className="w-3 h-3 inline mr-0.5" />
                          成功 {b.success_count}
                        </span>
                        <span className="text-red-600">
                          <XCircle className="w-3 h-3 inline mr-0.5" />
                          失败 {b.fail_count}
                        </span>
                        <span className="text-gray-400">共 {b.total_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBatchDetailModal && currentBatchDetail && (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-lg font-bold text-navy">
                    {ACTION_TYPE_LABELS[currentBatchDetail.action_type] || currentBatchDetail.action_type}
                    <span className="text-gray-400 ml-2 font-normal">
                      {ACTION_LABELS[currentBatchDetail.action] || currentBatchDetail.action}
                    </span>
                  </h3>
                  <div className="text-xs text-gray-400 mt-1">{currentBatchDetail.id}</div>
                </div>
                <button
                  onClick={closeBatchDetail}
                  className="text-gray-400 hover:text-gray-600 p-1 -m-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{currentBatchDetail.operator}（{ROLE_LABELS[currentBatchDetail.operator_role] || currentBatchDetail.operator_role}）</span>
                <span>{formatTime(currentBatchDetail.created_at)}</span>
              </div>
              {currentBatchDetail.comment && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2">
                  备注：{currentBatchDetail.comment}
                </div>
              )}
              <div className="flex items-center gap-4 text-sm mt-3">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  成功 {currentBatchDetail.success_count} 条
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  失败 {currentBatchDetail.fail_count} 条
                </span>
                <span className="text-gray-400">共 {currentBatchDetail.total_count} 条</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {currentBatchDetail.items.map((item: BatchDetailItem) => (
                  <ResultRow
                    key={item.id}
                    appointmentId={item.appointment_id}
                    success={item.success}
                    errorCode={item.error_code}
                    errorMessage={item.error_message}
                  />
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100">
              <button
                onClick={closeBatchDetail}
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
