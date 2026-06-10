'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getStats,
  getRecords,
  getUsers,
  getWorkbenchStats,
  getHandledRecords,
} from '@/lib/api';
import {
  StatsResponse,
  BorrowRecord,
  User,
  WorkbenchStats,
  STATUS_MAP,
  EXCEPTION_MAP,
  STATUS_COLORS,
  EXCEPTION_COLORS,
  ROLE_MAP,
} from '@/lib/types';

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [workbenchStats, setWorkbenchStats] = useState<WorkbenchStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [todoRecords, setTodoRecords] = useState<BorrowRecord[]>([]);
  const [recentRecords, setRecentRecords] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo' | 'handled'>('todo');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        getStats(),
        getUsers(),
      ]);
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as StatsResponse);
      }
      if (usersRes.success && usersRes.data) {
        const userList = usersRes.data as User[];
        setUsers(userList);
        const user = userList.find((u) => u.id === selectedUserId) || userList[0];
        if (user) {
          setSelectedUser(user);
          setSelectedUserId(user.id);
        }
      }
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  const loadWorkbench = useCallback(async () => {
    if (!selectedUser) return;
    try {
      const [wbRes, todoRes, handledRes] = await Promise.all([
        getWorkbenchStats(selectedUser.id, selectedUser.role),
        getRecords({ handler_id: String(selectedUser.id) }),
        getHandledRecords(selectedUser.id),
      ]);
      if (wbRes.success && wbRes.data) {
        setWorkbenchStats(wbRes.data as WorkbenchStats);
      }
      if (todoRes.success && todoRes.data) {
        setTodoRecords(todoRes.data as BorrowRecord[]);
      }
      if (handledRes.success && handledRes.data) {
        setRecentRecords((handledRes.data as BorrowRecord[]).slice(0, 8));
      }
    } catch (e) {
      console.error('加载工作台数据失败', e);
    }
  }, [selectedUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const user = users.find((u) => u.id === selectedUserId);
    if (user) setSelectedUser(user);
  }, [selectedUserId, users]);

  useEffect(() => {
    if (selectedUser) {
      loadWorkbench();
    }
  }, [selectedUser, loadWorkbench]);

  const handleUserChange = (userId: number) => {
    setSelectedUserId(userId);
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  const statCards = stats ? [
    { label: '总记录数', value: stats.total, color: 'bg-gray-600' },
    { label: '草稿', value: stats.draft, color: 'bg-gray-400' },
    { label: '待审核', value: stats.pending_audit, color: 'bg-yellow-500' },
    { label: '待复核', value: stats.pending_review, color: 'bg-blue-500' },
    { label: '退回补正', value: stats.returned_correction, color: 'bg-red-500' },
    { label: '已归档', value: stats.archived, color: 'bg-green-500' },
  ] : [];

  const exceptionCards = stats ? [
    { label: '缺证据', value: stats.missing_evidence, color: 'bg-orange-500' },
    { label: '逾期', value: stats.overdue, color: 'bg-red-600' },
    { label: '状态冲突', value: stats.conflict, color: 'bg-purple-500' },
  ] : [];

  const displayRecords = tab === 'todo' ? todoRecords : recentRecords;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="mt-1 text-gray-600">图书馆异常申诉复核借阅记录系统</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">当前身份：</span>
          <select
            value={selectedUserId}
            onChange={(e) => handleUserChange(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm bg-white"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_MAP[u.role] || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedUser && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-5 text-white">
            <div className="text-sm opacity-90">我的待办</div>
            <div className="text-3xl font-bold mt-1">{workbenchStats?.todo_count || 0}</div>
            <div className="text-xs opacity-80 mt-2">
              {ROLE_MAP[selectedUser.role] || selectedUser.role}
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow p-5 text-white">
            <div className="text-sm opacity-90">历史办理</div>
            <div className="text-3xl font-bold mt-1">{workbenchStats?.handled_count || 0}</div>
            <div className="text-xs opacity-80 mt-2">
              累计参与记录
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-5 border">
            <div className="text-sm text-gray-500">当前处理人</div>
            <div className="text-xl font-semibold text-gray-900 mt-1">{selectedUser.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              {ROLE_MAP[selectedUser.role] || selectedUser.role}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">流程状态统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-4 border">
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center text-white font-bold mb-3`}>
                {card.value}
              </div>
              <div className="text-sm text-gray-600">{card.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">异常类型统计</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exceptionCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow p-4 border">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-white font-bold text-lg`}>
                  {card.value}
                </div>
                <div>
                  <div className="text-base font-medium text-gray-900">{card.label}</div>
                  <div className="text-sm text-gray-500">条异常记录</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <div className="border-b px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex space-x-4">
              <button
                onClick={() => setTab('todo')}
                className={`pb-2 text-sm font-medium border-b-2 ${
                  tab === 'todo'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                我的待办
                {todoRecords.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {todoRecords.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('handled')}
                className={`pb-2 text-sm font-medium border-b-2 ${
                  tab === 'handled'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                历史办理
              </button>
            </div>
            <Link href="/records" className="text-sm text-blue-600 hover:text-blue-800">
              查看全部 →
            </Link>
          </div>
        </div>

        {displayRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {tab === 'todo' ? '暂无待办事项' : '暂无历史办理记录'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录编号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">借阅人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">图书</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前处理人</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayRecords.slice(0, 8).map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{record.record_no}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.borrower_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {record.book_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_MAP[record.status] || record.status}
                      </span>
                      {record.exception_type && (
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${EXCEPTION_COLORS[record.exception_type] || 'bg-gray-100 text-gray-800'}`}>
                          {EXCEPTION_MAP[record.exception_type] || record.exception_type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.current_handler_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link href={`/records/${record.id}`} className="text-blue-600 hover:text-blue-800">
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
