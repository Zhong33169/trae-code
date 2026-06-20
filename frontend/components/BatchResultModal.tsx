'use client';
import type { BatchConfirmResponse } from './BatchHandoverModal';

interface Props {
  open: boolean;
  data: BatchConfirmResponse | null;
  onClose: () => void;
}

export default function BatchResultModal({ open, data, onClose }: Props) {
  if (!open || !data) return null;

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="flex items-center gap-3">
            批量处理结果
            {data.batch_id && (
              <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                批次号: {data.batch_id}
              </span>
            )}
          </span>
          <button className="text-gray-400 hover:text-gray-700 text-lg leading-none" onClick={onClose}>×</button>
        </div>
        <div className="modal-body space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{data.total}</div>
              <div className="text-xs text-blue-600">处理总数</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{data.success_count}</div>
              <div className="text-xs text-green-600">成功</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{data.fail_count}</div>
              <div className="text-xs text-red-600">失败</div>
            </div>
          </div>

          <div>
            <div className="font-semibold text-sm text-gray-700 mb-2">逐条明细：</div>
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th style={{ width: 40 }}>结果</th>
                    <th style={{ width: 80 }}>交接ID</th>
                    <th style={{ width: 140 }}>报价单号</th>
                    <th style={{ width: 60 }}>操作</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((res, i) => (
                    <tr key={i}>
                      <td className="text-center">
                        <span className={res.success ? 'text-green-600' : 'text-red-600'} style={{ fontSize: 14 }}>
                          {res.success ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="font-mono">{res.handover_id}</td>
                      <td className="font-mono text-blue-700">
                        {res.quote_no || '-'}
                      </td>
                      <td>
                        {res.action === 'confirm' ? '接收' : '拒绝'}
                        {res.new_handler && (
                          <>
                            <div className="text-xs text-gray-500">处理人: {res.new_handler}</div>
                            <div className="text-xs text-gray-500">班次: {res.new_shift}</div>
                          </>
                        )}
                        {res.error_code && (
                          <div className="text-xs text-orange-600 font-mono">{res.error_code}</div>
                        )}
                      </td>
                      <td className={!res.success ? 'text-red-600' : ''}>{res.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            注意：已成功处理的交接，报价单列表、详情页、统计数据均已自动同步更新，刷新即可看到最新状态。
            批次号已写入操作审计日志，可在报价单详情页的操作记录中查询。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>好的，我知道了</button>
        </div>
      </div>
    </div>
  );
}
