'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getRecord,
  getProcessRecords,
  getEvidence,
  getUsers,
  submitRecord,
  auditRecord,
  reviewRecord,
  correctRecord,
  addEvidence,
} from '@/lib/api';
import {
  BorrowRecord,
  ProcessRecord,
  EvidenceItem,
  User,
  STATUS_MAP,
  EXCEPTION_MAP,
  STATUS_COLORS,
  EXCEPTION_COLORS,
  ROLE_MAP,
  ACTION_MAP,
  ACTION_COLORS,
} from '@/lib/types';

export default function RecordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [record, setRecord] = useState<BorrowRecord | null>(null);
  const [processRecords, setProcessRecords] = useState<ProcessRecord[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [actionForm, setActionForm] = useState({
    opinion: '',
    rejectReason: '',
    passed: true,
  });
  const [correctForm, setCorrectForm] = useState({
    borrower_name: '',
    book_title: '',
    book_isbn: '',
    description: '',
    opinion: '',
  });
  const [evidenceForm, setEvidenceForm] = useState({
    name: '',
    description: '',
    evidence_type: 'other',
    is_required: false,
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordRes, processRes, evidenceRes, usersRes] = await Promise.all([
        getRecord(id),
        getProcessRecords(id),
        getEvidence(id),
        getUsers(),
      ]);

      if (recordRes.success && recordRes.data) {
        setRecord(recordRes.data as BorrowRecord);
      }
      if (processRes.success && processRes.data) {
        setProcessRecords(processRes.data as ProcessRecord[]);
      }
      if (evidenceRes.success && evidenceRes.data) {
        setEvidence(evidenceRes.data as EvidenceItem[]);
      }
      if (usersRes.success && usersRes.data) {
        const userList = usersRes.data as User[];
        setUsers(userList);
        const defaultUser = userList.find((u) => u.id === selectedUserId) || userList[0];
        if (defaultUser) {
          setSelectedUser(defaultUser);
        }
      }
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }, [id, selectedUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const user = users.find((u) => u.id === selectedUserId);
    if (user) setSelectedUser(user);
  }, [selectedUserId, users]);

  useEffect(() => {
    if (record && record.status === 'returned_correction') {
      setCorrectForm({
        borrower_name: record.borrower_name || '',
        book_title: record.book_title || '',
        book_isbn: record.book_isbn || '',
        description: record.description || '',
        opinion: '',
      });
    }
  }, [record]);

  const handleUserChange = (userId: number) => {
    setSelectedUserId(userId);
    const user = users.find((u) => u.id === userId);
    if (user) setSelectedUser(user);
    setError('');
  };

  const canSubmit = selectedUser?.role === 'registrar' &&
    (record?.status === 'draft' || record?.status === 'returned_correction');

  const canAudit = selectedUser?.role === 'supervisor' && record?.status === 'pending_audit';

  const canReview = selectedUser?.role === 'director' && record?.status === 'pending_review';

  const canCorrect = selectedUser?.role === 'registrar' && record?.status === 'returned_correction';

  const isHandler = record?.current_handler_id === selectedUserId;

  const lastProcess = processRecords.length > 0 ? processRecords[0] : null;

  const handleSubmit = async () => {
    if (!record || !selectedUser) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await submitRecord(id, {
        handler_id: selectedUser.id,
        handler_role: selectedUser.role,
        version: record.version,
        opinion: actionForm.opinion,
      });
      if (res.success) {
        setActionForm({ opinion: '', rejectReason: '', passed: true });
        loadData();
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAudit = async () => {
    if (!record || !selectedUser) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await auditRecord(id, {
        handler_id: selectedUser.id,
        handler_role: selectedUser.role,
        version: record.version,
        passed: actionForm.passed,
        opinion: actionForm.opinion,
        reject_reason: actionForm.passed ? undefined : actionForm.rejectReason,
      });
      if (res.success) {
        setActionForm({ opinion: '', rejectReason: '', passed: true });
        loadData();
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!record || !selectedUser) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await reviewRecord(id, {
        handler_id: selectedUser.id,
        handler_role: selectedUser.role,
        version: record.version,
        passed: actionForm.passed,
        opinion: actionForm.opinion,
        reject_reason: actionForm.passed ? undefined : actionForm.rejectReason,
      });
      if (res.success) {
        setActionForm({ opinion: '', rejectReason: '', passed: true });
        loadData();
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddEvidence = async () => {
    if (!selectedUser || !evidenceForm.name) return;
    try {
      const res = await addEvidence(id, {
        ...evidenceForm,
        uploaded_by: selectedUser.id,
      });
      if (res.success) {
        setEvidenceForm({ name: '', description: '', evidence_type: 'other', is_required: false });
        loadData();
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError('添加证据失败');
    }
  };

  const handleCorrect = async () => {
    if (!record || !selectedUser) return;
    setError('');
    setCorrecting(true);
    try {
      const res = await correctRecord(id, {
        handler_id: selectedUser.id,
        handler_role: selectedUser.role,
        version: record.version,
        opinion: correctForm.opinion,
        borrower_name: correctForm.borrower_name || undefined,
        book_title: correctForm.book_title || undefined,
        book_isbn: correctForm.book_isbn || undefined,
        description: correctForm.description || undefined,
      });
      if (res.success) {
        setCorrectForm((f) => ({ ...f, opinion: '' }));
        loadData();
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError('补正失败');
    } finally {
      setCorrecting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">加载中...</div>;
  }

  if (!record) {
    return <div className="text-center py-12">记录不存在</div>;
  }

  const requiredCount = evidence.filter((e) => e.is_required).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/records" className="text-gray-500 hover:text-gray-700">
            ← 返回列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">借阅记录详情</h1>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">当前身份：</span>
          <select
            value={selectedUserId}
            onChange={(e) => handleUserChange(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_MAP[u.role] || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">基本信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">记录编号</div>
                <div className="text-base font-medium text-gray-900">{record.record_no}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">版本号</div>
                <div className="text-base font-medium text-gray-900">v{record.version}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">借阅人</div>
                <div className="text-base font-medium text-gray-900">
                  {record.borrower_name}
                  {record.borrower_id && (
                    <span className="text-gray-500 text-sm ml-2">({record.borrower_id})</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">图书信息</div>
                <div className="text-base font-medium text-gray-900">{record.book_title}</div>
                {record.book_isbn && (
                  <div className="text-sm text-gray-500">ISBN: {record.book_isbn}</div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500">借阅日期</div>
                <div className="text-base text-gray-900">{record.borrow_date}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">应还日期</div>
                <div className="text-base text-gray-900">{record.due_date}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">实际归还日期</div>
                <div className="text-base text-gray-900">
                  {record.return_date || <span className="text-gray-400">未归还</span>}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">当前状态</div>
                <div className="mt-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[record.status] || 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_MAP[record.status] || record.status}
                  </span>
                  {record.exception_type && (
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${EXCEPTION_COLORS[record.exception_type] || 'bg-gray-100 text-gray-800'}`}>
                      {EXCEPTION_MAP[record.exception_type] || record.exception_type}
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-gray-500">说明</div>
                <div className="text-base text-gray-900">{record.description || '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">证据材料</h2>
              <span className="text-sm text-gray-500">必填 {requiredCount} 项，共 {evidence.length} 项</span>
            </div>
            {evidence.length === 0 ? (
              <div className="text-gray-500 text-center py-8">暂无证据材料</div>
            ) : (
              <div className="space-y-2">
                {evidence.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                        📄
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.name}
                          {item.is_required && (
                            <span className="ml-2 text-red-500 text-xs">*必填</span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500">{item.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.evidence_type}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(canSubmit || canCorrect) && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-3">添加证据</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="证据名称"
                    value={evidenceForm.name}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, name: e.target.value })}
                    className="border rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="描述（选填）"
                    value={evidenceForm.description}
                    onChange={(e) => setEvidenceForm({ ...evidenceForm, description: e.target.value })}
                    className="border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={evidenceForm.is_required}
                      onChange={(e) => setEvidenceForm({ ...evidenceForm, is_required: e.target.checked })}
                      className="mr-2"
                    />
                    设为必填
                  </label>
                  <button
                    onClick={handleAddEvidence}
                    className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">处理记录</h2>
            {processRecords.length === 0 ? (
              <div className="text-gray-500 text-center py-8">暂无处理记录</div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200"></div>
                <div className="space-y-4">
                  {processRecords.map((pr, idx) => (
                    <div key={pr.id} className="relative pl-10">
                      <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-white shadow ${
                        idx === 0 ? 'bg-blue-500' : 'bg-gray-300'
                      }`}></div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {pr.handler_name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {ROLE_MAP[pr.handler_role] || pr.handler_role}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${ACTION_COLORS[pr.action] || 'bg-blue-100 text-blue-700'}`}>
                              {ACTION_MAP[pr.action] || pr.action}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {pr.created_at ? new Date(pr.created_at).toLocaleString('zh-CN') : ''}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[pr.from_status] || 'bg-gray-100'}`}>
                            {STATUS_MAP[pr.from_status] || pr.from_status}
                          </span>
                          <span className="mx-2">→</span>
                          <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[pr.to_status] || 'bg-gray-100'}`}>
                            {STATUS_MAP[pr.to_status] || pr.to_status}
                          </span>
                          <span className="ml-3 text-gray-500">
                            版本 v{pr.version_before} → v{pr.version_after}
                          </span>
                        </div>
                        {pr.opinion && (
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-500">处理意见：</span>{pr.opinion}
                          </div>
                        )}
                        {pr.reject_reason && (
                          <div className="text-sm text-red-600 mt-1">
                            <span className="font-medium">驳回/退回原因：</span>{pr.reject_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">处理信息</h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">当前处理人</div>
                <div className="text-base font-medium text-gray-900">
                  {record.current_handler_name || '-'}
                </div>
                {record.current_handler_role && (
                  <div className="text-sm text-gray-500">
                    {ROLE_MAP[record.current_handler_role] || record.current_handler_role}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500">我的角色</div>
                <div className="text-base font-medium text-gray-900">
                  {selectedUser?.name || '-'}
                </div>
                {selectedUser && (
                  <div className="text-sm text-gray-500">
                    {ROLE_MAP[selectedUser.role] || selectedUser.role}
                  </div>
                )}
              </div>
              {isHandler ? (
                <div className="text-green-600 text-sm">✓ 您是当前处理人，可以办理</div>
              ) : (
                <div className="text-orange-500 text-sm">⚠ 您不是当前处理人</div>
              )}
            </div>
          </div>

          {lastProcess && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">上一处理意见</h2>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    {lastProcess.handler_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {lastProcess.created_at ? new Date(lastProcess.created_at).toLocaleDateString('zh-CN') : ''}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {ROLE_MAP[lastProcess.handler_role] || lastProcess.handler_role} · {ACTION_MAP[lastProcess.action] || lastProcess.action}
                </div>
                {lastProcess.opinion && (
                  <div className="text-sm text-gray-700">{lastProcess.opinion}</div>
                )}
                {lastProcess.reject_reason && (
                  <div className="text-sm text-red-600 mt-2 pt-2 border-t border-red-100">
                    <span className="font-medium">退回原因：</span>{lastProcess.reject_reason}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">操作</h2>

            {canSubmit && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  提交借阅记录进入审核流程
                </p>
                <textarea
                  placeholder="提交意见（选填）"
                  value={actionForm.opinion}
                  onChange={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm h-20"
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {submitting ? '提交中...' : '提交审核'}
                </button>
              </div>
            )}

            {canAudit && (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActionForm({ ...actionForm, passed: true })}
                    className={`flex-1 py-2 text-sm rounded border ${
                      actionForm.passed
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    通过
                  </button>
                  <button
                    onClick={() => setActionForm({ ...actionForm, passed: false })}
                    className={`flex-1 py-2 text-sm rounded border ${
                      !actionForm.passed
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    驳回
                  </button>
                </div>
                <textarea
                  placeholder="审核意见"
                  value={actionForm.opinion}
                  onChange={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm h-20"
                />
                {!actionForm.passed && (
                  <textarea
                    placeholder="驳回原因"
                    value={actionForm.rejectReason}
                    onChange={(e) => setActionForm({ ...actionForm, rejectReason: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm h-20"
                  />
                )}
                <button
                  onClick={handleAudit}
                  disabled={submitting}
                  className={`w-full py-2 text-white rounded text-sm font-medium disabled:bg-gray-400 ${
                    actionForm.passed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? '处理中...' : actionForm.passed ? '审核通过' : '审核驳回'}
                </button>
              </div>
            )}

            {canReview && (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActionForm({ ...actionForm, passed: true })}
                    className={`flex-1 py-2 text-sm rounded border ${
                      actionForm.passed
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    通过归档
                  </button>
                  <button
                    onClick={() => setActionForm({ ...actionForm, passed: false })}
                    className={`flex-1 py-2 text-sm rounded border ${
                      !actionForm.passed
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    退回补正
                  </button>
                </div>
                <textarea
                  placeholder="复核意见"
                  value={actionForm.opinion}
                  onChange={(e) => setActionForm({ ...actionForm, opinion: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm h-20"
                />
                {!actionForm.passed && (
                  <textarea
                    placeholder="退回原因"
                    value={actionForm.rejectReason}
                    onChange={(e) => setActionForm({ ...actionForm, rejectReason: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm h-20"
                  />
                )}
                <button
                  onClick={handleReview}
                  disabled={submitting}
                  className={`w-full py-2 text-white rounded text-sm font-medium disabled:bg-gray-400 ${
                    actionForm.passed ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? '处理中...' : actionForm.passed ? '复核通过并归档' : '复核退回'}
                </button>
              </div>
            )}

            {canCorrect && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-gray-700">补正信息</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">借阅人</label>
                    <input
                      type="text"
                      value={correctForm.borrower_name}
                      onChange={(e) => setCorrectForm({ ...correctForm, borrower_name: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">书名</label>
                    <input
                      type="text"
                      value={correctForm.book_title}
                      onChange={(e) => setCorrectForm({ ...correctForm, book_title: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">ISBN</label>
                    <input
                      type="text"
                      value={correctForm.book_isbn}
                      onChange={(e) => setCorrectForm({ ...correctForm, book_isbn: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">说明</label>
                    <textarea
                      value={correctForm.description}
                      onChange={(e) => setCorrectForm({ ...correctForm, description: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm h-20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">补正意见</label>
                    <textarea
                      placeholder="请填写补正说明"
                      value={correctForm.opinion}
                      onChange={(e) => setCorrectForm({ ...correctForm, opinion: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm h-20"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCorrect}
                  disabled={correcting}
                  className="w-full py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {correcting ? '补正中...' : '保存补正'}
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-gray-400">或</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    补正无误后可直接重新提交审核
                  </p>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
                  >
                    {submitting ? '提交中...' : '重新提交审核'}
                  </button>
                </div>
              </div>
            )}

            {!canSubmit && !canAudit && !canReview && !canCorrect && (
              <div className="text-center py-4 text-gray-500 text-sm">
                当前状态下无可执行操作
                <div className="mt-2 text-xs text-gray-400">
                  请切换到正确的角色身份
                </div>
              </div>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">流程说明</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                借阅登记员登记借阅记录
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center text-xs mr-2">2</span>
                提交审核，借阅审核主管办理
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs mr-2">3</span>
                审核通过后，图书馆复核负责人复核
              </div>
              <div className="flex items-center">
                <span className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-xs mr-2">4</span>
                复核通过后归档
              </div>
              <div className="flex items-center text-red-600">
                <span className="w-6 h-6 bg-red-200 rounded-full flex items-center justify-center text-xs mr-2">↩</span>
                审核/复核驳回 → 退回补正 → 重新提交
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
