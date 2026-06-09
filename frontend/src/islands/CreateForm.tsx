import { useState } from 'react';
import { createConsultation } from '../lib/api';

const consultTypes = ['科间会诊', '多学科会诊', '急诊会诊', '全院大会诊'];

const deptOptions = [
  '心内科', '呼吸内科', '消化内科', '神经内科', '肾内科',
  '血液科', '内分泌科', '风湿免疫科', '感染科',
  '普外科', '骨科', '神经外科', '心胸外科', '泌尿外科',
  '妇产科', '儿科', '眼科', '耳鼻喉科', '口腔科',
  '皮肤科', '重症医学科', '急诊科', '康复医学科',
  '医学影像科', '检验科', '病理科', '麻醉科',
];

const evidenceOptions = [
  '病历记录', '实验室检查', '影像学检查', '心电图',
  '超声检查', '病理报告', '手术记录', '护理记录',
];

export default function CreateForm() {
  const [formData, setFormData] = useState({
    title: '',
    patient_name: '',
    patient_id: '',
    dept: '',
    chief_complaint: '',
    consult_type: '',
    consult_dept: '',
    evidence_list: [] as string[],
    deadline: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [newEvidence, setNewEvidence] = useState('');

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEvidence = (item: string) => {
    setFormData((prev) => {
      if (prev.evidence_list.includes(item)) {
        return { ...prev, evidence_list: prev.evidence_list.filter((e) => e !== item) };
      } else {
        return { ...prev, evidence_list: [...prev.evidence_list, item] };
      }
    });
  };

  const addCustomEvidence = () => {
    const trimmed = newEvidence.trim();
    if (trimmed && !formData.evidence_list.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        evidence_list: [...prev.evidence_list, trimmed],
      }));
      setNewEvidence('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.patient_name || !formData.patient_id ||
        !formData.dept || !formData.consult_type || !formData.consult_dept) {
      setError('请填写所有必填项');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createConsultation(formData);
      if (result.id) {
        window.location.href = `/consultation?id=${result.id}`;
      }
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">申请单信息</div>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                申请标题 <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="例如：心内科疑难病例会诊"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                申请科室 <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.dept}
                onChange={(e) => handleChange('dept', e.target.value)}
              >
                <option value="">请选择科室</option>
                {deptOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                患者姓名 <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.patient_name}
                onChange={(e) => handleChange('patient_name', e.target.value)}
                placeholder="请输入患者姓名"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                患者ID <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.patient_id}
                onChange={(e) => handleChange('patient_id', e.target.value)}
                placeholder="请输入住院号/门诊号"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                会诊类型 <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.consult_type}
                onChange={(e) => handleChange('consult_type', e.target.value)}
              >
                <option value="">请选择类型</option>
                {consultTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                会诊科室 <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.consult_dept}
                onChange={(e) => handleChange('consult_dept', e.target.value)}
                placeholder="如：心外科，多个科室用+连接"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              主诉/病情摘要
            </label>
            <textarea
              className="form-textarea"
              value={formData.chief_complaint}
              onChange={(e) => handleChange('chief_complaint', e.target.value)}
              placeholder="请简要描述患者病情和会诊目的..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              申请期限
            </label>
            <input
              type="date"
              className="form-input"
              value={formData.deadline}
              onChange={(e) => handleChange('deadline', e.target.value)}
              style={{ maxWidth: 300 }}
            />
            <div className="form-hint">不填则默认为7天后</div>
          </div>

          <div className="form-group">
            <label className="form-label">证据材料</label>
            <div className="checkbox-group" style={{ marginBottom: 12 }}>
              {evidenceOptions.map((item) => (
                <label key={item} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={formData.evidence_list.includes(item)}
                    onChange={() => toggleEvidence(item)}
                  />
                  {item}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="form-input"
                placeholder="自定义证据名称"
                value={newEvidence}
                onChange={(e) => setNewEvidence(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-sm" onClick={addCustomEvidence}>
                添加
              </button>
            </div>
            {formData.evidence_list.length > 0 && (
              <div className="evidence-tags">
                {formData.evidence_list.map((item, idx) => (
                  <span key={idx} className="evidence-tag">
                    📄 {item}
                    <span
                      style={{ cursor: 'pointer', marginLeft: 4, fontWeight: 'bold' }}
                      onClick={() => toggleEvidence(item)}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}
            <div className="form-hint">
              必填证据：病历记录、实验室检查（提交时会校验）
            </div>
          </div>

          <div className="divider"></div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn"
              onClick={() => window.history.back()}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '提交中...' : '创建申请单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
