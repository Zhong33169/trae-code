<script lang="ts">
  export let current: number = 1;
  export let total: number = 0;
  export let pageSize: number = 20;
  export let onChange: (page: number) => void;

  $: totalPages = Math.max(1, Math.ceil(total / pageSize));

  function changePage(page: number) {
    if (page >= 1 && page <= totalPages && page !== current) {
      onChange(page);
    }
  }

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= maxVisible; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (current >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  }
</script>

{#if total > 0}
  <div class="pagination">
    <button
      class="pagination-btn"
      disabled={current === 1}
      on:click={() => changePage(1)}
      title="首页"
    >
      «
    </button>
    <button
      class="pagination-btn"
      disabled={current === 1}
      on:click={() => changePage(current - 1)}
      title="上一页"
    >
      ‹
    </button>

    {#each getPageNumbers() as page}
      {#if page === '...'}
        <span class="pagination-ellipsis">...</span>
      {:else}
        <button
          class="pagination-btn {page === current ? 'active' : ''}"
          on:click={() => changePage(Number(page))}
        >
          {page}
        </button>
      {/if}
    {/each}

    <button
      class="pagination-btn"
      disabled={current === totalPages}
      on:click={() => changePage(current + 1)}
      title="下一页"
    >
      ›
    </button>
    <button
      class="pagination-btn"
      disabled={current === totalPages}
      on:click={() => changePage(totalPages)}
      title="末页"
    >
      »
    </button>

    <span class="pagination-info">
      共 {total} 条，第 {current}/{totalPages} 页
    </span>
  </div>
{/if}

<style>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 20px;
    flex-wrap: wrap;
  }

  .pagination-btn {
    padding: 6px 12px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    color: #374151;
    min-width: 32px;
    transition: all 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .pagination-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }

  .pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-ellipsis {
    padding: 6px 8px;
    color: #6b7280;
  }

  .pagination-info {
    margin-left: 12px;
    font-size: 13px;
    color: #6b7280;
  }
</style>
