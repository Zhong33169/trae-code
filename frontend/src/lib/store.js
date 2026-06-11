import { writable } from 'svelte/store';
import { api } from './api';

const storedRole = typeof localStorage !== 'undefined' ? localStorage.getItem('mco_role') : 'registrar';
const storedUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('mco_user_id') : null;

export const currentRole = writable(storedRole || 'registrar');
export const currentUser = writable(null);
export const users = writable([]);
export const roles = writable([]);

currentRole.subscribe((val) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mco_role', val);
  }
});

export async function loadSystemData() {
  try {
    const [usersData, rolesData] = await Promise.all([
      api.getUsers(),
      api.getRoles()
    ]);
    users.set(usersData);
    roles.set(rolesData);
    
    if (!storedUserId && usersData.length > 0) {
      const firstUser = usersData.find(u => u.role === (storedRole || 'registrar')) || usersData[0];
      setCurrentUser(firstUser);
    } else if (storedUserId) {
      const user = usersData.find(u => u.id === parseInt(storedUserId));
      if (user) {
        currentUser.set(user);
      }
    }
  } catch (e) {
    console.error('Failed to load system data:', e);
  }
}

export function setCurrentUser(user) {
  currentUser.set(user);
  currentRole.set(user.role);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mco_user_id', user.id);
    localStorage.setItem('mco_role', user.role);
  }
}

export const STATUS_LABELS = {
  draft: '草稿',
  pending_review: '待审核主管办理',
  supplement_required: '需补正附件',
  pending_final: '待复核归档',
  returned: '已退回',
  archived: '已归档',
  overdue: '已超时'
};

export const STATUS_COLORS = {
  draft: '#6b7280',
  pending_review: '#2563eb',
  supplement_required: '#d97706',
  pending_final: '#7c3aed',
  returned: '#dc2626',
  archived: '#16a34a',
  overdue: '#991b1b'
};

export const ATTACHMENT_STATUS_LABELS = {
  uploaded: '已上传',
  rejected: '已驳回',
  approved: '已通过'
};

export const ATTACHMENT_STATUS_COLORS = {
  uploaded: '#6b7280',
  rejected: '#dc2626',
  approved: '#16a34a'
};

export const AUDIT_ACTION_LABELS = {
  created: '创建',
  updated: '更新内容',
  submitted: '提交审核',
  approved_supervisor: '审核主管通过',
  rejected_supervisor: '审核主管退回',
  supplemented: '补正附件',
  approved_final: '复核通过归档',
  rejected_final: '复核退回',
  attachment_uploaded: '上传附件',
  attachment_deleted: '删除附件',
  attachment_rejected: '附件驳回',
  attachment_approved: '附件通过',
  remark_added: '添加审计备注',
  marked_overdue: '标记超时',
  operation_failed: '操作失败'
};

export const ROLE_LABELS = {
  registrar: '物料变更登记员',
  supervisor: '物料变更审核主管',
  reviewer: '电子元器件工厂复核负责人'
};
