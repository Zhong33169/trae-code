import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';

export default function OrderForm({ mode, meta, onClose, onSaved, showToast }) {
  const required = {
    登记阶段: meta?.requiredMaterials?.[meta?.stages?.[0]] || [],
    核验阶段: meta?.requiredMaterials?.[meta?.stages?.[1]] || [],
    复核阶段: meta?.requiredMaterials?.[meta?.stages?.[2]] || [],
  };

  const [form, setForm] = useState({
    title: '',
    store: meta?.stores?.[0] || '',
    category: meta?.categories?.[0] || '',
    supplier: meta?.suppliers?.[0] || '',
    totalAmount: '',
    items: [
      { name: '', spec: '', qty: '', unit: '箱', price: '' },
    ],
    materials: required['登记阶段'].slice(0, 2),
  });
  const [submitting, setSubmitting] = useState(false);

  function updateField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function updateItem(idx, k, v) {
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [k]: v } : it),
    }));
  }

  function addItem() {
    setForm(f => ({
      ...f,
      items: [...f.items, { name: '', spec: '', qty: '', unit: '箱', price: '' }],
    }));
  }

  function removeItem(idx) {
    setForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  }

  function toggleMaterial(m) {
    setForm(f => {
      const has = f.materials.includes(m);
      return {
        ...f,
        materials: has ? f.materials.filter(x => x !== m) : [...f.materials, m],
      };
    });
  }

  function calcTotal() {
    return (form.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  }

  useEffect(() => {
    updateField('totalAmount', calcTotal());
  }, [form.items]);

  async function handleSubmit() {
    if (!form.title.trim()) return showToast('请填写标题', 'error');
    if (!form.store) return showToast('请选择门店', 'error');
    if (!form.category) return showToast('请选择品类', 'error');
    if (!form.supplier) return showToast('请选择供应商', 'error');
    if (!form.items.length || form.items.every(it => !it.name.trim())) {
      return showToast('请至少填写一条订货明细', 'error');
    }
    if (form.materials.length < required['登记阶段'].length) {
      const missing = required['登记阶段'].filter(r => !form.materials.includes(r));
      return showToast(`登记阶段材料不全，缺失：${missing.join('、')}`, 'error');
    }
    setSubmitting(true);
    try {
      const data = {
        ...form,
        items: form.items.filter(it => it.name.trim()),
        totalAmount: calcTotal(),
      };
      await api.createOrder(data);
      onSaved?.();
    } catch (e) {
      showToast(e.message + (e.detail ? '：' + e.detail : ''), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modal-header">
          <h3>🏪 新建门店订货单（草稿）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert info" style={{ marginBottom: 14 }}>
            <strong>登记阶段需备齐以下材料才能提交：</strong>
            {required['登记阶段'].join('、')}。材料缺失将无法推进至核验阶段。
          </div>

          <div className="form-grid">
            <div className="form-item">
              <label><span className="required">*</span> 标题</label>
              <input placeholder="如：望京店6月第二周生鲜补给单" value={form.title} onInput={(e) => updateField('title', e.target.value)} />
            </div>
            <div className="form-item">
              <label><span className="required">*</span> 门店</label>
              <select value={form.store} onChange={(e) => updateField('store', e.target.value)}>
                {(meta?.stores || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-item">
              <label><span className="required">*</span> 品类</label>
              <select value={form.category} onChange={(e) => updateField('category', e.target.value)}>
                {(meta?.categories || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-item">
              <label><span className="required">*</span> 供应商</label>
              <select value={form.supplier} onChange={(e) => updateField('supplier', e.target.value)}>
                {(meta?.suppliers || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <h4 style={{ margin: '14px 0 8px 0', fontSize: 13 }}>📦 订货明细</h4>
          <table className="items-table">
            <thead>
              <tr>
                <th>商品名称</th>
                <th>规格</th>
                <th style={{ width: 80 }}>数量</th>
                <th style={{ width: 80 }}>单位</th>
                <th style={{ width: 100 }}>单价(¥)</th>
                <th style={{ width: 110 }}>小计</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td><input style={{ width: '100%' }} value={it.name} onInput={(e) => updateItem(i, 'name', e.target.value)} placeholder="商品名称" /></td>
                  <td><input style={{ width: '100%' }} value={it.spec} onInput={(e) => updateItem(i, 'spec', e.target.value)} placeholder="如 10kg/箱" /></td>
                  <td><input style={{ width: '100%' }} type="number" value={it.qty} onInput={(e) => updateItem(i, 'qty', e.target.value)} /></td>
                  <td>
                    <select style={{ width: '100%' }} value={it.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)}>
                      {['箱', '袋', '桶', '盒', '条', '台', '套', '个'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td><input style={{ width: '100%' }} type="number" value={it.price} onInput={(e) => updateItem(i, 'price', e.target.value)} /></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>¥{(Number(it.qty) * Number(it.price)).toFixed(2)}</td>
                  <td><button className="btn-sm btn-danger" onClick={() => removeItem(i)} disabled={form.items.length <= 1}>删除</button></td>
                </tr>
              ))}
              <tr>
                <td colSpan="5" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gray-600)' }}>合计</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', fontSize: 15 }}>¥{calcTotal().toFixed(2)}</td>
                <td><button className="btn-sm btn-primary" onClick={addItem}>+ 添加</button></td>
              </tr>
            </tbody>
          </table>

          <h4 style={{ margin: '16px 0 8px 0', fontSize: 13 }}>📎 登记阶段材料（提交核验时校验）</h4>
          <div className="checkbox-group">
            {required['登记阶段'].map(m => (
              <label key={m} className={form.materials.includes(m) ? 'checked' : ''}>
                <input type="checkbox" checked={form.materials.includes(m)} onChange={() => toggleMaterial(m)} />
                {m}
              </label>
            ))}
          </div>
          <div className="help-text">勾选代表材料已上传/备齐。缺少材料时，在详情页点击「提交」会被拒绝。</div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>取消</button>
          <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? '保存中...' : '保存为草稿'}
          </button>
        </div>
      </div>
    </div>
  );
}
