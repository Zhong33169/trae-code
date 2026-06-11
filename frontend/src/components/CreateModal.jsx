import { createSignal, createEffect } from 'solid-js';
import { expenseApi } from '../api/expenseApi';
import { useToast } from '../stores/toastStore';

function CreateModal(props) {
  const [loading, setLoading] = createSignal(false);
  const [configLoading, setConfigLoading] = createSignal(false);
  const [materialConfig, setMaterialConfig] = createSignal(null);
  const [selectedMaterials, setSelectedMaterials] = createSignal([]);
  const [formData, setFormData] = createSignal({
    title: '',
    applicant: '',
    applicantDept: '',
    amount: '',
    expenseType: 'travel',
    deadlineDays: 3,
  });

  const toast = useToast();

  createEffect(() => {
    if (props.visible && !materialConfig()) {
      loadMaterialConfig();
    }
    if (props.visible) {
      setSelectedMaterials([]);
      setFormData({
        title: '',
        applicant: '',
        applicantDept: '',
        amount: '',
        expenseType: 'travel',
        deadlineDays: 3,
      });
    }
  }, () => props.visible);

  const loadMaterialConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await expenseApi.getMaterialConfig();
      if (res.success) {
        setMaterialConfig(res.data);
      }
    } catch (err) {
      toast.error('加载材料配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const getRequiredMaterials = () => {
    if (!materialConfig()) return [];
    return materialConfig().requiredMaterialLabels[formData().expenseType] || [];
  };

  const getRequiredMaterialKeys = () => {
    if (!materialConfig()) return [];
    return materialConfig().requiredMaterialsByType[formData().expenseType] || [];
  };

  const getMissingMaterials = () => {
    const required = getRequiredMaterialKeys();
    return required.filter(m => !selectedMaterials().includes(m));
  };

  const toggleMaterial = (materialKey) => {
    setSelectedMaterials(prev => {
      if (prev.includes(materialKey)) {
        return prev.filter(m => m !== materialKey);
      }
      return [...prev, materialKey];
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'expenseType') {
      setSelectedMaterials([]);
    }
  };

  const handleSubmit = async () => {
    if (!formData().title.trim()) {
      toast.warning('请填写报销标题');
      return;
    }
    if (!formData().applicant.trim()) {
      toast.warning('请填写申请人');
      return;
    }
    if (!formData().amount || isNaN(Number(formData().amount)) || Number(formData().amount) <= 0) {
      toast.warning('请填写正确的金额');
      return;
    }

    setLoading(true);
    try {
      const deadline = Date.now() + Number(formData().deadlineDays) * 24 * 60 * 60 * 1000;
      const res = await expenseApi.create({
        title: formData().title,
        applicant: formData().applicant,
        applicantDept: formData().applicantDept,
        amount: Number(formData().amount),
        expenseType: formData().expenseType,
        deadline,
        materials: selectedMaterials(),
      });
      if (res.success) {
        toast.success('创建成功');
        props.onSuccess?.();
      }
    } catch (err) {
      toast.error(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  if (!props.visible) return null;

  const expenseTypes = [
    { value: 'travel', label: '差旅费' },
    { value: 'office', label: '办公费' },
    { value: 'entertainment', label: '招待费' },
    { value: 'training', label: '培训费' },
    { value: 'transport', label: '交通费' },
    { value: 'communication', label: '通讯费' },
    { value: 'other', label: '其他' },
  ];

  const missing = getMissingMaterials();
  const materialComplete = missing.length === 0;

  return (
    <div class="modal-overlay" onClick={() => !loading() && props.onClose?.()}>
      <div class="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">新建报销申请</div>
        <div class="modal-body">
          <div class="form-item">
            <label class="form-label">报销标题 *</label>
            <input
              type="text"
              class="form-input"
              placeholder="如：北京出差差旅费"
              value={formData().title}
              onInput={(e) => handleInputChange('title', e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div class="form-item" style={{ flex: 1 }}>
              <label class="form-label">申请人 *</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入姓名"
                value={formData().applicant}
                onInput={(e) => handleInputChange('applicant', e.target.value)}
              />
            </div>
            <div class="form-item" style={{ flex: 1 }}>
              <label class="form-label">所属部门</label>
              <input
                type="text"
                class="form-input"
                placeholder="请输入部门"
                value={formData().applicantDept}
                onInput={(e) => handleInputChange('applicantDept', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div class="form-item" style={{ flex: 1 }}>
              <label class="form-label">报销类型</label>
              <select
                class="form-select"
                value={formData().expenseType}
                onChange={(e) => handleInputChange('expenseType', e.target.value)}
              >
                {expenseTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div class="form-item" style={{ flex: 1 }}>
              <label class="form-label">金额（元）*</label>
              <input
                type="number"
                class="form-input"
                placeholder="请输入金额"
                value={formData().amount}
                onInput={(e) => handleInputChange('amount', e.target.value)}
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">处理时限</label>
            <select
              class="form-select"
              value={formData().deadlineDays}
              onChange={(e) => handleInputChange('deadlineDays', e.target.value)}
            >
              <option value="1">1天（紧急）</option>
              <option value="3">3天（正常）</option>
              <option value="7">7天（普通）</option>
              <option value="14">14天（宽松）</option>
            </select>
          </div>

          {materialConfig() && (
            <div class="form-item">
              <label class="form-label">
                报销材料
                <span class={`material-status-badge ${materialComplete ? 'badge-success' : 'badge-warning'}`}>
                  {materialComplete ? '材料齐全' : `缺少 ${missing.length} 项`}
                </span>
              </label>

              <div class="material-section">
                <div class="material-subtitle">必填材料（{getRequiredMaterials().length} 项）</div>
                {configLoading() ? (
                  <div class="loading-text">加载中...</div>
                ) : (
                  <div class="material-grid">
                    {getRequiredMaterialKeys().map((key, idx) => (
                      <div
                        key={key}
                        class={`material-checkbox ${selectedMaterials().includes(key) ? 'selected' : ''}`}
                        onClick={() => toggleMaterial(key)}
                      >
                        <div class="checkbox-icon">
                          {selectedMaterials().includes(key) ? '✓' : ''}
                        </div>
                        <div class="material-name">{getRequiredMaterials()[idx]}</div>
                        {!selectedMaterials().includes(key) && (
                          <div class="material-required-tag">必填</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!materialComplete && (
                <div class="material-warning">
                  ⚠️ 缺少材料：{missing.map((m, idx) => {
                    const allRequired = getRequiredMaterialKeys();
                    const allLabels = getRequiredMaterials();
                    const pos = allRequired.indexOf(m);
                    return allLabels[pos];
                  }).join('、')}
                </div>
              )}
            </div>
          )}
        </div>
        <div class="modal-footer">
          <button
            class="btn"
            onClick={() => props.onClose?.()}
            disabled={loading()}
          >
            取消
          </button>
          <button
            class="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading()}
          >
            {loading() ? '创建中...' : '创建草稿'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateModal;
