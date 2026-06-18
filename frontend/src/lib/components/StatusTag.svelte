<script lang="ts">
  import { ProgressStatus, TimeoutStatus, ProgressStatusLabel, ProgressStatusColor, TimeoutStatusLabel, TimeoutStatusColor } from '$types';

  export let status: ProgressStatus | TimeoutStatus;
  export let type: 'progress' | 'timeout' = 'progress';
  export let size: 'small' | 'medium' | 'large' = 'medium';

  $: label = type === 'progress'
    ? ProgressStatusLabel[status as ProgressStatus]
    : TimeoutStatusLabel[status as TimeoutStatus];
  $: color = type === 'progress'
    ? ProgressStatusColor[status as ProgressStatus]
    : TimeoutStatusColor[status as TimeoutStatus];

  $: bgColor = `${color}20`;
  $: textColor = color;

  $: padding = size === 'small' ? '1px 8px' : size === 'large' ? '4px 14px' : '2px 10px';
  $: fontSize = size === 'small' ? '11px' : size === 'large' ? '13px' : '12px';
</script>

<span class="status-tag" style="background: {bgColor}; color: {textColor}; padding: {padding}; font-size: {fontSize};">
  {label}
</span>

<style>
  .status-tag {
    display: inline-flex;
    align-items: center;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
