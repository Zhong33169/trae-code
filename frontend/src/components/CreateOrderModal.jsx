import { h } from 'preact';
import { useState } from 'preact/hooks';
import { createOrder } from '../api/client';

function triggerGlobalRefresh() {
  try {
    window.dispatchEvent(new CustomEvent('aftersales:refresh'));
  } catch (e) {}
}

const EVIDENCE_OPTIONS = [
  '订单截图',
  '退款申请',
  '支付凭证',
  '退货物流单',
  '仓库签收单',
  '身份验证',
  '大额审批单',
];

export default function CreateOrderModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    customer_name: '',
    product_name: '',
    order_amount: '',
    refund_amount: '',
    risk_level: 'low',
    required_evidence: [],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleEvidence = (ev) => {
    setForm((prev) => ({
      ...prev,
      required_evidence: prev.required_evidence.includes(ev)
        ? prev.required_evidence.filter((e) => e !== ev)
        : [...prev.required_evidence, ev],
    }));
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) {
      setError('请填写客户名称');
      return;
    }
    if (!form.product_name.trim()) {
      setError('请填写商品名称');
      return;
    }
    if (!form.order_amount || Number(form.order_amount) <= 0) {
      setError('请填写有效的订单金额');
      return;
    }
    if (!form.refund_amount || Number(form.refund_amount) <= 0) {
      setError('请填写有效的退款金额');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await createOrder({
        ...form,
        order_amount: Number(form.order_amount),
        refund_amount: Number(form.refund_amount),
      });
      triggerGlobalRefresh();
      onSuccess();
    } catch (e) {
      setError(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-title">新建处理单</div>

        <div class="form-group">
          <label>客户名称</label>
          <input
            value={form.customer_name}
            onInput={(e) => updateField('customer_name', e.target.value)}
          />
        </div>

        <div class="form-group">
          <label>商品名称</label>
          <input
            value={form.product_name}
            onInput={(e) => updateField('product_name', e.target.value)}
          />
        </div>

        <div class="form-group">
          <label>订单金额</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.order_amount}
            onInput={(e) => updateField('order_amount', e.target.value)}
          />
        </div>

        <div class="form-group">
          <label>退款金额</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.refund_amount}
            onInput={(e) => updateField('refund_amount', e.target.value)}
          />
        </div>

        <div class="form-group">
          <label>风险等级</label>
          <select
            value={form.risk_level}
            onChange={(e) => updateField('risk_level', e.target.value)}
          >
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
          </select>
        </div>

        <div class="form-group">
          <label>要求证据</label>
          <div class="checkbox-group">
            {EVIDENCE_OPTIONS.map((ev) => (
              <label key={ev}>
                <input
                  type="checkbox"
                  checked={form.required_evidence.includes(ev)}
                  onChange={() => toggleEvidence(ev)}
                />
                {ev}
              </label>
            ))}
          </div>
        </div>

        {error && <div style="color:#ff4d4f;font-size:12px;margin-bottom:12px;">{error}</div>}

        <div class="modal-actions">
          <button class="btn-cancel" onClick={onClose}>取消</button>
          <button class="btn-primary" disabled={submitting} onClick={handleSubmit}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
