import { useState, useEffect } from 'react';
import { api, getCurrentUser } from '../lib/api';
import { STATUS_LABELS, STATUS_COLORS } from '../lib/types';
import type { Enrollment } from '../lib/types';

interface EnrollmentListProps {
  initialStatus?: string;
  onViewDetail: (id: number) => void;
  onCreate: () => void;
}

export default function EnrollmentList({ initialStatus, onViewDetail, onCreate }: EnrollmentListProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(initialStatus || 'all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchResult, setBatchResult] = useState<any[]>([]);
  const [showBatchResult, setShowBatchResult] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [status, overdueOnly, keyword]);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (status !== 'all') params.status = status;
      if (overdueOnly) params.overdue = 'true';
      if (keyword) params.keyword = keyword;
      const data = await api.getEnrollments(params);
      setEnrollments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === enrollments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(enrollments.map((e) => e.id));
    }
  };

  const handleBatchVerify = async (pass: boolean) => {
    if (selectedIds.length === 0) {
      alert('请先选择要操作的报名单');
      return;
    }
    const reason = pass ? '' : prompt('请输入退回原因：');
    if (!pass && !reason) return;

    try {
      const results = await api.batchVerify(selectedIds, pass, reason || '');
      setBatchResult(results);
      setShowBatchResult(true);
      loadEnrollments();
      setSelectedIds([]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'draft', label: '草稿' },
    { value: 'pending_verify', label: '待核验' },
    { value: 'pending_correction', label: '待补正' },
    { value: 'pending_review', label: '待复核' },
    { value: 'archived', label: '已归档' },
    { value: 'rejected', label: '已退回' },
  ];

  const canBatchVerify = user?.role === 'academic' && selectedIds.length > 0;

  return (
    <div className="enrollment-list">
      <div className="page-header">
        <h2 className="page-title">学员报名单</h2>
        {user?.role === 'admission' && (
          <button className="btn-primary" onClick={onCreate}>
            ➕ 新建报名单
          </button>
        )}
      </div>

      <div className="filter-bar">
        <div className="filter-left">
          <div className="filter-item">
            <label>状态筛选</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              仅显示超时
            </label>
          </div>
        </div>
        <div className="filter-right">
          <input
            type="text"
            placeholder="搜索姓名、电话、专业..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {canBatchVerify && (
        <div className="batch-bar">
          <span>已选择 {selectedIds.length} 项</span>
          <button className="btn-success" onClick={() => handleBatchVerify(true)}>
            批量通过核验
          </button>
          <button className="btn-danger" onClick={() => handleBatchVerify(false)}>
            批量退回
          </button>
        </div>
      )}

      {showBatchResult && batchResult.length > 0 && (
        <div className="batch-result">
          <div className="batch-result-header">
            <span>批量处理结果</span>
            <button onClick={() => setShowBatchResult(false)}>×</button>
          </div>
          <div className="batch-result-list">
            {batchResult.map((r) => (
              <div key={r.id} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                <span>报名单 #{r.id}</span>
                <span>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  {user?.role === 'academic' && status === 'pending_verify' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length === enrollments.length && enrollments.length > 0}
                      onChange={toggleSelectAll}
                    />
                  )}
                </th>
                <th>编号</th>
                <th>学员姓名</th>
                <th>身份证号</th>
                <th>联系电话</th>
                <th>专业</th>
                <th>状态</th>
                <th>创建人</th>
                <th>截止日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">暂无数据</td>
                </tr>
              ) : (
                enrollments.map((item) => (
                  <tr key={item.id} className={item.is_overdue ? 'overdue' : ''}>
                    <td>
                      {user?.role === 'academic' && status === 'pending_verify' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      )}
                    </td>
                    <td>#{item.id}</td>
                    <td>{item.student_name}</td>
                    <td>{item.id_card}</td>
                    <td>{item.phone}</td>
                    <td>{item.major}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: STATUS_COLORS[item.status] + '20', color: STATUS_COLORS[item.status] }}
                      >
                        {STATUS_LABELS[item.status]}
                        {item.is_overdue && ' (超时)'}
                      </span>
                    </td>
                    <td>{item.created_by_name}</td>
                    <td>
                      {item.deadline ? new Date(item.deadline).toLocaleDateString() : '-'}
                    </td>
                    <td>
                      <button className="link-btn" onClick={() => onViewDetail(item.id)}>
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .enrollment-list {
          padding: 24px;
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .page-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }
        .btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-primary:hover { opacity: 0.9; }
        .filter-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          flex-wrap: wrap;
          gap: 12px;
        }
        .filter-left {
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .filter-item label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
        }
        .filter-item select {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        .search-input {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          width: 240px;
          font-size: 14px;
        }
        .batch-bar {
          background: #eff6ff;
          padding: 12px 20px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .batch-bar span { color: #1e40af; font-size: 14px; }
        .btn-success {
          padding: 8px 16px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-danger {
          padding: 8px 16px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .batch-result {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .batch-result-header {
          padding: 10px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 500;
          font-size: 14px;
        }
        .batch-result-header button {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6b7280;
        }
        .batch-result-list {
          max-height: 200px;
          overflow-y: auto;
          padding: 8px;
        }
        .batch-result-item {
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 4px;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
        }
        .batch-result-item.success { background: #ecfdf5; color: #065f46; }
        .batch-result-item.fail { background: #fef2f2; color: #991b1b; }
        .table-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th {
          background: #f9fafb;
          padding: 12px 16px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        .data-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }
        .data-table tr:hover { background: #f9fafb; }
        .data-table tr.overdue { background: #fef2f2; }
        .data-table tr.overdue:hover { background: #fee2e2; }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
        }
        .link-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }
        .link-btn:hover { text-decoration: underline; }
        .empty {
          text-align: center;
          padding: 40px;
          color: #9ca3af;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
