import { useState, useEffect } from 'react';

const RISK_OPTIONS = [
  { value: 'low', label: '低风险', color: '#2e7d32' },
  { value: 'medium', label: '中风险', color: '#e65100' },
  { value: 'high', label: '高风险', color: '#c62828' }
];

const EVIDENCE_TYPES = [
  { value: 'prescription', label: '处方单' },
  { value: 'id_card', label: '身份证' },
  { value: 'medical_record', label: '病历/诊断证明' },
  { value: 'insurance_card', label: '医保卡' }
];

export default function OrderForm({ initialData = {}, onSubmit, onCancel, mode = 'create', submitting = false }) {
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_phone: '',
    drug_name: '',
    drug_spec: '',
    quantity: 1,
    risk_level: 'low',
    ...initialData
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData({
      patient_name: '',
      patient_phone: '',
      drug_name: '',
      drug_spec: '',
      quantity: 1,
      risk_level: 'low',
      ...initialData
    });
    setErrors({});
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.patient_name?.trim()) {
      nextErrors.patient_name = '请输入患者姓名';
    }
    if (!formData.drug_name?.trim()) {
      nextErrors.drug_name = '请输入药品名称';
    }
    if (!formData.quantity || formData.quantity < 1) {
      nextErrors.quantity = '数量必须大于0';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit?.(formData);
  };

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <div className="form-section">
        <h4>患者信息</h4>
        <div className="form-row">
          <div className="form-group">
            <label>患者姓名 <span className="required">*</span></label>
            <input
              type="text"
              value={formData.patient_name || ''}
              onChange={e => handleChange('patient_name', e.target.value)}
              placeholder="请输入患者姓名"
              disabled={submitting}
            />
            {errors.patient_name && <div className="form-error">{errors.patient_name}</div>}
          </div>
          <div className="form-group">
            <label>联系电话</label>
            <input
              type="text"
              value={formData.patient_phone || ''}
              onChange={e => handleChange('patient_phone', e.target.value)}
              placeholder="请输入联系电话"
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>药品信息</h4>
        <div className="form-row">
          <div className="form-group">
            <label>药品名称 <span className="required">*</span></label>
            <input
              type="text"
              value={formData.drug_name || ''}
              onChange={e => handleChange('drug_name', e.target.value)}
              placeholder="请输入药品名称"
              disabled={submitting}
            />
            {errors.drug_name && <div className="form-error">{errors.drug_name}</div>}
          </div>
          <div className="form-group">
            <label>规格</label>
            <input
              type="text"
              value={formData.drug_spec || ''}
              onChange={e => handleChange('drug_spec', e.target.value)}
              placeholder="如：0.25g*24粒"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label>数量 <span className="required">*</span></label>
            <input
              type="number"
              min="1"
              value={formData.quantity || 1}
              onChange={e => handleChange('quantity', parseInt(e.target.value) || 1)}
              disabled={submitting}
            />
            {errors.quantity && <div className="form-error">{errors.quantity}</div>}
          </div>
        </div>
      </div>

      <div className="form-section">
        <h4>风险等级 <span className="required">*</span></h4>
        <div className="risk-selector">
          {RISK_OPTIONS.map(opt => (
            <div
              key={opt.value}
              className={`risk-option selected-${opt.value} ${formData.risk_level === opt.value ? `selected-${opt.value}` : ''}`}
              onClick={() => !submitting && handleChange('risk_level', opt.value)}
              style={{
                borderColor: formData.risk_level === opt.value ? opt.color : '#ddd',
                background: formData.risk_level === opt.value 
                  ? opt.value === 'high' ? '#ffebee' : opt.value === 'medium' ? '#fff3e0' : '#e8f5e9'
                  : '#fafafa'
              }}
            >
              <div className="risk-option-title">{opt.label}</div>
              <div className="risk-option-desc">
                {opt.value === 'high' && '需要处方单+身份证+病历'}
                {opt.value === 'medium' && '需要处方单+身份证'}
                {opt.value === 'low' && '需要处方单'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-default"
          onClick={onCancel}
          disabled={submitting}
        >
          取消
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          {submitting ? '处理中...' : (mode === 'create' ? '创建订单' : '保存修改')}
        </button>
      </div>
    </form>
  );
}
