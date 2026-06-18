import {
  Role,
  ProgressStatus,
  TimeoutStatus,
} from '$types';
import type { User, ProgressReport } from '$types';

export function canCreateReport(user: User | null | undefined): boolean {
  return !!user && user.role === Role.REGISTRAR;
}

export function canEditReport(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (user.role === Role.SUPERVISOR_ENGINEER) return true;
  if (user.role === Role.REGISTRAR && report.responsiblePersonId === user.id) {
    return [ProgressStatus.DRAFT, ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
      report.status,
    );
  }
  return false;
}

export function canSubmitReview(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (user.role === Role.REGISTRAR && report.responsiblePersonId === user.id) {
    return [ProgressStatus.DRAFT, ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
      report.status,
    );
  }
  return false;
}

export function canStartReview(user: User | null | undefined, report: ProgressReport): boolean {
  return (
    !!user &&
    user.role === Role.SUPERVISOR &&
    report.status === ProgressStatus.PENDING_REVIEW
  );
}

export function canReview(user: User | null | undefined, report: ProgressReport): boolean {
  return (
    !!user &&
    user.role === Role.SUPERVISOR &&
    [ProgressStatus.PENDING_REVIEW, ProgressStatus.UNDER_REVIEW].includes(report.status)
  );
}

export function canStartVerification(user: User | null | undefined, report: ProgressReport): boolean {
  return (
    !!user &&
    user.role === Role.SUPERVISOR_ENGINEER &&
    report.status === ProgressStatus.PENDING_VERIFICATION
  );
}

export function canVerify(user: User | null | undefined, report: ProgressReport): boolean {
  return (
    !!user &&
    user.role === Role.SUPERVISOR_ENGINEER &&
    [ProgressStatus.PENDING_VERIFICATION, ProgressStatus.UNDER_VERIFICATION].includes(report.status)
  );
}

export function canCorrect(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (user.role === Role.REGISTRAR && report.responsiblePersonId === user.id) {
    return [ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
      report.status,
    );
  }
  return false;
}

export function canHandleTimeout(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (report.timeoutStatus !== TimeoutStatus.OVERDUE) return false;
  if (user.role === Role.SUPERVISOR_ENGINEER) return true;
  if (user.role === Role.SUPERVISOR) return true;
  if (user.role === Role.REGISTRAR && report.responsiblePersonId === user.id) return true;
  return false;
}

export function canDeleteReport(user: User | null | undefined, report: ProgressReport): boolean {
  return (
    !!user &&
    user.role === Role.SUPERVISOR_ENGINEER &&
    [ProgressStatus.DRAFT, ProgressStatus.ARCHIVED].includes(report.status)
  );
}

export function canViewAllReports(user: User | null | undefined): boolean {
  return (
    !!user &&
    [Role.SUPERVISOR, Role.SUPERVISOR_ENGINEER].includes(user.role)
  );
}

export function canCreateWeeklyReport(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (report.status === ProgressStatus.ARCHIVED) return false;
  if (user.role === Role.REGISTRAR && report.responsiblePersonId === user.id) return true;
  return false;
}

export function canCreateDeviationAnalysis(
  user: User | null | undefined,
  report: ProgressReport,
): boolean {
  if (!user) return false;
  if (user.role !== Role.SUPERVISOR) return false;
  return [
    ProgressStatus.UNDER_REVIEW,
    ProgressStatus.UNDER_VERIFICATION,
    ProgressStatus.PENDING_REVIEW,
    ProgressStatus.PENDING_VERIFICATION,
  ].includes(report.status);
}

export function canApproveDeviationAnalysis(
  user: User | null | undefined,
  report: ProgressReport,
): boolean {
  if (!user) return false;
  if (user.role !== Role.SUPERVISOR_ENGINEER) return false;
  return [ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
    report.status,
  );
}

export function canCreateOwnerReport(
  user: User | null | undefined,
  report: ProgressReport,
): boolean {
  if (!user) return false;
  if (user.role !== Role.SUPERVISOR) return false;
  return [ProgressStatus.PENDING_VERIFICATION, ProgressStatus.UNDER_VERIFICATION].includes(
    report.status,
  );
}

export function canAcknowledgeOwnerReport(
  user: User | null | undefined,
  report: ProgressReport,
): boolean {
  if (!user) return false;
  if (user.role !== Role.SUPERVISOR_ENGINEER) return false;
  return report.status === ProgressStatus.UNDER_VERIFICATION;
}

export function canBatchProcess(user: User | null | undefined, report: ProgressReport): boolean {
  if (!user) return false;
  if (user.role === Role.REGISTRAR) {
    return [ProgressStatus.DRAFT, ProgressStatus.REVIEW_REJECTED, ProgressStatus.VERIFICATION_REJECTED].includes(
      report.status,
    );
  }
  if (user.role === Role.SUPERVISOR || user.role === Role.SUPERVISOR_ENGINEER) {
    return report.timeoutStatus === TimeoutStatus.OVERDUE;
  }
  return false;
}

export function getAvailableActions(user: User | null | undefined, report: ProgressReport) {
  return {
    edit: canEditReport(user, report),
    submit: canSubmitReview(user, report),
    startReview: canStartReview(user, report),
    review: canReview(user, report),
    startVerification: canStartVerification(user, report),
    verify: canVerify(user, report),
    correct: canCorrect(user, report),
    handleTimeout: canHandleTimeout(user, report),
    delete: canDeleteReport(user, report),
  };
}
