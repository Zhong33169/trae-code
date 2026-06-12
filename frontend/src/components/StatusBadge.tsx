const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '待建单', color: 'var(--text-light)' },
  pending_verify: { label: '待核实', color: 'var(--warning)' },
  pending_approve: { label: '待复核', color: 'var(--primary)' },
  approved: { label: '已通过', color: 'var(--success)' },
  rejected: { label: '已驳回', color: 'var(--danger)' },
  completed: { label: '已完结', color: 'var(--success)' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge(props: StatusBadgeProps) {
  const info = () => STATUS_MAP[props.status] || { label: props.status, color: 'var(--text-light)' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 500,
      background: `${info().color}18`,
      color: info().color,
    }}>
      {info().label}
    </span>
  );
}
