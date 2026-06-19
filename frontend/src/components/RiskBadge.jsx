import { h } from 'preact';

const CONFIG = {
  high: { label: '高风险', icon: '●' },
  medium: { label: '中风险', icon: '◆' },
  low: { label: '低风险', icon: '▲' },
};

export default function RiskBadge({ level }) {
  const cfg = CONFIG[level] || CONFIG.low;
  return (
    <span class={`risk-badge ${level}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
