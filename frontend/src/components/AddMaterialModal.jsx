import React, { useState, useEffect } from 'react';
import api from '../api';

const materialTypes = [
  { value: 'application', label: '申请单' },
  { value: 'certificate', label: '证明材料' },
  { value: 'schedule', label: '排班信息' },
  { value: 'record', label: '记录凭证' },
  { value: 'other', label: '其他材料' },
];

function AddMaterialModal({ visible, onClose, orderId, version, onSuccess }) {
  const [materialType, setMaterialType] = useState('application');
  const [materialName, setMaterialName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setMaterialType('application');
      setMaterialName('');
      setError('');
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!materialName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/orders/${orderId}/materials`, {
        material_type: materialType,
        material_name: materialName.trim(),
        version: version,
      });
      onSuccess(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail || '添加材料失败';
      setError(detail);
      if (err.response?.status === 409) {
        setError(`并发冲突：${detail}（输入已保留，请刷新后重试）`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>添加材料</h3>
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
              <label>材料类型</label>
              <select 
                value={materialType} 
                onChange={(e) => setMaterialType(e.target.value)}
                disabled={loading}
              >
                {materialTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>材料名称</label>
              <input
                type="text"
                placeholder="请输入材料名称"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={onClose} disabled={loading}>
                取消
              </button>
              <button type="submit" className="btn btn-success" disabled={loading || !materialName.trim()}>
                {loading ? '添加中...' : '确认添加'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddMaterialModal;
