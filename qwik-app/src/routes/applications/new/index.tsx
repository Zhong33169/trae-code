import { component$, useSignal, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { useAuthCheck } from '../../layout';
import ApplicationForm, { emptyForm, type ApplicationFormData } from '~/components/application-form';
import { createApplication } from '~/utils/api';

export default component$(() => {
  const nav = useNavigate();
  const auth = useAuthCheck();
  const message = useSignal<{ type: string; text: string } | null>(null);
  const submitting = useSignal(false);

  const showMessage = $((type: string, text: string) => {
    message.value = { type, text };
    setTimeout(() => (message.value = null), 3000);
  });

  const handleSubmit = $(async (data: ApplicationFormData) => {
    submitting.value = true;
    try {
      const app = await createApplication({
        company_name: data.company_name,
        contact_person: data.contact_person,
        contact_phone: data.contact_phone,
        contact_email: data.contact_email || undefined,
        booth_type: data.booth_type || undefined,
        booth_size: data.booth_size || undefined,
        expected_area: data.expected_area ? parseFloat(data.expected_area) : undefined,
        industry: data.industry || undefined,
        product_description: data.product_description || undefined,
        materials: data.materials.map((m) => ({
          material_type: m.material_type,
          material_name: m.material_name,
          file_path: m.file_path,
        })),
      });
      showMessage('success', `申请创建成功：${app.application_no}`);
      setTimeout(() => nav(`/applications/${app.id}`), 800);
    } catch (e: any) {
      showMessage('error', e.message || '创建失败');
    } finally {
      submitting.value = false;
    }
  });

  return (
    <div>
      {message.value && (
        <div class={`message message-${message.value.type}`}>{message.value.text}</div>
      )}

      <button
        class="btn btn-default"
        style={{ marginBottom: '16px' }}
        onClick$={() => nav('/applications')}
      >
        ← 返回列表
      </button>

      <div class="card" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>新建展商申请</h2>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          填写展商信息并上传材料后可保存草稿，确认无误后提交进入审核流程
        </p>
      </div>

      <ApplicationForm
        initialData={emptyForm}
        submitLabel={submitting.value ? '保存中...' : '保存草稿'}
        onSubmit$={handleSubmit}
        onCancel$={() => nav('/applications')}
      />
    </div>
  );
});

export const head = {
  title: '新建申请 - 展商申请管理系统',
};
