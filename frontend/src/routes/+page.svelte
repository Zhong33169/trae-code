<script>
	import { api } from '$lib/api';
	import { auth, login } from '$lib/store';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let username = '';
	let password = '';
	let loading = false;
	let error = '';

	const demoAccounts = [
		{ username: 'registrar', name: '张登记', role: '媒介计划登记员' },
		{ username: 'auditor', name: '李审核', role: '媒介计划审核主管' },
		{ username: 'reviewer', name: '王复核', role: '广告代理公司复核负责人' }
	];

	onMount(() => {
		if ($auth.token) {
			goto('/dashboard');
		}
	});

	async function handleLogin() {
		if (!username || !password) {
			error = '请输入用户名和密码';
			return;
		}

		loading = true;
		error = '';

		try {
			const result = await api.login(username, password);
			login(result.token, result.user);
			goto('/dashboard');
		} catch (e) {
			error = e.message || '登录失败';
		} finally {
			loading = false;
		}
	}

	function quickLogin(acc) {
		username = acc.username;
		password = '123456';
		handleLogin();
	}
</script>

<div class="login-page">
	<div class="login-card">
		<div class="login-header">
			<div class="logo">📋</div>
			<h1>媒介计划单管理系统</h1>
			<p>Media Plan Management System</p>
		</div>

		<form class="login-form" on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label>用户名</label>
				<input
					type="text"
					bind:value={username}
					placeholder="请输入用户名"
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label>密码</label>
				<input
					type="password"
					bind:value={password}
					placeholder="请输入密码"
					disabled={loading}
				/>
			</div>

			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<button type="submit" class="login-btn" disabled={loading}>
				{loading ? '登录中...' : '登 录'}
			</button>
		</form>

		<div class="demo-section">
			<div class="demo-title">演示账号（密码：123456）</div>
			<div class="demo-accounts">
				{#each demoAccounts as acc}
					<button class="demo-account-btn" on:click={() => quickLogin(acc)} disabled={loading}>
						<span class="acc-name">{acc.name}</span>
						<span class="acc-role">{acc.role}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%);
		padding: 20px;
	}

	.login-card {
		background: white;
		border-radius: 16px;
		padding: 40px;
		width: 100%;
		max-width: 420px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.login-header {
		text-align: center;
		margin-bottom: 32px;
	}

	.logo {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.login-header h1 {
		font-size: 24px;
		color: #1e293b;
		margin: 0 0 8px 0;
		font-weight: 600;
	}

	.login-header p {
		color: #64748b;
		margin: 0;
		font-size: 14px;
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group label {
		font-size: 14px;
		color: #334155;
		font-weight: 500;
	}

	.form-group input {
		padding: 12px 14px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-size: 14px;
		transition: border-color 0.2s, box-shadow 0.2s;
		outline: none;
	}

	.form-group input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-group input:disabled {
		background: #f1f5f9;
		cursor: not-allowed;
	}

	.error-message {
		background: #fef2f2;
		color: #dc2626;
		padding: 10px 14px;
		border-radius: 8px;
		font-size: 13px;
		border: 1px solid #fecaca;
	}

	.login-btn {
		margin-top: 8px;
		padding: 12px;
		background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		transition: transform 0.1s, box-shadow 0.2s;
	}

	.login-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.demo-section {
		margin-top: 28px;
		padding-top: 24px;
		border-top: 1px solid #e2e8f0;
	}

	.demo-title {
		font-size: 13px;
		color: #64748b;
		text-align: center;
		margin-bottom: 14px;
	}

	.demo-accounts {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.demo-account-btn {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.demo-account-btn:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.acc-name {
		font-weight: 500;
		color: #1e293b;
		font-size: 14px;
	}

	.acc-role {
		font-size: 12px;
		color: #64748b;
	}
</style>
