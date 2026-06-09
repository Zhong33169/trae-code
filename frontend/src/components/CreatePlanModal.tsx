import { createSignal, For } from 'solid-js';
import { useUser } from '../contexts/UserContext';
import { api } from '../services/api';
import { MaterialItem } from '../types';
import './Modal.css';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePlanModal = (props: Props) => {
  const { currentUser } = useUser();
  const [patientName, setPatientName] = createSignal('');
  const [patientPhone, setPatientPhone] = createSignal('');
  const [deadline, setDeadline] = createSignal('');
  const [remarks, setRemarks] = createSignal('');
  const [materials, setMaterials] = createSignal<MaterialItem[]>([]);
  const [materialName, setMaterialName] = createSignal('');
  const [materialQty, setMaterialQty] = createSignal(1);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const addMaterial = () => {
    if (!materialName().trim()) return;
    setMaterials([
      ...materials(),
      {
        id: `temp-${Date.now()}`,
        name: materialName().trim(),
        quantity: materialQty(),
        checked: false,
      },
    ]);
    setMaterialName('');
    setMaterialQty(1);
  };

  const removeMaterial = (id: string) => {
    setMaterials(materials().filter(m => m.id !== id));
  };

  const toggleMaterialChecked = (id: string) => {
    setMaterials(materials().map(m =>
      m.id === id ? { ...m, checked: !m.checked } : m
    ));
  };

  const handleSubmit = async () => {
    if (!patientName().trim()) {
      setError('请输入患者姓名');
      return;
    }
    if (!patientPhone().trim()) {
      setError('请输入联系电话');
      return;
    }
    if (!deadline()) {
      setError('请选择截止日期');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.createPlan({
        patientName: patientName(),
        patientPhone: patientPhone(),
        deadline: new Date(deadline()).toISOString(),
        store: currentUser()?.store,
        userId: currentUser()?.id,
        materials: materials(),
        remarks: remarks(),
      });
      props.onSuccess();
    } catch (e: any) {
      setError(e.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3 class="modal-title">新建治疗计划单</h3>
          <button class="modal-close" onClick={props.onClose}>×</button>
        </div>
        <div class="modal-body">
          {error() && <div class="form-error">{error()}</div>}

          <div class="form-row">
            <div class="form-item">
              <label class="form-label">患者姓名 <span class="required">*</span></label>
              <input
                type="text"
                value={patientName()}
                onInput={(e) => setPatientName(e.target.value)}
                class="form-input"
                placeholder="请输入患者姓名"
              />
            </div>
            <div class="form-item">
              <label class="form-label">联系电话 <span class="required">*</span></label>
              <input
                type="text"
                value={patientPhone()}
                onInput={(e) => setPatientPhone(e.target.value)}
                class="form-input"
                placeholder="请输入联系电话"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-item">
              <label class="form-label">截止日期 <span class="required">*</span></label>
              <input
                type="date"
                value={deadline()}
                onInput={(e) => setDeadline(e.target.value)}
                class="form-input"
              />
            </div>
            <div class="form-item">
              <label class="form-label">门店</label>
              <input
                type="text"
                value={currentUser()?.store || ''}
                disabled
                class="form-input form-input-disabled"
              />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">材料清单</label>
            <div class="material-add-row">
              <input
                type="text"
                value={materialName()}
                onInput={(e) => setMaterialName(e.target.value)}
                class="form-input"
                placeholder="材料名称"
                style="flex: 1;"
              />
              <input
                type="number"
                value={materialQty()}
                onInput={(e) => setMaterialQty(parseInt(e.target.value) || 1)}
                class="form-input"
                style="width: 80px;"
                min="1"
              />
              <button type="button" class="btn btn-primary btn-sm" onClick={addMaterial}>
                添加
              </button>
            </div>
            <div class="material-list">
              <For each={materials()}>
                {(m) => (
                  <div class="material-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={m.checked}
                        onChange={() => toggleMaterialChecked(m.id)}
                      />
                      <span class="material-name">{m.name}</span>
                      <span class="material-qty">×{m.quantity}</span>
                    </label>
                    <button
                      type="button"
                      class="link-btn link-danger"
                      onClick={() => removeMaterial(m.id)}
                    >
                      删除
                    </button>
                  </div>
                )}
              </For>
              {materials().length === 0 && (
                <div class="empty-text">暂无材料，请添加</div>
              )}
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">备注</label>
            <textarea
              value={remarks()}
              onInput={(e) => setRemarks(e.target.value)}
              class="form-textarea"
              placeholder="请输入备注信息"
              rows={3}
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-default" onClick={props.onClose}>取消</button>
          <button class="btn btn-primary" onClick={handleSubmit} disabled={loading()}>
            {loading() ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePlanModal;
