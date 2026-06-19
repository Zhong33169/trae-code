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
