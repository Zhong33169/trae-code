import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { EvidenceType } from "../types";
import { EVIDENCE_TYPE_LABELS } from "../types";

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; evidences: EvidenceInput[] }) => void;
  title: string;
  actionLabel: string;
  actionVariant?: "primary" | "success" | "danger";
  loading?: boolean;
  showReason?: boolean;
  showEvidence?: boolean;
  evidenceType?: EvidenceType;
}

export interface EvidenceInput {
  title: string;
  description: string;
  file_url: string;
  type: EvidenceType;
}

export function ReviewDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionLabel,
  actionVariant = "primary",
  loading = false,
  showReason = true,
  showEvidence = false,
  evidenceType = "process",
}: ReviewDialogProps) {
  const [reason, setReason] = useState("");
  const [evidences, setEvidences] = useState<EvidenceInput[]>([]);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setEvidences([]);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm({ reason, evidences });
  };

  const handleClose = () => {
    setReason("");
    setEvidences([]);
    onClose();
  };

  const addEvidence = () => {
    setEvidences([
      ...evidences,
      { title: "", description: "", file_url: "", type: evidenceType },
    ]);
  };

  const removeEvidence = (index: number) => {
    setEvidences(evidences.filter((_, i) => i !== index));
  };

  const updateEvidence = (
    index: number,
    field: keyof EvidenceInput,
    value: string
  ) => {
    const newEvidences = [...evidences];
    (newEvidences[index] as any)[field] = value;
    setEvidences(newEvidences);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button
            variant={actionVariant}
            onClick={handleConfirm}
            loading={loading}
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {showReason && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              原因说明
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="请输入原因说明..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        )}

        {showEvidence && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                证据材料
              </label>
              <button
                type="button"
                onClick={addEvidence}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                + 添加证据
              </button>
            </div>
            <div className="space-y-3">
              {evidences.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-md">
                  暂无证据材料，点击上方按钮添加
                </p>
              )}
              {evidences.map((evidence, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      证据 {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(index)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      删除
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="证据标题"
                    value={evidence.title}
                    onChange={(e) =>
                      updateEvidence(index, "title", e.target.value)
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <textarea
                    placeholder="证据描述"
                    value={evidence.description}
                    onChange={(e) =>
                      updateEvidence(index, "description", e.target.value)
                    }
                    rows={2}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                  <div className="text-xs text-gray-400 mb-1">
                    类型：{EVIDENCE_TYPE_LABELS[evidence.type]}
                  </div>
                  <input
                    type="text"
                    placeholder="文件链接（模拟）"
                    value={evidence.file_url}
                    onChange={(e) =>
                      updateEvidence(index, "file_url", e.target.value)
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
