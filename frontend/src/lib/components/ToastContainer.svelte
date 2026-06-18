<script lang="ts">
  import { removeToast, type ToastItem, type ToastType } from '$stores';

  export let toasts: ToastItem[] = [];

  function getTypeClass(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  }

  function getIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      default:
        return 'i';
    }
  }
</script>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <div class="toast {getTypeClass(toast.type)}">
        <span class="toast-icon">{getIcon(toast.type)}</span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" on:click={() => removeToast(toast.id)} aria-label="关闭">
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 280px;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    font-weight: bold;
    font-size: 12px;
    flex-shrink: 0;
  }

  .toast-message {
    flex: 1;
    min-width: 0;
  }

  .toast-close {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    opacity: 0.8;
    padding: 0 4px;
    line-height: 1;
  }

  .toast-close:hover {
    opacity: 1;
  }
</style>
