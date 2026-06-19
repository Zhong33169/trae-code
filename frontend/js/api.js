const API_BASE = window.API_BASE_URL || 'http://localhost:8004';

let currentRole = '';
let currentUserID = '';
let currentUserName = '';

const ROLE_USER_MAP = {
    clerk: 'u1',
    supervisor: 'u2',
    reviewer: 'u3'
};

const ROLE_NAME_MAP = {
    clerk: '知识修登记员',
    supervisor: '知识修审核主管',
    reviewer: '客服呼叫中心复核负责人'
};

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-Role': currentRole,
        'X-User-ID': currentUserID
    };
}

async function apiCall(method, path, body) {
    const opts = {
        method,
        headers: getHeaders()
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${API_BASE}${path}`, opts);
    const data = await resp.json();
    if (data.code !== 0 && data.code !== 201) {
        const err = new Error(data.message || '请求失败');
        err.code = data.code;
        err.failureType = (data.data && data.data.failure_type) || '';
        err.failureReason = (data.data && data.data.failure_reason) || '';
        err.responseData = data.data;
        throw err;
    }
    return data;
}

async function switchRole(role) {
    const userId = ROLE_USER_MAP[role];
    const data = await apiCall('POST', '/api/auth/switch-role', { role, user_id: userId });
    currentRole = role;
    currentUserID = userId;
    currentUserName = ROLE_NAME_MAP[role];
    return data;
}

async function getCurrentUser() {
    const data = await apiCall('GET', '/api/auth/me');
    return data;
}

async function listOrders(params) {
    const query = new URLSearchParams();
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) {
                query.append(k, v);
            }
        });
    }
    const data = await apiCall('GET', `/api/orders?${query.toString()}`);
    return data;
}

async function getOrder(id) {
    const data = await apiCall('GET', `/api/orders/${id}`);
    return data;
}

async function createOrder(data) {
    return await apiCall('POST', '/api/orders', data);
}

async function advanceOrder(id, data) {
    return await apiCall('POST', `/api/orders/${id}/advance`, data);
}

async function returnOrder(id, data) {
    return await apiCall('POST', `/api/orders/${id}/return`, data);
}

async function correctOrder(id, data) {
    return await apiCall('POST', `/api/orders/${id}/correct`, data);
}

async function batchAdvance(data) {
    return await apiCall('POST', '/api/orders/batch-advance', data);
}

async function batchReturn(data) {
    return await apiCall('POST', '/api/orders/batch-return', data);
}

async function getAuditLogs(params) {
    const query = new URLSearchParams();
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            if (v !== '' && v !== undefined && v !== null) {
                query.append(k, v);
            }
        });
    }
    const data = await apiCall('GET', `/api/audit-logs?${query.toString()}`);
    return data;
}

async function getOrderAuditLogs(id) {
    const data = await apiCall('GET', `/api/orders/${id}/audit-logs`);
    return data;
}

async function getStats() {
    const data = await apiCall('GET', '/api/stats');
    return data;
}

async function getKnowledgeItems() {
    const data = await apiCall('GET', '/api/knowledge-items');
    return data;
}
