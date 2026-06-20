import {
  CONFIRMATION_ORDER_STATUS_LABELS,
  CONFIRMATION_ORDER_STATUS_COLORS,
  PAYMENT_VERIFICATION_STATUS_LABELS,
  PAYMENT_VERIFICATION_STATUS_COLORS,
  type ConfirmationOrderStatus,
  type PaymentVerificationStatus,
} from '@/lib/constants';

interface StatusBadgeProps {
  status: ConfirmationOrderStatus | PaymentVerificationStatus;
  type?: 'confirmation' | 'payment';
}

export function StatusBadge({ status, type = 'confirmation' }: StatusBadgeProps) {
  const isConfirmation = type === 'confirmation';
  const labels = isConfirmation
    ? CONFIRMATION_ORDER_STATUS_LABELS
    : PAYMENT_VERIFICATION_STATUS_LABELS;
  const colors = isConfirmation
    ? CONFIRMATION_ORDER_STATUS_COLORS
    : PAYMENT_VERIFICATION_STATUS_COLORS;

  const label = (labels as Record<string, string>)[status] || status;
  const color = (colors as Record<string, string>)[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
