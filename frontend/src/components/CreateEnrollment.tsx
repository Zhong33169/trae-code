import { useState } from 'react';
import { api } from '../lib/api';

interface CreateEnrollmentProps {
  onBack: () => void;
  onCreated: (id: number) => void;
}

export default function CreateEnrollment({ onBack, onCreated }: CreateEnrollmentProps) {
  const [formData, setFormData] = useState({
    student_name: '',
    id_card: '',
    phone: '',
    major: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const majors = [
    '计算机应用',
    '电子商务',
    '机电一体化',
    '护理',
    '会计',
    '学前教育',
    '汽车维修',
    '烹饪工艺',
    '美容美发',
    '物流管理',
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.student_name || !formData.id_card || !formData.phone || !formData.major) {
      setError('请填写所有必填项');
      return;
    }

    setLoading(true);
    try {
      const result = await api.createEnrollment(formData);
      onCreated(result.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="create-header">
          <button className="back-btn" onClick={onBack}>← 返回</button>
          <h2>新建学员报名单</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>学员姓名 <span className="required">*</span></label>
              <input
                type="text"
                name="student_name"
                value={formData.student_name}
                onChange={handleChange}
                placeholder="请输入学员姓名"
              />
            </div>
            <div className="form-group">
              <label>身份证号 <span className="required">*</span></label>
              <input
                type="text"
                name="id_card"
                value={formData.id_card}
                onChange={handleChange}
                placeholder="请输入身份证号"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>联系电话 <span className="required">*</span></label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="请输入联系电话"
              />
            </div>
            <div className="form-group">
              <label>报名专业 <span className="required">*</span></label>
              <select
                name="major"
                value={formData.major}
                onChange={handleChange}
              >
                <option value="">请选择专业</option>
                {majors.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="error-box">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onBack}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '创建中...' : '创建报名单'}
            </button>
          </div>
        </form>

        <div className="tip-box">
          <p>💡 提示：创建后将进入草稿状态，您可以上传附件后再提交核验。</p>
        </div>
      </div>

      <style>{`
        .create-page {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        .create-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .create-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 16px;
        }
        .create-header h2 {
          margin: 0;
          font-size: 20px;
          color: #1f2937;
        }
        .back-btn {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }
        .back-btn:hover { text-decoration: underline; }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }
        .required { color: #ef4444; }
        .form-group input, .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .form-group input:focus, .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .error-box {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .btn-cancel {
          padding: 10px 24px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-submit {
          padding: 10px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .tip-box {
          margin-top: 20px;
          padding: 16px;
          background: #eff6ff;
          border-radius: 8px;
        }
        .tip-box p {
          margin: 0;
          color: #1e40af;
          font-size: 14px;
        }
        @media (max-width: 600px) {
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
