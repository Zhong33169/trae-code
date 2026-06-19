import { useState } from "react";
import { useLoaderData, useNavigate, useActionData, Form, useNavigation, redirect } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import { fetchApi } from "~/utils/api";
import type { Appeal, OperationRecord, ProcessRequest, ResubmitRequest, Status, Action, AnomalyType } from "~/utils/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ANOMALY_LABELS,
  ACTION_LABELS,
  ROLE_LABELS,
  STATUS_BAR_COLORS,
  FAILURE_TYPE_LABELS,
  FAILURE_TYPE_COLORS,
} from "~/utils/types";
import { useUser } from "~/utils/store";

interface AppealDetail {
  appeal: Appeal;
  operation_records: OperationRecord[];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const detail = await fetchApi<AppealDetail>(`/appeals/${params.id}`);
  return detail;
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const operatorId = formData.get("operator_id") as string;
  const version = Number(formData.get("version"));

  try {
    if (intent === "resubmit") {
      const evidenceStr = formData.get("evidence_urls") as string;
      const payload: ResubmitRequest = {
        opinion: formData.get("opinion") as string,
        evidence_urls: evidenceStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        operator_id: operatorId,
        version,
      };
      await fetchApi<void>(`/appeals/${params.id}/resubmit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } else {
      const payload: ProcessRequest = {
        action: intent as "approve" | "reject" | "return",
        opinion: formData.get("opinion") as string,
        operator_id: operatorId,
        version,
      };
      await fetchApi<void>(`/appeals/${params.id}/process`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    return redirect(".");
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function InfoCard({ appeal }: { appeal: Appeal }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif font-bold text-gray-900">
          {appeal.appeal_no}
        </h3>
        <StatusBadge status={appeal.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">来访人</span>
          <p className="font-medium text-gray-900">{appeal.visitor_name}</p>
        </div>
        <div>
          <span className="text-gray-500">联系电话</span>
          <p className="font-medium text-gray-900">{appeal.visitor_phone}</p>
        </div>
        <div>
          <span className="text-gray-500">预约日期</span>
          <p className="font-medium text-gray-900">{appeal.appointment_date}</p>
        </div>
        <div>
          <span className="text-gray-500">异常类型</span>
          <p className="font-medium text-gray-900">
            {ANOMALY_LABELS[appeal.anomaly_type]}
          </p>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">申诉描述</span>
          <p className="font-medium text-gray-900 mt-1">{appeal.description}</p>
        </div>
        {appeal.evidence_urls.length > 0 && (
          <div className="col-span-2">
            <span className="text-gray-500">证据材料</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {appeal.evidence_urls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={12} />
                  证据 {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-gray-500">当前处理人</span>
          <p className="font-medium text-gray-900">{appeal.current_handler_name}</p>
        </div>
        <div>
          <span className="text-gray-500">版本号</span>
          <p className="font-medium text-gray-900">v{appeal.version}</p>
        </div>
      </div>
    </div>
  );
}

function PrevHandlerInfo({ records, currentUserId }: { records: OperationRecord[]; currentUserId: string }) {
  const prev = [...records].reverse().find((r) => r.operator_id !== currentUserId && r.action !== "validation_failed");
  if (!prev) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-amber-800 mb-2">上一步处理信息</h4>
      <div className="text-sm space-y-1">
        <p>
          <span className="text-amber-600">处理人:</span>{" "}
          <span className="font-medium text-amber-900">{prev.operator_name}</span>
          <span className="text-amber-600 ml-2">({ROLE_LABELS[prev.operator_role]})</span>
        </p>
        <p className="flex items-center gap-2 flex-wrap">
          <span className="text-amber-600">操作:</span>{" "}
          <span className="font-medium text-amber-900">{ACTION_LABELS[prev.action]}</span>
          {prev.failure_type && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FAILURE_TYPE_COLORS[prev.failure_type] || "bg-gray-100 text-gray-700"}`}>
              {FAILURE_TYPE_LABELS[prev.failure_type] || prev.failure_type}
            </span>
          )}
          {prev.original_version != null && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
              原版本: v{prev.original_version}
            </span>
          )}
        </p>
        {(prev.from_status || prev.to_status) && (
          <p className="text-xs text-gray-500">
            {STATUS_LABELS[prev.from_status]} → {STATUS_LABELS[prev.to_status]}
          </p>
        )}
        {prev.opinion && (
          <p>
            <span className="text-amber-600">意见:</span>{" "}
            <span className="text-amber-900">{prev.opinion}</span>
          </p>
        )}
        {prev.request_summary && (
          <p className="text-xs text-gray-500">{prev.request_summary}</p>
        )}
        {prev.failure_reason && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700 text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              失败原因
            </p>
            <p className="text-red-600 text-xs mt-1">{prev.failure_reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Timeline({ records }: { records: OperationRecord[] }) {
  const sorted = [...records].reverse();

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h3 className="text-lg font-serif font-bold text-gray-900 mb-4">处理记录</h3>
      {sorted.length === 0 && (
        <p className="text-sm text-gray-400">暂无处理记录</p>
      )}
      <div className="relative">
        {sorted.map((record, idx) => {
          const isValidationFailed = record.action === "validation_failed";
          const dotColor =
            record.action === "approve" || record.action === "archive"
              ? "bg-green-500"
              : record.action === "reject"
              ? "bg-red-500"
              : record.action === "return"
              ? "bg-amber-500"
              : isValidationFailed
              ? "bg-red-500"
              : "bg-blue-500";

          return (
            <div key={record.id} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full shrink-0 ${dotColor} ring-2 ring-white`} />
                {idx < sorted.length - 1 && (
                  <div className={`w-px flex-1 mt-1 ${isValidationFailed ? "border-l border-dashed border-red-300" : "bg-gray-200"}`} />
                )}
              </div>
              <div className={`flex-1 -mt-0.5 ${isValidationFailed ? "p-3 border border-dashed border-red-200 rounded-lg bg-red-50/50" : ""}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">
                    {record.operator_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {ROLE_LABELS[record.operator_role]}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    record.action === "approve" || record.action === "archive"
                      ? "bg-green-100 text-green-700"
                      : record.action === "reject"
                      ? "bg-red-100 text-red-700"
                      : record.action === "return"
                      ? "bg-amber-100 text-amber-700"
                      : isValidationFailed
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {(isValidationFailed || record.failure_reason) && <AlertTriangle className="inline w-3 h-3 mr-1 -mt-0.5" />}
                    {ACTION_LABELS[record.action]}
                  </span>
                  {record.failure_type && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FAILURE_TYPE_COLORS[record.failure_type] || "bg-gray-100 text-gray-700"}`}>
                      {FAILURE_TYPE_LABELS[record.failure_type] || record.failure_type}
                    </span>
                  )}
                  {record.original_version != null && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                      原版本: v{record.original_version}
                    </span>
                  )}
                </div>
                {(record.from_status || record.to_status) && (
                  <p className="text-xs text-gray-400 mb-1">
                    {STATUS_LABELS[record.from_status]} → {STATUS_LABELS[record.to_status]}
                  </p>
                )}
                {record.request_summary && (
                  <p className="text-xs text-gray-400 mb-1">{record.request_summary}</p>
                )}
                {record.opinion && (
                  <p className="text-sm text-gray-600 mb-1">{record.opinion}</p>
                )}
                {record.failure_reason && (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      失败原因
                    </p>
                    <p className="text-sm text-red-600 mt-1 ml-5">{record.failure_reason}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>
                    {new Date(record.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionForm({ appeal }: { appeal: Appeal }) {
  const { currentUser } = useUser();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isHandler = currentUser.id === appeal.current_handler_id;
  if (!isHandler) return null;

  const isReviewer = currentUser.role === "reviewer" && appeal.status === "pending_review";
  const isRechecker = currentUser.role === "rechecker" && appeal.status === "pending_recheck";
  const isRegistrar = currentUser.role === "registrar" && (appeal.status === "returned" || appeal.status === "rejected");

  if (!isReviewer && !isRechecker && !isRegistrar) return null;

  const [selectedAction, setSelectedAction] = useState<"approve" | "reject" | "return">("approve");
  const [evidenceInput, setEvidenceInput] = useState(appeal.evidence_urls.join(", "));

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <h3 className="text-lg font-serif font-bold text-gray-900 mb-4">处理操作</h3>

      {actionData?.error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-4">
        <input type="hidden" name="operator_id" value={currentUser.id} />
        <input type="hidden" name="version" value={appeal.version} />

        {(isReviewer || isRechecker) && (
          <div className="flex gap-3">
            {(["approve", "reject", "return"] as const).map((act) => (
              <label
                key={act}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedAction === act
                    ? act === "approve"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : act === "reject"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="intent"
                  value={act}
                  checked={selectedAction === act}
                  onChange={() => setSelectedAction(act)}
                  className="sr-only"
                />
                {ACTION_LABELS[act]}
              </label>
            ))}
          </div>
        )}

        {isRegistrar && (
          <input type="hidden" name="intent" value="resubmit" />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            处理意见
          </label>
          <textarea
            name="opinion"
            required
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {isRegistrar && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              证据链接（逗号分隔）
            </label>
            <input
              type="text"
              name="evidence_urls"
              value={evidenceInput}
              onChange={(e) => setEvidenceInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: "#1e3a5f" }}
        >
          {isSubmitting
            ? "提交中..."
            : isRegistrar
            ? "再次提交"
            : "提交处理"}
        </button>
      </Form>
    </div>
  );
}

export default function AppealDetail() {
  const detail = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { currentUser } = useUser();

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回队列
      </button>

      <div className="space-y-5">
        <InfoCard appeal={detail.appeal} />
        <PrevHandlerInfo records={detail.operation_records} currentUserId={currentUser.id} />
        <Timeline records={detail.operation_records} />
        <ActionForm appeal={detail.appeal} />
      </div>
    </div>
  );
}
