<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string = '';
  export let show: boolean = false;
  export let footer: boolean = true;
  export let size: 'small' | 'medium' | 'large' = 'medium';

  const dispatch = createEventDispatcher();

  $: width = size === 'small' ? '400px' : size === 'large' ? '700px' : '500px';

  function handleClose() {
    dispatch('close');
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleOverlayClick}>
    <div class="modal" style="max-width: {width};">
      <div class="modal-header">
        <h3 class="modal-title">{title}</h3>
        <button class="modal-close" on:click={handleClose} aria-label="关闭">
          ×
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      {#if footer}
        <div class="modal-footer">
          <slot name="footer">
            <button class="btn btn-default" on:click={handleClose}>关闭</button>
          </slot>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .modal-close {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    color: #6b7280;
    font-size: 20px;
    border: none;
    background: none;
  }

  .modal-close:hover {
    background: #f3f4f6;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
</style>
