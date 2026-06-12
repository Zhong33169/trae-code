import { useMemo } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { BatchResult } from "../types";

interface BatchResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: BatchResult | null;
  title?: string;
}

export function BatchResultDialog({
  isOpen,
  onClose,
  result,
  title = "批量操作结果",
}: BatchResultDialogProps) {
  const stats = useMemo(() => {
    if (!result) {
      return { total: 0, success: 0, failed: 0, retry: 0 };
    }
    const total = result.results.length;
    const success = result.results.filter((r) => r.success).length;
    const retry = result.results.filter((r) => r.need_retry).length;
    const failed = total - success - retry;
    return { total, success, failed, retry };
  }, [result]);

  const getStatusStyle = (success: boolean, needRetry: boolean) => {
    if (success) return "bg-green-100 text-green-800 border-green-200";
    if (needRetry) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStatusLabel = (success: boolean, needRetry: boolean) => {
    if (success) return "成功";
    if (needRetry) return "需重试";
    return "失败";
  };

  if (!result) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          确定
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">总计</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {stats.success}
            </p>
            <p className="text-xs text-green-600">成功</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-red-600">失败</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.retry}</p>
            <p className="text-xs text-yellow-600">需重试</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">详细结果</h4>
          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    任务编号
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    状态
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    原因
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {result.results.map((item) => (
                  <tr
                    key={item.task_id}
                    className={
                      !item.success ? (item.need_retry ? "bg-yellow-50/50" : "bg-red-50/50") : ""
                    }
                  >
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {item.task_no}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusStyle(
                          item.success,
                          item.need_retry
                        )}`}
                      >
                        {getStatusLabel(item.success, item.need_retry)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {item.message || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
