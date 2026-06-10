import { useState } from 'react';

const EVIDENCE_TYPES = [
  { value: 'prescription', label: '处方单' },
  { value: 'id_card', label: '身份证' },
  { value: 'medical_record', label: '病历/诊断证明' },
  { value: 'insurance_card', label: '医保卡' }
];

export default function EvidenceManager({
  evidences = [],
  evidenceCheck = null,
  canEdit = false,
  version = null,
  onAdd,
  onDelete,
  onRefresh,
  submitting = false
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [evType, setEvType] = useState('prescription');
  const [evName, setEvName] = useState('');
  const [error, setError] = useState('');

  const hasVersion = version !== null && version !== undefined;
  const canOperate = canEdit && hasVersion && !submitting;

  const handleAdd = async () => {
    if (!evType) {
      setError('请选择证据类型');
      return;
    }
    if (!evName.trim()) {
      setError('请输入证据名称');
      return;
    }
    if (!hasVersion) {
      setError('数据版本缺失，请刷新页面后重试');
      return;
    }
    setError('');
    const success = await onAdd?.(evType, evName.trim());
    if (success) {
      setShowAdd(false);
      setEvType('prescription');
      setEvName('');
    }
  };

  const handleDelete = async (evidenceId) => {
    if (!hasVersion) {
      alert('数据版本缺失，请刷新页面后重试');
      return;
    }
    if (window.confirm('确定要删除该证据吗？')) {
      await onDelete?.(evidenceId);
    }
  };

  const existingTypes = new Set(evidences.map(e => e.type));
  const availableTypes = EVIDENCE_TYPES.filter(t => !existingTypes.has(t.value) || canEdit);

  return (
    <div className="evidence-manager">
      {evidenceCheck && !evidenceCheck.valid && (
        <div className="evidence-missing">
          ⚠️ 缺少必填证据：{evidenceCheck.missingLabels.join('、')}
        </div>
      )}

      {canEdit && !hasVersion && (
        <div className="evidence-version-warning">
          ⚠️ 数据版本未知，无法操作证据
          {onRefresh && (
            <button className="btn btn-sm btn-default" onClick={onRefresh} style={{ marginLeft: 8 }}>
              刷新
            </button>
          )}
        </div>
      )}

      <div className="evidence-list">
        {evidences.length === 0 ? (
          <div className="empty-state">暂无证据附件</div>
        ) : (
          evidences.map(ev => (
            <div key={ev.id} className="evidence-item">
              <div className="ev-info">
                <span className={`ev-type ev-type-${ev.type}`}>{ev.typeLabel}</span>
                <span className="ev-name">{ev.name}</span>
              </div>
              {canEdit && (
                <button
                  className="ev-delete"
                  onClick={() => handleDelete(ev.id)}
                  disabled={!canOperate}
                >
                  删除
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {canEdit && hasVersion && (
        <>
          {!showAdd ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAdd(true)}
              disabled={!canOperate}
              style={{ marginTop: '12px', width: '100%' }}
            >
              + 添加证据
            </button>
          ) : (
            <div className="add-evidence-form">
              <select
                value={evType}
                onChange={e => setEvType(e.target.value)}
                disabled={submitting}
              >
                {EVIDENCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={evName}
                onChange={e => setEvName(e.target.value)}
                placeholder="证据名称"
                disabled={submitting}
              />
              <button
                type="button"
                className="btn btn-default btn-sm"
                onClick={() => { setShowAdd(false); setError(''); }}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAdd}
                disabled={submitting}
              >
                {submitting ? '...' : '添加'}
              </button>
            </div>
          )}
          {error && <div className="form-error" style={{ marginTop: '8px' }}>{error}</div>}
        </>
      )}

      {hasVersion && (
        <div className="evidence-version-info">
          当前数据版本：<strong>v{version}</strong>
        </div>
      )}
    </div>
  );
}
