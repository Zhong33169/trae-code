import React, { useState, useEffect } from 'react';
import api from '../api';

const serviceTypeOptions = [
  { value: 'makeup_class', label: '补课' },
  { value: 'drop_class', label: '退课' },
  { value: 'transfer_class', label: '转课' },
  { value: 'trial_class', label: '试听' },
];

function CreateOrderModal({ visible, onClose, onSuccess }) {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({
    student_id: '',
    course_id: '',
    schedule_id: '',
    service_type: 'makeup_class',
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchStudents();
      fetchCourses();
    }
  }, [visible]);

  useEffect(() => {
    if (form.course_id) {
      fetchSchedules(form.course_id);
    } else {
      setSchedules([]);
    }
  }, [form.course_id]);

  const fetchStudents = async () => {
    try {
      const res = await api.get('/students');
      setStudents(res.data);
      if (res.data.length > 0 && !form.student_id) {
        setForm(f => ({ ...f, student_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('获取学员失败:', err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data);
      if (res.data.length > 0 && !form.course_id) {
        setForm(f => ({ ...f, course_id: res.data[0].id }));
      }
    } catch (err) {
      console.error('获取课程失败:', err);
    }
  };

  const fetchSchedules = async (courseId) => {
    try {
      const res = await api.get(`/schedules?course_id=${courseId}`);
      setSchedules(res.data);
    } catch (err) {
      console.error('获取排班失败:', err);
    }
  };

  const handleSubmit = async () => {
    if (!form.student_id || !form.course_id || !form.service_type) {
      alert('请填写完整信息');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/orders', {
        student_id: Number(form.student_id),
        course_id: Number(form.course_id),
        schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
        service_type: form.service_type,
      });
      alert('创建成功');
      onSuccess && onSuccess();
    } catch (err) {
      alert(err.response?.data?.detail || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ 新建课程服务单</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>服务类型 *</label>
            <select 
              value={form.service_type}
              onChange={(e) => setForm(f => ({ ...f, service_type: e.target.value }))}
            >
              {serviceTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>学员 *</label>
            <select
              value={form.student_id}
              onChange={(e) => setForm(f => ({ ...f, student_id: e.target.value }))}
            >
              <option value="">请选择学员</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.student_no} - {s.grade})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>课程 *</label>
            <select
              value={form.course_id}
              onChange={(e) => setForm(f => ({ ...f, course_id: e.target.value }))}
            >
              <option value="">请选择课程</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject} - {c.grade})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>课程排班（选填）</label>
            <select
              value={form.schedule_id}
              onChange={(e) => setForm(f => ({ ...f, schedule_id: e.target.value }))}
            >
              <option value="">暂不指定排班</option>
              {schedules.map(s => (
                <option key={s.id} value={s.id}>
                  {s.schedule_date} {s.start_time}-{s.end_time} ({s.classroom || s.teacher})
                </option>
              ))}
            </select>
          </div>

          <div className="alert alert-info">
            创建后服务单状态为「草稿」，需补充材料后提交审核
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateOrderModal;
