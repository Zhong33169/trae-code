import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as api from '../api';

const defaultMaterials = [
  { name: '商业发票', type: 'invoice', uploaded: false, required: true },
  { name: '装箱单', type: 'packing', uploaded: false, required: true },
  { name: '报关委托书', type: 'customs', uploaded: false, required: true },
  { name: '产品质检报告', type: 'quality', uploaded: false, required: false },
];

export function NewOrderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    productSku: '',
    quantity: 1,
    amount: 0,
    currency: 'USD',
    platform: 'Amazon',
    buyerCountry: 'US',
    deadlineHours: 48,
    remark: '',
  });
  const [materials, setMaterials] = useState(defaultMaterials);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName.trim()) {
      alert('请输入商品名称');
      return;
    }
    if (formData.quantity <= 0) {
      alert('数量必须大于0');
      return;
    }

    setLoading(true);
    try {
      await api.createOrder({
        ...formData,
        materials: materials.map(m => ({
          name: m.name,
          type: m.type,
          uploaded: m.uploaded,
          required: m.required,
        })),
      });
      alert('订单创建成功！');
      navigate('/orders');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialChange = (index: number, field: string, value: any) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setMaterials(newMaterials);
  };

  return (
    <div>
      <div className="back-link" onClick={() => navigate('/orders')}>
        ← 返回列表
      </div>

      <div className="detail-page">
        <div className="detail-header">
          <h1 className="detail-title">新建跨境订单</h1>
          <div className="user-role">{user?.name}</div>
        </div>
        <div className="detail-content">
          <form onSubmit={handleSubmit}>
            <div className="detail-section">
              <h3 className="detail-section-title">基本信息</h3>
              <div className="detail-grid">
                <div className="form-item">
                  <label className="form-label">商品名称 *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="请输入商品名称"
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">商品SKU</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.productSku}
                    onChange={(e) => setFormData({ ...formData, productSku: e.target.value })}
                    placeholder="请输入商品SKU"
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">数量 *</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">金额</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-item">
                  <label className="form-label">货币</label>
                  <select
                    className="form-select"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="USD">USD 美元</option>
                    <option value="EUR">EUR 欧元</option>
                    <option value="GBP">GBP 英镑</option>
                    <option value="JPY">JPY 日元</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">平台</label>
                  <select
                    className="form-select"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  >
                    <option value="Amazon">Amazon</option>
                    <option value="eBay">eBay</option>
                    <option value="AliExpress">AliExpress</option>
                    <option value="Shopee">Shopee</option>
                    <option value="Lazada">Lazada</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">目的国</label>
                  <select
                    className="form-select"
                    value={formData.buyerCountry}
                    onChange={(e) => setFormData({ ...formData, buyerCountry: e.target.value })}
                  >
                    <option value="US">美国</option>
                    <option value="UK">英国</option>
                    <option value="DE">德国</option>
                    <option value="FR">法国</option>
                    <option value="JP">日本</option>
                    <option value="SG">新加坡</option>
                    <option value="CA">加拿大</option>
                    <option value="AU">澳大利亚</option>
                  </select>
                </div>
                <div className="form-item">
                  <label className="form-label">处理时限（小时）</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    value={formData.deadlineHours}
                    onChange={(e) => setFormData({ ...formData, deadlineHours: parseInt(e.target.value) || 48 })}
                  />
                </div>
                <div className="form-item" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">备注</label>
                  <textarea
                    className="form-textarea"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    placeholder="请输入备注信息"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">材料清单</h3>
              <div className="material-list">
                {materials.map((m, index) => (
                  <div key={index} className="material-item">
                    <div className="material-item-info" style={{ gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m.uploaded}
                          onChange={(e) => handleMaterialChange(index, 'uploaded', e.target.checked)}
                        />
                        <span
                          className={`material-status ${m.uploaded ? 'uploaded' : 'missing'}`}
                        >
                          {m.uploaded ? '已上传' : '未上传'}
                        </span>
                      </label>
                      <span style={{ fontWeight: '500' }}>{m.name}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={m.required}
                          onChange={(e) => handleMaterialChange(index, 'required', e.target.checked)}
                        />
                        <span style={{ fontSize: '12px', color: '#666' }}>必需</span>
                      </label>
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      类型：{m.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-default"
                onClick={() => navigate('/orders')}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? '创建中...' : '创建订单'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
