const API_BASE = '/api';

function getToken() {
	if (typeof window !== 'undefined') {
		return localStorage.getItem('token');
	}
	return null;
}

async function request(url, options = {}) {
	const token = getToken();
	const headers = {
		'Content-Type': 'application/json',
		...options.headers
	};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(`${API_BASE}${url}`, {
		...options,
		headers
	});

	if (!response.ok) {
		let errorData;
		try {
			errorData = await response.json();
		} catch {
			errorData = { message: `请求失败: ${response.status}` };
		}
		const error = new Error(errorData.message || '请求失败');
		error.errorType = errorData.error;
		error.status = response.status;
		throw error;
	}

	return response.json();
}

export const api = {
	login: (username, password) =>
		request('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ username, password })
		}),

	getMe: () => request('/auth/me'),

	getTodoList: () => request('/todo'),

	listPlans: (status) => {
		const url = status ? `/plans?status=${status}` : '/plans';
		return request(url);
	},

	getPlan: (id) => request(`/plans/${id}`),

	createPlan: (data) =>
		request('/plans', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	updatePlan: (id, data) =>
		request(`/plans/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		}),

	submitPlan: (id, version) =>
		request(`/plans/${id}/submit`, {
			method: 'POST',
			body: JSON.stringify({ version })
		}),

	approvePlan: (id, data) =>
		request(`/plans/${id}/approve`, {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	rejectPlan: (id, data) =>
		request(`/plans/${id}/reject`, {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	reviewPlan: (id, data) =>
		request(`/plans/${id}/review`, {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	archivePlan: (id, version) =>
		request(`/plans/${id}/archive`, {
			method: 'POST',
			body: JSON.stringify({ version })
		}),

	batchReview: (data) =>
		request('/plans/batch-review', {
			method: 'POST',
			body: JSON.stringify(data)
		}),

	getSchedules: (planId) => request(`/plans/${planId}/schedules`),

	getBudgets: (planId) => request(`/plans/${planId}/budgets`),

	getEvidences: (planId) => request(`/plans/${planId}/evidences`)
};
