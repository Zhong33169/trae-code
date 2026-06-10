'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getRecords, getStats, getUsers, getHandledRecords } from '@/lib/api';
import { BorrowRecord, StatsResponse, User, STATUS_MAP, EXCEPTION_MAP, STATUS_COLORS, EXCEPTION_COLORS, ROLE_MAP } from '@/lib/types';

export default function RecordsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const statusFilter = searchParams.get('status') || '';
  const exceptionFilter = searchParams.get('exception_type') || '';
  const viewFilter = searchParams.get('view') || 'all';

  const loadData = useCallback(async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (exceptionFilter) params.exception_type = exceptionFilter;

      let recordsRes;
      if (viewFilter === 'todo') {
        recordsRes = await getRecords({ ...params, handler_id: String(selectedUser.id), active_only: 'true' });
      } else if (viewFilter === 'handled') {
        recordsRes = await getHandledRecords(selectedUser.id, params);
      } else {
        recordsRes = await getRecords(Object.keys(params).length ? params : undefined);
      }

      const statsRes = await getStats();

      if (recordsRes.success && recordsRes.data) {
        setRecords(recordsRes.data as BorrowRecord[]);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data as StatsResponse);
      }
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, exceptionFilter, viewFilter, selectedUser]);

  useEffect(() => {
    const init = async () => {
      const res = await getUsers();
      if (res.success && res.data) {
        const userList = res.data as User[];
        setUsers(userList);
        const user = userList[0];
        if (user) {
          setSelectedUser(user);
          setSelectedUserId(user.id);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadData();
    }
  }, [loadData, selectedUser]);

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/records?${params.toString()}`);
  };

  const filters = [
    { key: 'status', value: '', label: '全部' },
    { key: 'status', value: 'draft', label: '草稿' },
    { key: 'status', value: 'pending_audit', label: '待审核' },
    { key: 'status', value: 'pending_review', label: '待复核' },
    { key: 'status', value: 'returned_correction', label: '退回补正' },
    { key: 'status', value: 'archived', label: '已归档' },
  ];

  const exceptionFilters = [
    { value: '', label: '全部异常' },
    { value: 'missing_evidence', label: '缺证据' },
    { value: 'overdue', label: '逾期' },
    { value: 'conflict', label: '状态冲突' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">借阅记录列表</h1>
          <div className="flex items-center mt-2 space-x-4">
            <div className="flex space-x-1">
              {[
                { value: 'all', label: '全部记录' },
                { value: 'todo', label: '我的待办' },
                { value: 'handled', label: '我的已办' },
              ].map((v) => (
                <button
                  key={v.value}
                  onClick={() => setFilter('view', v.value)}
                  className={`px-3 py-1 text-sm rounded-md ${
                    viewFilter === v.value
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-500">当前身份：</span>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  const uid = Number(e.target.value);
                  setSelectedUserId(uid);
                  const user = users.find((u) => u.id === uid);
                  if (user) setSelectedUser(user);
                }}
                className="border rounded px-2 py-1 text-sm bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({ROLE_MAP[u.role] || u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <Link
          href="/records/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          + 新建借阅记录
        </Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">总计</div>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <div className="text-xs text-gray-500">草稿</div>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_audit}</div>
            <div className="text-xs text-gray-500">待审核</div>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{stats.pending_review}</div>
            <div className="text-xs text-gray-500">待复核</div>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-red-600">{stats.returned_correction}</div>
            <div className="text-xs text-gray-500">退回补正</div>
          </div>
          <div className="bg-white rounded-lg p-3 border shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.archived}</div>
            <div className="text-xs text-gray-500">已归档</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="flex space-x-1 bg-white rounded-lg p-1 border">
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => setFilter('status', f.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                (statusFilter === f.value || (!statusFilter && !f.value))
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex space-x-1 bg-white rounded-lg p-1 border">
          {exceptionFilters.map((f) => (
            <button
              key={f.value || 'all-exception'}
              onClick={() => setFilter('exception_type', f.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                exceptionFilter === f.value || (!exceptionFilter && !f.value)
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">加载中...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记录编号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  借阅人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  书名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  借阅日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  应还日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  异常
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  当前处理人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  版本
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    暂无记录
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/records/${record.id}`} className="text-blue-600 hover:text-blue-900 font-medium">
                        {record.record_no}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.borrower_name}
                      {record.borrower_id && (
                        <div className="text-xs text-gray-500">{record.borrower_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.book_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.borrow_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.due_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_MAP[record.status] || record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.exception_type ? (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${EXCEPTION_COLORS[record.exception_type] || 'bg-gray-100 text-gray-800'}`}>
                          {EXCEPTION_MAP[record.exception_type] || record.exception_type}
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">正常</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {record.current_handler_name ? (
                        <div>
                          <div className="text-gray-900">{record.current_handler_name}</div>
                          <div className="text-xs text-gray-500">
                            {record.current_handler_role ? ROLE_MAP[record.current_handler_role] || record.current_handler_role : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      v{record.version}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
