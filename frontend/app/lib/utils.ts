import type { Status, Role } from "./types";

export const STAGE_REQUIRED_EVIDENCES: Record<string, string[]> = {
  need: ["need_document"],
  quotation: ["need_document", "quotation_sheet"],
  contract: ["need_document", "quotation_sheet", "contract"],
};

export function getStatusBadgeClass(status: Status): string {
  const map: Record<Status, string> = {
    draft: "badge-gray",
    submitted: "badge-blue",
    under_review: "badge-blue",
    returned: "badge-yellow",
    approved: "badge-green",
    rejected: "badge-red",
    appeal_submitted: "badge-purple",
    appeal_under_review: "badge-purple",
    appeal_approved: "badge-green",
    appeal_rejected: "badge-red",
    overdue: "badge-orange",
    archived: "badge-gray",
  };
  return map[status] || "badge-gray";
}

export function getRoleBadgeClass(role: Role): string {
  const map: Record<Role, string> = {
    registrar: "badge-blue",
    supervisor: "badge-purple",
    reviewer: "badge-orange",
  };
  return map[role] || "badge-gray";
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function formatCurrency(value?: number): string {
  if (value === undefined || value === null) return "-";
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}

export function getMissingEvidences(
  stage: string,
  evidences: { evidence_type: string }[]
): string[] {
  const required = STAGE_REQUIRED_EVIDENCES[stage] || [];
  const existing = new Set(evidences.map((e) => e.evidence_type));
  return required.filter((t) => !existing.has(t));
}

export function isEvidenceRequired(stage: string, evidenceType: string): boolean {
  const required = STAGE_REQUIRED_EVIDENCES[stage] || [];
  return required.includes(evidenceType);
}
