import { writable, derived } from 'svelte/store';

const token = writable(null);
const user = writable(null);

if (typeof window !== 'undefined') {
	const savedToken = localStorage.getItem('token');
	const savedUser = localStorage.getItem('user');
	if (savedToken) {
		token.set(savedToken);
	}
	if (savedUser) {
		try {
			user.set(JSON.parse(savedUser));
		} catch {
			// ignore
		}
	}
}

export const auth = derived([token, user], ([$token, $user]) => ({
	token: $token,
	user: $user
}));

export function login(tokenValue, userValue) {
	token.set(tokenValue);
	user.set(userValue);
	if (typeof window !== 'undefined') {
		localStorage.setItem('token', tokenValue);
		localStorage.setItem('user', JSON.stringify(userValue));
	}
}

export function logout() {
	token.set(null);
	user.set(null);
	if (typeof window !== 'undefined') {
		localStorage.removeItem('token');
		localStorage.removeItem('user');
	}
}

export { token, user };

export const roleNames = {
	registrar: '媒介计划登记员',
	auditor: '媒介计划审核主管',
	reviewer: '广告代理公司复核负责人'
};

export const statusNames = {
	draft: '草稿',
	pending_audit: '待审核',
	audit_approved: '审核通过',
	audit_rejected: '审核驳回',
	pending_review: '待复核',
	review_approved: '复核通过',
	review_rejected: '复核驳回',
	archived: '已归档'
};

export const statusColors = {
	draft: '#94a3b8',
	pending_audit: '#f59e0b',
	audit_approved: '#10b981',
	audit_rejected: '#ef4444',
	pending_review: '#8b5cf6',
	review_approved: '#059669',
	review_rejected: '#dc2626',
	archived: '#64748b'
};

export const evidenceTypeNames = {
	client_contract: '客户合同',
	media_quote: '媒体报价单',
	creative_mockup: '创意稿'
};

export const operationNames = {
	create: '创建草稿',
	update: '更新计划',
	submit: '提交审核',
	approve: '审核通过',
	reject: '审核驳回',
	send_to_review: '送复核',
	review: '复核通过',
	review_reject: '复核驳回',
	archive: '归档',
	batch_submit: '批量提交',
	batch_approve: '批量审核通过',
	batch_reject: '批量审核驳回',
	batch_review: '批量复核通过',
	batch_submit_failed: '批量提交失败',
	batch_approve_failed: '批量审核失败',
	batch_reject_failed: '批量驳回失败',
	batch_review_failed: '批量复核失败',
	batch_submit_retry: '批量提交需重试',
	batch_approve_retry: '批量审核需重试',
	batch_reject_retry: '批量驳回需重试',
	batch_review_retry: '批量复核需重试'
};

export const operationColors = {
	create: '#94a3b8',
	update: '#64748b',
	submit: '#f59e0b',
	approve: '#10b981',
	reject: '#ef4444',
	send_to_review: '#8b5cf6',
	review: '#059669',
	review_reject: '#dc2626',
	archive: '#64748b',
	batch_submit: '#f59e0b',
	batch_approve: '#10b981',
	batch_reject: '#ef4444',
	batch_review: '#059669',
	batch_submit_failed: '#dc2626',
	batch_approve_failed: '#dc2626',
	batch_reject_failed: '#dc2626',
	batch_review_failed: '#dc2626',
	batch_submit_retry: '#f59e0b',
	batch_approve_retry: '#f59e0b',
	batch_reject_retry: '#f59e0b',
	batch_review_retry: '#f59e0b'
};
