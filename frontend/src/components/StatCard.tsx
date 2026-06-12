import { Show } from 'solid-js';

interface StatCardProps {
  label: string;
  value: number | string;
  color?: string;
  icon?: string;
}

export default function StatCard(props: StatCardProps) {
  return (
    <div style={{
      background: 'var(--white)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      boxShadow: 'var(--shadow)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <Show when={props.icon}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: `${props.color || 'var(--primary)'}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          flexShrink: 0,
        }}>
          {props.icon}
        </div>
      </Show>
      <div>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-light)',
          marginBottom: '4px',
        }}>
          {props.label}
        </div>
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: props.color || 'var(--primary)',
        }}>
          {props.value}
        </div>
      </div>
    </div>
  );
}
