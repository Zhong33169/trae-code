'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRecord, getUsers } from '@/lib/api';
import { User, ROLE_MAP } from '@/lib/types';

export default function NewRecordPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(1);
  const [formData, setFormData] = useState({
    record_no: '',
    borrower_name: '',
    borrower_id: '',
    book_title: '',
    book_isbn: '',
    borrow_date: '',
    due_date: '',
    return_date: '',
    description: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      const res = await getUsers();
      if (res.success && res.data) {
        const userList = res.data as User[];
        setUsers(userList);
        const registrar = userList.find((u) => u.role === 'registrar');
        if (registrar) setSelectedUserId(registrar.id);
      }
    }
    loadUsers();

    const today = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setFormData((prev) => ({
      ...prev,
      borrow_date: today.toISOString().split('T')[0],
      due_date: due.toISOString().split('T')[0],
      record_no: `BR${today.getFullYear()}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await createRecord({
        ...formData,
        created_by: selectedUserId,
        borrower_id: formData.borrower_id || undefined,
        book_isbn: formData.book_isbn || undefined,
        return_date: formData.return_date || undefined,
        description: formData.description || undefined,
      });

      if (res.success && res.data) {
        const record = res.data as any;
        router.push(`/records/${record.id}`);
      } else {
        setError(res.message || '创建失败');
      }
    } catch (e) {
      setError('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center mb-6">
        <Link href="/records" className="text-gray-500 hover:text-gray-700 mr-4">
          ← 返回列表
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">新建借阅记录</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            登记人
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            className="w-full border rounded-md px-3 py-2"
          >
            {users.filter(u => u.role === 'registrar').map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_MAP[u.role] || u.role})
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                记录编号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="record_no"
                value={formData.record_no}
                onChange={handleChange}
                required
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                借阅人 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="borrower_name"
                value={formData.borrower_name}
                onChange={handleChange}
                required
                className="w-full border rounded-md px-3 py-2"
                placeholder="请输入借阅人姓名"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                借阅人编号
              </label>
              <input
                type="text"
                name="borrower_id"
                value={formData.borrower_id}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2"
                placeholder="学号/工号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                书名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="book_title"
                value={formData.book_title}
                onChange={handleChange}
                required
                className="w-full border rounded-md px-3 py-2"
                placeholder="请输入书名"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ISBN
              </label>
              <input
                type="text"
                name="book_isbn"
                value={formData.book_isbn}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                借阅日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="borrow_date"
                value={formData.borrow_date}
                onChange={handleChange}
                required
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                应还日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                实际归还日期
              </label>
              <input
                type="date"
                name="return_date"
                value={formData.return_date}
                onChange={handleChange}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              说明
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded-md px-3 py-2"
              placeholder="借阅说明或异常描述"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Link
              href="/records"
              className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {submitting ? '创建中...' : '创建借阅记录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
