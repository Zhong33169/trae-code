import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { apiFetch } from '../utils/api';

interface AppItem {
  id: number;
  application_no: string;
  applicant_name: string;
  difficulty_type: string;
  status: string;
  deadline: string | null;
  version: number;
}

interface PendingMaterial {
  stage: string;
  file_name: string;
  file_path: string;
  material_type: string;
}

interface ItemMaterials {
  [appId: number]: PendingMaterial[];
}

interface BatchResult {
  application_id: number;
  application_no: string;
  success: boolean;
  from_status: string;
  error: string;
  suggestion: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  medical: '医疗困难',
  disaster: '灾害',
  disability: '残疾',
  low_income: '低收入',
  other: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_verify: '待核实',
  pending_approve: '待复核',
  approved: '已通过',
  rejected: '已驳回',
};

const STAGE_FOR_ACTION: Record<string, string> = {
  verify: 'verification',
  approve: 'approval',
};

const MATERIAL_TYPES: Record<string, string[]> = {
  verification: ['核验报告', '入户照片', '访谈记录', '证明材料'],
  approval: ['审批意见', '会议纪要', '公示截图'],
};

export default function BatchProcess() {
  const [queueType, setQueueType] = createSignal('pending_verify');
  const [items, setItems] = createSignal<AppItem[]>([]);
  const [selected, setSelected] = createSignal<Set<number>>(new Set());
  const [opinion, setOpinion] = createSignal('');
  const [itemMaterials, setItemMaterials] = createSignal<ItemMaterials>({});
  const [loading, setLoading] = createSignal(false);
  const [results, setResults] = createSignal<BatchResult[]>([]);
  const [batchId, setBatchId] = createSignal('');
  const [showResults, setShowResults] = createSignal(false);
  const [expandedId, setExpandedId] = createSignal<number | null>(null);

  const currentAction = createMemo(() => queueType() === 'pending_verify' ? 'verify' : 'approve');
  const currentStage = createMemo(() => STAGE_FOR_ACTION[currentAction()] || 'verification');

  const fetchData = async () => {
    try {
      const data = await apiFetch(`/api/applications?status=${queueType()}`);
      setItems(Array.isArray(data) ? data : []);
      setSelected(new Set<number>());
      setItemMaterials({});
    } catch {}
  };

  onMount(fetchData);

  const toggleSelect = (id: number) => {
    const s = new Set(selected());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected().size === items().length) {
      setSelected(new Set<number>());
    } else {
      setSelected(new Set(items().map(i => i.id)));
    }
  };

  const selectedItems = createMemo(() => items().filter(i => selected().has(i.id)));

  const addMaterialForItem = (appId: number) => {
    const stage = currentStage();
    const mats = itemMaterials()[appId] || [];
    setItemMaterials({
      ...itemMaterials(),
      [appId]: [...mats, {
        stage,
        file_name: '',
        file_path: `/uploads/${stage}/${appId}_${Date.now()}.pdf`,
        material_type: MATERIAL_TYPES[stage]?.[0] || 'document',
      }],
    });
  };

  const updateMaterialForItem = (appId: number, idx: number, field: keyof PendingMaterial, value: string) => {
    const mats = [...(itemMaterials()[appId] || [])];
    if (mats[idx]) {
      mats[idx] = { ...mats[idx], [field]: value };
      setItemMaterials({ ...itemMaterials(), [appId]: mats });
    }
  };

  const removeMaterialForItem = (appId: number, idx: number) => {
    const mats = [...(itemMaterials()[appId] || [])];
    mats.splice(idx, 1);
    setItemMaterials({ ...itemMaterials(), [appId]: mats });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId() === id ? null : id);
  };

  const handleBatch = async () => {
    if (selected().size === 0) return;
    setLoading(true);
    try {
      const action = currentAction();
      const batchItems = items()
        .filter(i => selected().has(i.id))
        .map(i => ({
          application_id: i.id,
          action,
          opinion: opinion(),
          materials: itemMaterials()[i.id] || [],
          version: i.version,
        }));
      const data = await apiFetch('/api/batch/advance', {
        method: 'POST',
        body: JSON.stringify({ items: batchItems }),
      });
      setResults(data.results || []);
      setBatchId(data.batch_id || '');
      setShowResults(true);
      fetchData();
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>批量处理</h2>

      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '14px', color: 'var(--text-light)' }}>选择队列:</span>
        <button
          onClick={() => { setQueueType('pending_verify'); fetchData(); }}
          style={{
            padding: '6px 16px',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            background: queueType() === 'pending_verify' ? 'var(--primary)' : 'var(--white)',
            color: queueType() === 'pending_verify' ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          待核实
        </button>
        <button
          onClick={() => { setQueueType('pending_approve'); fetchData(); }}
          style={{
            padding: '6px 16px',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            background: queueType() === 'pending_approve' ? 'var(--primary)' : 'var(--white)',
            color: queueType() === 'pending_approve' ? '#fff' : 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          待复核
        </button>
      </div>

      <Show when={!showResults()}>
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          marginBottom: '20px',
        }}>
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <input
              type="checkbox"
              checked={selected().size === items().length && items().length > 0}
              onChange={toggleAll}
              style={{ width: '16px', height: '16px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              全选 ({items().length} 条)
            </span>
            <Show when={selected().size > 0}>
              <span style={{ fontSize: '13px', color: 'var(--primary)' }}>
                已选 {selected().size} 条（点击行右侧箭头填写材料）
              </span>
            </Show>
          </div>
          <For each={items()} fallback={
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)' }}>
              暂无数据
            </div>
          }>
            {(item) => {
              const isExpanded = expandedId() === item.id;
              const mats = itemMaterials()[item.id] || [];
              const isSelected = selected().has(item.id);
              return (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '14px',
                    background: isSelected ? 'var(--bg)' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      style={{ width: '16px', height: '16px', flexShrink: 0 }}
                    />
                    <span style={{ width: '130px', color: 'var(--text-light)', fontSize: '13px' }}>
                      {item.application_no}
                    </span>
                    <span style={{ width: '80px', fontWeight: 500 }}>{item.applicant_name}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: 'var(--bg)',
                      color: 'var(--text-light)',
                      marginRight: '8px',
                    }}>
                      {DIFFICULTY_LABELS[item.difficulty_type] || item.difficulty_type}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                      v{item.version}
                    </span>
                    <Show when={isSelected}>
                      <button
                        onClick={() => toggleExpand(item.id)}
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          color: 'var(--primary)',
                          fontSize: '12px',
                        }}
                      >
                        {isExpanded ? '收起材料' : `填写材料 (${mats.length})`}
                      </button>
                    </Show>
                  </div>
                  <Show when={isExpanded && isSelected}>
                    <div style={{
                      padding: '12px 20px 16px 56px',
                      background: '#fafafa',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        marginBottom: '10px',
                        color: 'var(--text)',
                      }}>
                        材料清单（{currentStage() === 'verification' ? '核验阶段' : '审批阶段'}）
                      </div>
                      <For each={mats}>
                        {(mat, idx) => (
                          <div style={{
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            marginBottom: '8px',
                          }}>
                            <select
                              value={mat.material_type}
                              onChange={(e) => updateMaterialForItem(item.id, idx(), 'material_type', e.currentTarget.value)}
                              style={{
                                padding: '6px 10px',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                fontSize: '13px',
                                width: '120px',
                              }}
                            >
                              <For each={MATERIAL_TYPES[currentStage()] || []}>
                                {(t) => <option value={t}>{t}</option>}
                              </For>
                            </select>
                            <input
                              value={mat.file_name}
                              onInput={(e) => updateMaterialForItem(item.id, idx(), 'file_name', e.currentTarget.value)}
                              placeholder="文件名（如：核验报告.pdf）"
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                fontSize: '13px',
                              }}
                            />
                            <button
                              onClick={() => removeMaterialForItem(item.id, idx())}
                              style={{
                                padding: '4px 10px',
                                color: 'var(--danger)',
                                fontSize: '12px',
                                background: 'none',
                              }}
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </For>
                      <button
                        onClick={() => addMaterialForItem(item.id)}
                        style={{
                          padding: '6px 14px',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: '12px',
                          color: 'var(--primary)',
                          background: 'none',
                          marginTop: '4px',
                        }}
                      >
                        + 添加材料项
                      </button>
                    </div>
                  </Show>
                </>
              );
            }}
          </For>
        </div>

        <Show when={selected().size > 0}>
          <div style={{
            background: 'var(--white)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <label style={{ fontSize: '13px', color: 'var(--text-light)', flexShrink: 0 }}>
              批量意见
            </label>
            <input
              value={opinion()}
              onInput={(e) => setOpinion(e.currentTarget.value)}
              placeholder="输入批量处理意见（可选）"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
              }}
            />
            <button
              onClick={handleBatch}
              disabled={loading()}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                padding: '8px 24px',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                opacity: loading() ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              批量推进
            </button>
          </div>
        </Show>
      </Show>

      <Show when={showResults()}>
        <div style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600 }}>批量处理结果</span>
              <Show when={batchId()}>
                <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                  批次号: {batchId()}
                </span>
              </Show>
            </div>
            <button
              onClick={() => setShowResults(false)}
              style={{
                background: 'none',
                color: 'var(--primary)',
                fontSize: '13px',
              }}
            >
              继续处理
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>申请编号</th>
                <th>原状态</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              <For each={results()}>
                {(r) => {
                  const [expanded, setExpanded] = createSignal(false);
                  return (
                    <>
                      <tr style={{ background: r.success ? '#f0fff4' : '#fff5f5' }}>
                        <td>
                          <span style={{ fontSize: '16px' }}>
                            {r.success ? '✅' : '❌'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', fontWeight: 500 }}>
                          {r.application_no || `#${r.application_id}`}
                        </td>
                        <td>
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--bg)',
                            color: 'var(--text-light)',
                          }}>
                            {STATUS_LABELS[r.from_status] || r.from_status || '-'}
                          </span>
                        </td>
                        <td>
                          <Show when={r.success} fallback={
                            <div>
                              <span style={{ color: 'var(--danger)', fontSize: '13px' }}>
                                {r.error || '处理失败'}
                              </span>
                              <Show when={r.suggestion}>
                                <button
                                  onClick={() => setExpanded(!expanded())}
                                  style={{
                                    background: 'none',
                                    color: 'var(--primary)',
                                    fontSize: '12px',
                                    marginLeft: '8px',
                                  }}
                                >
                                  {expanded() ? '收起' : '查看建议'}
                                </button>
                              </Show>
                            </div>
                          }>
                            <span style={{ color: 'var(--success)', fontSize: '13px' }}>处理成功</span>
                          </Show>
                        </td>
                      </tr>
                      <Show when={expanded() && r.suggestion}>
                        <tr>
                          <td colSpan={4} style={{
                            background: '#fffbea',
                            fontSize: '13px',
                            color: 'var(--warning)',
                            padding: '8px 12px 8px 48px',
                          }}>
                            💡 下一步建议: {r.suggestion}
                          </td>
                        </tr>
                      </Show>
                    </>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
