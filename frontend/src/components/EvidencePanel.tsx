import React, { useEffect, useState } from "react";
import { useOrderStore } from "../stores/orderStore";
import { useAuthStore } from "../stores/authStore";
import type { Evidence, EvidenceType } from "../lib/types";
import { EVIDENCE_TYPE_LABEL, EVIDENCE_TYPE_COLOR, STATUS_LABEL } from "../lib/types";
import { api } from "../lib/api";
import {
  FileCheck,
  Upload,
  ClipboardList,
  Archive,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

interface EvidencePanelProps {
  orderId: string | null;
}

const EVIDENCE_ICONS: Record<EvidenceType, React.ReactNode> = {
  registration: <ClipboardList className="w-4 h-4" />,
  verification: <FileCheck className="w-4 h-4" />,
  archive: <Archive className="w-4 h-4" />,
};

export default function EvidencePanel({ orderId }: EvidencePanelProps) {
  const { selectedOrder, fetchOrderDetail } = useOrderStore();
  const { user } = useAuthStore();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["registration", "verification", "archive"])
  );
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<EvidenceType>("registration");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail(orderId);
      loadEvidence(orderId);
    }
  }, [orderId]);

  const loadEvidence = async (id: string) => {
    const res = await api.evidence.list(id);
    if (res.success && res.data) {
      setEvidence(res.data);
    }
  };

  const toggleSection = (type: string) => {
    const next = new Set(expandedSections);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setExpandedSections(next);
  };

  const handleUpload = async () => {
    if (!orderId || !uploadFileName.trim()) return;
    setUploading(true);
    setUploadError(null);
    const res = await api.evidence.upload(orderId, {
      type: uploadType,
      file_name: uploadFileName.trim(),
      description: uploadDesc.trim(),
    });
    if (res.success) {
      setUploadFileName("");
      setUploadDesc("");
      setShowUpload(false);
      loadEvidence(orderId);
      fetchOrderDetail(orderId);
    } else {
      setUploadError(res.error?.message || "上传失败");
    }
    setUploading(false);
  };

  const canUpload =
    user?.role === "registrar" ||
    user?.role === "reviewer" ||
    user?.role === "archiver";

  const groupedEvidence: Record<string, Evidence[]> = {
    registration: evidence.filter((e) => e.type === "registration"),
    verification: evidence.filter((e) => e.type === "verification"),
    archive: evidence.filter((e) => e.type === "archive"),
  };

  if (!orderId) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        选择一条单据查看证据
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">关键证据</h3>
          {canUpload && (
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-indigo-900 text-white hover:bg-indigo-800 transition-colors"
            >
              <Upload className="w-3 h-3" />
              上传证据
            </button>
          )}
        </div>
        {selectedOrder && (
          <div className="mt-1 text-xs text-slate-500">
            {selectedOrder.order_no} · {STATUS_LABEL[selectedOrder.status]} · v{selectedOrder.version}
          </div>
        )}
      </div>

      {showUpload && (
        <div className="p-3 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-800">上传证据</span>
            <button onClick={() => setShowUpload(false)}>
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as EvidenceType)}
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm mb-2 bg-white"
          >
            <option value="registration">登记证据</option>
            <option value="verification">核验证据</option>
            <option value="archive">归档证据</option>
          </select>
          <input
            type="text"
            value={uploadFileName}
            onChange={(e) => setUploadFileName(e.target.value)}
            placeholder="文件名（如：检验报告.pdf）"
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm mb-2"
          />
          <input
            type="text"
            value={uploadDesc}
            onChange={(e) => setUploadDesc(e.target.value)}
            placeholder="证据描述"
            className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm mb-2"
          />
          {uploadError && (
            <div className="text-xs text-red-600 mb-2">{uploadError}</div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || !uploadFileName.trim()}
            className="w-full py-1.5 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
          >
            {uploading ? "上传中..." : "确认上传"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {(["registration", "verification", "archive"] as EvidenceType[]).map((type) => (
          <div key={type} className="border-b border-slate-100">
            <button
              onClick={() => toggleSection(type)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <span className={`p-1 rounded ${EVIDENCE_TYPE_COLOR[type]} border`}>
                {EVIDENCE_ICONS[type]}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {EVIDENCE_TYPE_LABEL[type]}
              </span>
              <span className="text-xs text-slate-400">
                ({groupedEvidence[type].length})
              </span>
              <div className="flex-1" />
              {expandedSections.has(type) ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
            {expandedSections.has(type) && (
              <div className="px-4 pb-2">
                {groupedEvidence[type].length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 pl-6">暂无证据</div>
                ) : (
                  groupedEvidence[type].map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2 py-1.5 pl-6"
                    >
                      <FileCheck className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">
                          {ev.file_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {ev.description} · {ev.uploader_name || ev.uploaded_by}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
