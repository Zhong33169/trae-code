import { createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../App';
import { api } from '../api';
import { EVENT_TYPE_LABELS, SEVERITY_LABELS } from '../types';

export function CreateEventPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [eventType, setEventType] = createSignal('adverse_event');
  const [severity, setSeverity] = createSignal('moderate');
  const [deadline, setDeadline] = createSignal('');
  const [materials, setMaterials] = createSignal<{ name: string; material_type: string; content: string }[]>([
    { name: '', material_type: 'document', content: '' },
  ]);
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const addMaterial = () => {
    setMaterials([...materials(), { name: '', material_type: 'document', content: '' }]);
  };

  const removeMaterial = (idx: number) => {
    const mats = [...materials()];
    mats.splice(idx, 1);
    setMaterials(mats);
  };

  const updateMaterial = (idx: number, field: string, value: string) => {
    const mats = [...materials()];
    mats[idx] = { ...mats[idx], [field]: value };
    setMaterials(mats);
  };

  const handleCreate = async () => {
    setError('');
    if (!title().trim()) { setError('标题不能为空'); return; }
    if (!deadline()) { setError('必须设定处理时限'); return; }
    const mats = materials().filter((m) => m.name.trim());
    const et = eventType();
    if (et === 'adverse_event' && mats.length < 1) { setError('不良事件必须至少上传1份材料'); return; }
    if (et === 'incident_report' && mats.length < 1) { setError('事件上报必须至少上传1份材料'); return; }
    if (et === 'rectification_tracking' && mats.length < 2) { setError('整改追踪必须至少上传2份材料'); return; }
    setLoading(true);
    try {
      const data = await api.createEvent({
        title: title(),
        description: description(),
        event_type: eventType(),
        severity: severity(),
        deadline: deadline(),
        materials: mats,
      });
      navigate(`/events/${data.event.id}`);
    } catch (err: any) {
      setError(err?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <button class="btn btn-outline" onClick={() => navigate('/events')}>← 返回</button>
        <h2 style="font-size: 20px; font-weight: 600;">新建医疗事件</h2>
      </div>

      <Show when={error()}>
        <div class="alert alert-error">{error()}</div>
      </Show>

      <div class="card">
        <div class="form-group">
          <label>标题 *</label>
          <input type="text" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="事件标题" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea value={description()} onInput={(e) => setDescription(e.currentTarget.value)} placeholder="事件描述" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label>事件类型 *</label>
            <select value={eventType()} onChange={(e) => setEventType(e.currentTarget.value)}>
              <For each={Object.entries(EVENT_TYPE_LABELS)}>
                {([value, label]) => <option value={value}>{label}</option>}
              </For>
            </select>
          </div>
          <div class="form-group">
            <label>严重程度 *</label>
            <select value={severity()} onChange={(e) => setSeverity(e.currentTarget.value)}>
              <For each={Object.entries(SEVERITY_LABELS)}>
                {([value, label]) => <option value={value}>{label}</option>}
              </For>
            </select>
          </div>
          <div class="form-group">
            <label>处理时限 *</label>
            <input type="datetime-local" value={deadline()} onInput={(e) => setDeadline(e.currentTarget.value)} />
          </div>
        </div>

        <div class="form-group">
          <label>材料 *（{eventType() === 'rectification_tracking' ? '至少2份' : '至少1份'}）</label>
          <For each={materials()}>
            {(mat, idx) => (
              <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <input
                  type="text"
                  placeholder="材料名称"
                  value={mat.name}
                  onInput={(ev) => updateMaterial(idx(), 'name', ev.currentTarget.value)}
                  style="flex: 1;"
                />
                <select
                  value={mat.material_type}
                  onChange={(ev) => updateMaterial(idx(), 'material_type', ev.currentTarget.value)}
                  style="width: 100px;"
                >
                  <option value="document">文档</option>
                  <option value="image">图片</option>
                </select>
                <input
                  type="text"
                  placeholder="内容描述"
                  value={mat.content}
                  onInput={(ev) => updateMaterial(idx(), 'content', ev.currentTarget.value)}
                  style="flex: 1;"
                />
                <button class="btn btn-outline btn-sm" onClick={() => removeMaterial(idx())} disabled={materials().length <= 1}>×</button>
              </div>
            )}
          </For>
          <button class="btn btn-outline btn-sm" onClick={addMaterial}>+ 添加材料</button>
        </div>

        <button class="btn btn-primary" onClick={handleCreate} disabled={loading()}>
          {loading() ? '创建中...' : '创建事件'}
        </button>
      </div>
    </div>
  );
}
