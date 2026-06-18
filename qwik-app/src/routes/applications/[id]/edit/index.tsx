import { component$, useSignal, useTask$, $ } from '@builder.io/qwik';
import { useNavigate, routeLoader$ } from '@builder.io/qwik-city';
import { useAuthCheck } from '../../layout';
import ApplicationForm, { type ApplicationFormData } from '~/components/application-form';
import { getApplication, updateApplication } from '~/utils/api';

export const useEditId = routeLoader$(({ params }) => {
  return { id: params.id ? parseInt(params.id) : 0 };
});

export default component$(() => {
  const nav = useNavigate();
  const params = useEditId();
  const auth = useAuthCheck();

  const application = useSignal<any>(null);
  const loading = useSignal(true);
  const message = useSignal<{ type: string; text: string } | null>(null);
  const submitting = useSignal(false);

  const showMessage = $((type: string, text: string) => {
    message.value = { type, text };
    setTimeout(() => (message.value = null), 3000);
  });

  const loadDetail = $(async () => {
    if (!params.value.id) return;
    loading.value = true;
    try {
      const data = await getApplication(params.value.id);
      application.value = data;
    } catch (e: any) {
      showMessage('error', e.message || '加载失败');
    } finally {
      loading.value = false;
    }
  });

  useTask$(({ track }) => {
    track(() => params.value.id);
    loadDetail();
  });

  const app = application.value;

  const isCorrection = app?.status === 'correction_requested';
  const rejectedMaterialNames = app?.materials
    ?.filter((m: any) => m.is_approved === false)
    .map((m: any) => m.material_name) || [];

  const initialFormData: Partial<ApplicationFormData> | undefined = app
    ? {
        company_name: app.company_name,
        contact_person: app.contact_person,
        contact_phone: app.contact_phone,
        contact_email: app.contact_email || '',
        booth_type: app.booth_type || '',
        booth_size: app.booth_size || '',
        expected_area: app.expected_area ? String(app.expected_area) : '',
        industry: app.industry || '',
        product_description: app.product_description || '',
        materials: app.materials.map((m: any) => ({
          material_type: m.material_type,
          material_name: m.material_name,
          file_path: m.file_path,
        })),
      }
    : undefined;

  const handleSubmit = $(async (data: ApplicationFormData) => {
    if (!app) return;
    submitting.value = true;
    try {
      await updateApplication(app.id, app.version, {
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
      showMessage('success', '申请已更新');
      setTimeout(() => nav(`/applications/${app.id}`), 800);
    } catch (e: any) {
      if (e.code === 'VERSION_CONFLICT' || e.statusCode === 409) {
        showMessage('error', '申请已被其他操作修改，正在刷新...');
        loadDetail();
      } else {
        showMessage('error', e.message || '更新失败');
      }
    } finally {
      submitting.value = false;
    }
  });

  if (loading.value || !app) {
    return (
      <div>
        <button class="btn btn-default" style={{ marginBottom: '16px' }} onClick$={() => nav(`/applications/${params.value.id}`)}>
          ← 返回详情
        </button>
        <div class="card">
          <div class="empty-state">加载中...</div>
        </div>
      </div>
    );
  }

  if (app.status !== 'draft' && app.status !== 'correction_requested') {
    return (
      <div>
        {message.value && (
          <div class={`message message-${message.value.type}`}>{message.value.text}</div>
        )}
        <button class="btn btn-default" style={{ marginBottom: '16px' }} onClick$={() => nav(`/applications/${app.id}`)}>
          ← 返回详情
        </button>
        <div class="card">
          <div class="empty-state">
            当前状态【{app.status}】不可编辑，仅草稿和待补正状态可编辑
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {message.value && (
        <div class={`message message-${message.value.type}`}>{message.value.text}</div>
      )}

      <button
        class="btn btn-default"
        style={{ marginBottom: '16px' }}
        onClick$={() => nav(`/applications/${app.id}`)}
      >
        ← 返回详情
      </button>

      <div class="card" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px' }}>
          {isCorrection ? '补正申请' : '编辑申请'}
          <span style={{ marginLeft: '12px', fontSize: '13px', color: '#888' }}>
            {app.application_no}
          </span>
        </h2>
        <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
          {isCorrection
            ? '请根据补正要求更新材料后保存，确认无误后点击"补正提交"进入审核'
            : '修改展商信息或材料后保存草稿，确认无误后提交进入审核流程'}
        </p>
      </div>

      <ApplicationForm
        initialData={initialFormData}
        isCorrection={isCorrection}
        rejectedMaterialNames={rejectedMaterialNames}
        submitLabel={submitting.value ? '保存中...' : '保存'}
        onSubmit$={handleSubmit}
        onCancel$={() => nav(`/applications/${app.id}`)}
      />
    </div>
  );
});

export const head = {
  title: '编辑申请 - 展商申请管理系统',
};
