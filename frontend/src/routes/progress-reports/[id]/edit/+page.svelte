<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import { progressReportsApi } from '$api';
  import { showToast, currentUser } from '$stores';
  import { canEditReport } from '$utils/permissions';
  import { formatDate } from '$utils/format';

  export let data: PageData;

  $: report = data.report;
  $: users = data.users;
  $: user = $currentUser;
  $: reportId = $page.params.id;

  let formData = {
    title: report.title,
    content: report.content || '',
    deadline: formatDate(report.deadline),
    reportDate: report.reportDate ? formatDate(report.reportDate) : '',
    projectName: report.projectName || '',
    abnormalReason: report.abnormalReason || '',
    responsiblePersonId: report.responsiblePersonId || '',
  };

  let submitting = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (!formData.title) {
      showToast('请输入报告标题', 'error');
      return;
    }
    if (!formData.deadline) {
      showToast('请选择截止时间', 'error');
      return;
    }

    submitting = true;
    try {
      await progressReportsApi.update(reportId, formData);
      showToast('保存成功', 'success');
      goto(`/progress-reports/${reportId}`);
    } catch (e) {
      const error = e as Error;
      showToast(error.message || '保存失败', 'error');
    } finally {
      submitting = false;
    }
  }
</script>

{#if !canEditReport(user, report)}
  <div class="no-permission">
    <p>您没有权限编辑此进度报告</p>
    <button class="btn btn-primary" on:click={() => goto(`/progress-reports/${reportId}`)}>返回详情</button>
  </div>
{:else}
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">编辑进度报告</h1>
        <p class="page-subtitle">修改进度报告的基本信息</p>
      </div>
      <button class="btn btn-outline" on:click={() => goto(`/progress-reports/${reportId}`)}>
        返回详情
      </button>
    </div>

    <div class="form-card">
      <form on:submit={handleSubmit} class="report-form">
        <div class="form-row">
          <div class="form-group">
            <label for="title">报告标题 <span class="required">*</span></label>
            <input
              type="text"
              id="title"
              placeholder="请输入报告标题"
              bind:value={formData.title}
              required
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="projectName">项目名称</label>
            <input
              type="text"
              id="projectName"
              placeholder="请输入项目名称"
              bind:value={formData.projectName}
            />
          </div>
          <div class="form-group">
            <label for="reportDate">报告日期</label>
            <input
              type="date"
              id="reportDate"
              bind:value={formData.reportDate}
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deadline">截止时间 <span class="required">*</span></label>
            <input
              type="date"
              id="deadline"
              bind:value={formData.deadline}
              required
            />
          </div>
          <div class="form-group">
            <label for="responsiblePersonId">责任人</label>
            <select
              id="responsiblePersonId"
              bind:value={formData.responsiblePersonId}
            >
              <option value="">请选择责任人</option>
              {#each users as u}
                <option value={u.id}>{u.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="content">报告内容</label>
            <textarea
              id="content"
              rows="4"
              placeholder="请输入报告内容"
              bind:value={formData.content}
            ></textarea>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="abnormalReason">异常原因</label>
            <textarea
              id="abnormalReason"
              rows="3"
              placeholder="如有异常请填写原因"
              bind:value={formData.abnormalReason}
            ></textarea>
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn btn-outline"
            on:click={() => goto(`/progress-reports/${reportId}`)}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? '保存中...' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .no-permission {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
  }

  .no-permission p {
    margin-bottom: 20px;
    font-size: 16px;
  }

  .page-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 4px 0;
  }

  .page-subtitle {
    color: #6b7280;
    font-size: 14px;
    margin: 0;
  }

  .form-card {
    background: white;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .report-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr);
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  .required {
    color: #ef4444;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 10px 14px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
  }
</style>
