import { useEffect, useState } from 'react';
import { getUsers } from '@/lib/api';
import type { UserInfo, UserRole } from '@/lib/types';

interface UserSelectorProps {
  value?: { id: number; role: UserRole };
  onChange: (user: { id: number; role: UserRole; name: string }) => void;
  className?: string;
}

export default function UserSelector({ value, onChange, className = '' }: UserSelectorProps) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>(
    value?.role || '客户经理'
  );
  const [selectedUserId, setSelectedUserId] = useState<number>(value?.id || 1);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      if (res.code === 0 && res.data) {
        setUsers(res.data);
        if (!value && res.data.length > 0) {
          const defaultUser = res.data[0];
          setSelectedRole(defaultUser.role);
          setSelectedUserId(defaultUser.id);
          onChange({ id: defaultUser.id, role: defaultUser.role, name: defaultUser.name });
        }
      }
    } catch (error) {
      console.error('加载用户列表失败', error);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    const roleUsers = users.filter((u) => u.role === role);
    if (roleUsers.length > 0) {
      setSelectedUserId(roleUsers[0].id);
      onChange({ id: roleUsers[0].id, role, name: roleUsers[0].name });
    }
  };

  const handleUserChange = (userId: number) => {
    setSelectedUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (user) {
      onChange({ id: user.id, role: user.role, name: user.name });
    }
  };

  const filteredUsers = selectedRole ? users.filter((u) => u.role === selectedRole) : users;

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">选择角色</label>
        <div className="flex gap-2">
          {(['客户经理', '运营主管', '支行行长'] as UserRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleChange(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedRole === role
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">选择处理人</label>
        <select
          value={selectedUserId}
          onChange={(e) => handleUserChange(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {filteredUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.username})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
