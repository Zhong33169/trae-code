<script>
	import { page } from '$app/stores';
	import { auth, roleNames, logout } from '$lib/store';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let isLoggedIn = false;
	let currentUser = null;

	$: {
		if ($auth.user) {
			isLoggedIn = true;
			currentUser = $auth.user;
		} else {
			isLoggedIn = false;
			currentUser = null;
		}
	}

	function logoutHandler() {
		logout();
		goto('/');
	}

	onMount(() => {
		const path = $page.url.pathname;
		if (path !== '/' && !$auth.token) {
			goto('/');
		}
	});
</script>

<div class="app-container">
	{#if isLoggedIn && $page.url.pathname !== '/'}
		<header class="app-header">
			<div class="header-left">
				<h1>📋 媒介计划单管理系统</h1>
			</div>
			<div class="header-right">
				<div class="user-info">
					<span class="user-name">{currentUser?.real_name}</span>
					<span class="user-role">{roleNames[currentUser?.role] || currentUser?.role}</span>
				</div>
				<button class="logout-btn" on:click={logoutHandler}>退出</button>
			</div>
		</header>
	{/if}

	<main class="app-main">
		<slot />
	</main>
</div>

<style>
	.app-container {
		min-height: 100vh;
		background: #f1f5f9;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.app-header {
		background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
		color: white;
		padding: 0 24px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.header-left h1 {
		font-size: 18px;
		font-weight: 600;
		margin: 0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.user-name {
		font-size: 14px;
		font-weight: 500;
	}

	.user-role {
		font-size: 12px;
		opacity: 0.8;
	}

	.logout-btn {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 6px 16px;
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		transition: background 0.2s;
	}

	.logout-btn:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.app-main {
		padding: 20px;
	}
</style>
