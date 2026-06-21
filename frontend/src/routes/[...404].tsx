import { A } from '@solidjs/router';

export default function NotFound() {
  return (
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh; padding: 40px;">
      <div style="font-size: 72px; font-weight: 700; color: var(--gray-300);">404</div>
      <h2 style="margin: 16px 0 8px;">页面不存在</h2>
      <p style="color: var(--gray-500); margin-bottom: 24px;">您访问的页面不存在或已被移除</p>
      <A href="/events" class="btn btn-primary" style="text-decoration: none;">返回首页</A>
    </div>
  );
}