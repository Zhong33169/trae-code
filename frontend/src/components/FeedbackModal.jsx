import React, { useState, useEffect } from 'react';
import api from '../api';

const attendanceOptions = [
  { value: 'attended', label: '正常出勤' },
  { value: 'absent', label: '缺勤' },
  { value: 'late', label: '迟到' },
  { value: 'leave_early', label: '早退' },
];

function FeedbackModal({ visible, onClose, orderId, version, onSuccess }) {
  const [attendance, setAttendance] = useState('attended');
  const [performance, setPerformance] = useState('');
  const [homework, setHomework] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setAttendance('attended');
      setPerformance('');
      setHomework('');
      setTeacherComment('');
      setError('');
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!performance.trim() || !homework.trim()) {
      setError('请填写课堂表现和作业完成情况');
      return;
    }
    if (version === undefined || version === null || version === '') {
      setError('版本信息缺失，请刷新页面后重试');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/orders/${orderId}/feedback`, {
        attendance,
        performance: performance.trim(),
        homework: homework.trim(),
        teacher_comment: teacherComment.trim(),
        version: version,
      });
      onSuccess(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || '提交反馈失败';
      if (err.response?.status === 409) {
        setError(`并发冲突：${detail}（输入已保留，请刷新后重试）`);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h3>课后反馈录入</h3>
          <span className="modal-close" onClick={onClose}>&times;</span>
        </div>
        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>出勤情况</label>
              <select 
                value={attendance} 
                onChange={(e) => setAttendance(e.target.value)}
                disabled={loading}
              >
                {attendanceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>课堂表现</label>
              <input
                type="text"
                placeholder="如：积极参与、注意力集中、互动良好等"
                value={performance}
                onChange={(e) => setPerformance(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>作业完成情况</label>
              <input
                type="text"
                placeholder="如：全部完成、部分完成、未完成等"
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>教师评语</label>
              <textarea
                placeholder="请输入教师评语（选填）"
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={onClose} disabled={loading}>
                取消
              </button>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? '提交中...' : '提交反馈'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FeedbackModal;
