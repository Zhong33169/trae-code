import { component$, useSignal, $, type QRL } from '@builder.io/qwik';
import { materialTypeLabels, type MaterialInput } from '~/utils/api';

export interface ApplicationFormData {
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  booth_type: string;
  booth_size: string;
  expected_area: string;
  industry: string;
  product_description: string;
  materials: MaterialInput[];
}

export interface ApplicationFormProps {
  initialData?: Partial<ApplicationFormData>;
  onSubmit$: QRL<(data: ApplicationFormData) => void>;
  onCancel$: QRL<() => void>;
  submitLabel?: string;
  isCorrection?: boolean;
  rejectedMaterialNames?: string[];
}

export const emptyForm: ApplicationFormData = {
  company_name: '',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  booth_type: '',
  booth_size: '',
  expected_area: '',
  industry: '',
  product_description: '',
  materials: [{ material_type: 'business_license', material_name: '营业执照.pdf' }],
};

export default component$<ApplicationFormProps>((props) => {
  const formData = useSignal<ApplicationFormData>({
    company_name: props.initialData?.company_name ?? '',
    contact_person: props.initialData?.contact_person ?? '',
    contact_phone: props.initialData?.contact_phone ?? '',
    contact_email: props.initialData?.contact_email ?? '',
    booth_type: props.initialData?.booth_type ?? '',
    booth_size: props.initialData?.booth_size ?? '',
    expected_area: props.initialData?.expected_area ?? '',
    industry: props.initialData?.industry ?? '',
    product_description: props.initialData?.product_description ?? '',
    materials: props.initialData?.materials ?? [{ material_type: 'business_license', material_name: '营业执照.pdf' }],
  });

  const addMaterial = $(() => {
    formData.value = {
      ...formData.value,
      materials: [...formData.value.materials, { material_type: 'other', material_name: '' }],
    };
  });

  const removeMaterial = $((index: number) => {
    const newMaterials = formData.value.materials.filter((_, i) => i !== index);
    formData.value = { ...formData.value, materials: newMaterials };
  });

  const handleSubmit = $(() => {
    const data = formData.value;
    if (!data.company_name.trim()) {
      alert('请填写公司名称');
      return;
    }
    if (!data.contact_person.trim()) {
      alert('请填写联系人');
      return;
    }
    if (!data.contact_phone.trim()) {
      alert('请填写联系电话');
      return;
    }
    const validMaterials = data.materials.filter((m) => m.material_name.trim());
    if (validMaterials.length === 0) {
      alert('请至少添加一个材料');
      return;
    }
    const hasLicense = validMaterials.some((m) => m.material_type === 'business_license');
    if (!hasLicense) {
      alert('必须包含营业执照材料');
      return;
    }
    props.onSubmit$({ ...data, materials: validMaterials });
  });

  return (
    <div class="card">
      {props.isCorrection && props.rejectedMaterialNames && props.rejectedMaterialNames.length > 0 && (
        <div class="alert alert-warning" style={{ marginBottom: '16px', fontSize: '13px' }}>
          <strong>⚠ 需要补正的材料：</strong>
          {props.rejectedMaterialNames.map((name, i) => (
            <span key={i} style={{ marginLeft: '4px', color: '#cf1322' }}>
              {name}{i < props.rejectedMaterialNames!.length - 1 ? '、' : ''}
            </span>
          ))}
          <div style={{ marginTop: '4px' }}>请更新以上材料后重新提交</div>
        </div>
      )}

      <div class="detail-section">
        <h3>基本信息</h3>
        <div class="detail-grid">
          <div class="form-item">
            <label class="form-label">公司名称 *</label>
            <input
              class="form-input"
              type="text"
              value={formData.value.company_name}
              onInput$={(e) => (formData.value = { ...formData.value, company_name: (e.target as HTMLInputElement).value })}
              placeholder="请输入公司全称"
            />
          </div>
          <div class="form-item">
            <label class="form-label">所属行业</label>
            <input
              class="form-input"
              type="text"
              value={formData.value.industry}
              onInput$={(e) => (formData.value = { ...formData.value, industry: (e.target as HTMLInputElement).value })}
              placeholder="如：电子科技"
            />
          </div>
          <div class="form-item">
            <label class="form-label">联系人 *</label>
            <input
              class="form-input"
              type="text"
              value={formData.value.contact_person}
              onInput$={(e) => (formData.value = { ...formData.value, contact_person: (e.target as HTMLInputElement).value })}
              placeholder="请输入联系人姓名"
            />
          </div>
          <div class="form-item">
            <label class="form-label">联系电话 *</label>
            <input
              class="form-input"
              type="text"
              value={formData.value.contact_phone}
              onInput$={(e) => (formData.value = { ...formData.value, contact_phone: (e.target as HTMLInputElement).value })}
              placeholder="请输入联系电话"
            />
          </div>
          <div class="form-item">
            <label class="form-label">邮箱</label>
            <input
              class="form-input"
              type="email"
              value={formData.value.contact_email}
              onInput$={(e) => (formData.value = { ...formData.value, contact_email: (e.target as HTMLInputElement).value })}
              placeholder="请输入邮箱地址"
            />
          </div>
          <div class="form-item">
            <label class="form-label">展位类型</label>
            <select
              class="select"
              value={formData.value.booth_type}
              onChange$={(e) => (formData.value = { ...formData.value, booth_type: (e.target as HTMLSelectElement).value })}
            >
              <option value="">请选择</option>
              <option value="标准展位">标准展位</option>
              <option value="光地展位">光地展位</option>
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">展位尺寸</label>
            <input
              class="form-input"
              type="text"
              value={formData.value.booth_size}
              onInput$={(e) => (formData.value = { ...formData.value, booth_size: (e.target as HTMLInputElement).value })}
              placeholder="如：3m×3m"
            />
          </div>
          <div class="form-item">
            <label class="form-label">预计面积（㎡）</label>
            <input
              class="form-input"
              type="number"
              value={formData.value.expected_area}
              onInput$={(e) => (formData.value = { ...formData.value, expected_area: (e.target as HTMLInputElement).value })}
              placeholder="如：9"
            />
          </div>
        </div>
        <div class="form-item" style={{ marginTop: '12px' }}>
          <label class="form-label">产品描述</label>
          <textarea
            class="form-input form-textarea"
            value={formData.value.product_description}
            onInput$={(e) => (formData.value = { ...formData.value, product_description: (e.target as HTMLTextAreaElement).value })}
            placeholder="请简要描述展品/服务"
            rows={3}
          />
        </div>
      </div>

      <div class="detail-section" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>申请材料</h3>
          <button class="btn btn-default btn-sm" onClick$={addMaterial}>
            + 添加材料
          </button>
        </div>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
          至少上传营业执照，可添加税务登记证、产品目录、展位设计图等
        </p>
        <div class="material-list">
          {formData.value.materials.map((mat, index) => (
            <div key={index} class="material-item" style={{ alignItems: 'center' }}>
              <div class="material-info" style={{ flex: 1 }}>
                <select
                  class="select"
                  style={{ width: 'auto', marginRight: '8px' }}
                  value={mat.material_type}
                  onChange$={(e) => {
                    const newMaterials = [...formData.value.materials];
                    newMaterials[index] = { ...mat, material_type: (e.target as HTMLSelectElement).value };
                    formData.value = { ...formData.value, materials: newMaterials };
                  }}
                >
                  {Object.entries(materialTypeLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  class="form-input"
                  type="text"
                  style={{ flex: 1 }}
                  value={mat.material_name}
                  onInput$={(e) => {
                    const newMaterials = [...formData.value.materials];
                    newMaterials[index] = { ...mat, material_name: (e.target as HTMLInputElement).value };
                    formData.value = { ...formData.value, materials: newMaterials };
                  }}
                  placeholder="材料文件名"
                />
              </div>
              {formData.value.materials.length > 1 && (
                <button
                  class="btn btn-danger btn-sm"
                  onClick$={() => removeMaterial(index)}
                  style={{ marginLeft: '8px' }}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button class="btn btn-default" onClick$={props.onCancel$}>
          取消
        </button>
        <button class="btn btn-primary" onClick$={handleSubmit}>
          {props.submitLabel || '保存'}
        </button>
      </div>
    </div>
  );
});
