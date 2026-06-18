import { component$, useSignal, useTask$, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { useAuthCheck } from '../layout';
import type { Statistics } from '~/types';
import { getStatistics, statusLabels, roleLabels } from '~/utils/api';

export default component$(() => {
  const nav = useNavigate();
  const auth = useAuthCheck();
  const stats = useSignal<Statistics | null>(null);
  const loading = useSignal(true);
  const message = useSignal<{ type: string; text: string } | null>(null);

  const loadStats = $(async () => {
    if (!auth.value.isLoggedIn) return;
    loading.value = true;
    try {
      stats.value = await getStatistics();
    } catch (e: any) {
      message.value = { type: 'error', text: e.message || '加载失败' };
      setTimeout(() => (message.value = null), 3000);
    } finally {
      loading.value = false;
    }
  });

  useTask$(({ track }) => {
    track(() => auth.value.isLoggedIn);
    loadStats();
  });

  const user = auth.value.user;
  const role = user?.role || 'registrar';

  if (loading.value || !stats.value) {
    return (
      <div class="card">
        <div class="empty-state">加载中...</div>
      </div>
    );
  }

  const s = stats.value;

  const allStatusCards = [
    { label: '草稿', value: s.draft, status: 'draft', type: 'default' },
    { label: '待审核', value: s.pending_audit, status: 'submitted', type: 'warning' },
    { label: '审核中', value: s.under_review, status: 'under_review', type: 'info' },
    { label: '待补正', value: s.pending_correction, status: 'correction_requested', type: 'danger' },
    { label: '已补正', value: s.corrected, status: 'corrected', type: 'info' },
    { label: '待复核', value: s.pending_review, status: 'audit_passed', type: 'warning' },
    { label: '复核通过', value: s.review_passed, status: 'review_passed', type: 'success' },
    { label: '已拒绝', value: s.rejected, status: 'rejected', type: 'danger' },
    { label: '已归档', value: s.archived, status: 'archived', type: 'default' },
  ];

  return (
    <div>
      {message.value && (
        <div class={`message message-${message.value.type}`}>{message.value.text}</div>
      )}

      <div class="card">
        <div class="card-title">总体概览</div>
        <div class="stat-cards">
          <div class="stat-card default" style={{ cursor: 'default' }}>
            <div class="stat-label">总申请数</div>
            <div class="stat-value">{s.total}</div>
          </div>
          <div class="stat-card danger" style={{ cursor: 'default' }}>
            <div class="stat-label">逾期申请</div>
            <div class="stat-value">{s.overdue}</div>
          </div>
          <div class="stat-card warning" style={{ cursor: 'default' }}>
            <div class="stat-label">逾期待补正</div>
            <div class="stat-value">{s.correction_overdue}</div>
          </div>
          <div class="stat-card danger" style={{ cursor: 'default' }}>
            <div class="stat-label">逾期待复核</div>
            <div class="stat-value">{s.review_overdue}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">状态分布</div>
        <div class="stat-cards">
          {allStatusCards.map((card) => (
            <div
              key={card.status}
              class={`stat-card ${card.type}`}
              onClick$={() => nav(`/applications?status=${card.status}`)}
            >
              <div class="stat-label">{card.label}</div>
              <div class="stat-value">{card.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div class="card">
        <div class="card-title">角色说明</div>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">当前角色：</div>
            <div class="detail-value">
              {user ? roleLabels[user.role] : '未登录'}
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">当前用户：</div>
            <div class="detail-value">{user?.full_name || '-'}</div>
          </div>
        </div>
        <div style={{ marginTop: '16px', fontSize: '13px', color: '#666', lineHeight: 1.8 }}>
          <p><strong>展商登记员：</strong>创建申请、提交审核、补正材料</p>
          <p><strong>展商审核主管：</strong>开始审核、要求补正、审核通过/拒绝</p>
          <p><strong>主办方复核负责人：</strong>复核通过/退回、归档</p>
          <p><strong>逾期规则：</strong>待审核24h、审核中48h、待补正72h、待复核48h，逾期待说明</p>
        </div>
      </div>
    </div>
  );
});

export const head = {
  title: '统计概览 - 展商申请管理系统',
};
