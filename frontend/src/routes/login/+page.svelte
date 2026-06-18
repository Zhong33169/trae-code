<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';

  export let data: PageData;
  export let form: { error?: string } | null = null;
</script>

<div class="login-card">
  <div class="login-header">
    <h1>进度报告管理系统</h1>
    <p>工程项目进度验收管理平台</p>
  </div>

  <form method="POST" use:enhance class="login-form">
    {#if form?.error}
      <div class="error-message">{form.error}</div>
    {/if}

    <div class="form-group">
      <label for="username">用户名</label>
      <input
        type="text"
        id="username"
        name="username"
        placeholder="请输入用户名"
        required
        autocomplete="username"
      />
    </div>

    <div class="form-group">
      <label for="password">密码</label>
      <input
        type="password"
        id="password"
        name="password"
        placeholder="请输入密码"
        required
        autocomplete="current-password"
      />
    </div>

    <button type="submit" class="btn btn-primary btn-block">登录</button>
  </form>

  <div class="login-footer">
    <h4>测试账号：</h4>
    <ul>
      <li><strong>进度登记员：</strong>registrar / 123456</li>
      <li><strong>进度审核主管：</strong>supervisor / 123456</li>
      <li><strong>工程监理：</strong>engineer / 123456</li>
    </ul>
  </div>
</div>

<style>
  .login-card {
    background: white;
    border-radius: 12px;
    padding: 40px;
    width: 420px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .login-header h1 {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
  }

  .login-header p {
    color: #6b7280;
    font-size: 14px;
    margin: 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
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

  .form-group input {
    padding: 12px 16px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .btn-block {
    width: 100%;
    padding: 12px;
    font-size: 16px;
  }

  .login-footer {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
  }

  .login-footer h4 {
    font-size: 13px;
    color: #6b7280;
    margin: 0 0 12px 0;
    font-weight: 500;
  }

  .login-footer ul {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 12px;
    color: #9ca3af;
    line-height: 1.8;
  }

  .login-footer strong {
    color: #6b7280;
    font-weight: 500;
  }
</style>
