import type { Component } from 'solid-js';
import { createSignal, createEffect, onMount, Show, For } from 'solid-js';
import {
  getOrderList,
  getCurrentUser,
  setCurrentUser,
  getStatistics,
  getUsers,
  submitOrder,
  resubmitOrder,
  verifyOrder,
  reviewOrder,
  archiveOrder,
  addSupplement,
  addEvidence,
  batchSubmit,
  getOrderDetail,
  type OrderQuery,
} from '../api';
import type {
  InventoryAdjustOrder,
  OrderStatus,
  OrderDetailResponse,
  User,
  SupplementType,
  SupplementRecord,
  OrderEvidence,
  EvidenceType,
} from '../types';
import {
  statusText,
  statusColor,
  roleText,
  supplementTypeText,
  evidenceTypeText,
} from '../types';

const MainLayout: Component<{ onLogout: () => void }> = (props) => {
  const [currentUser, setUser] = createSignal<User | null>(getCurrentUser());
  const [users, setUsers] = createSignal<User[]>([]);
  const [orders, setOrders] = createSignal<InventoryAdjustOrder[]>([]);
  const [total, setTotal] = createSignal(0);
  const [groups, setGroups] = createSignal<Record<string, number>>({});
  const [loading, setLoading] = createSignal(false);
  const [selectedOrder, setSelectedOrder] = createSignal<InventoryAdjustOrder | null>(null);
  const [orderDetail, setOrderDetail] = createSignal<OrderDetailResponse | null>(null);
  const [selectedIds, setSelectedIds] = createSignal<number[]>([]);
  const [showDetail, setShowDetail] = createSignal(false);
  const [showSupplement, setShowSupplement] = createSignal(false);
  const [showEvidence, setShowEvidence] = createSignal(false);
  const [statistics, setStatistics] = createSignal<any>(null);
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshTick, setRefreshTick] = createSignal(0);

  const [query, setQuery] = createSignal<OrderQuery>({
    page: 1,
    page_size: 10,
  });

  const [supplementForm, setSupplementForm] = createSignal({
    type: 'exception' as SupplementType,
    content: '',
    field_name: '',
    old_value: '',
    new_value: '',
    reason: '',
  });

  const [evidenceForm, setEvidenceForm] = createSignal({
    type: 'supplement' as EvidenceType,
    file_name: '',
    file_type: '',
    file_size: 0,
    remark: '',
  });

  const [opinionForm, setOpinionForm] = createSignal({
    pass: true,
    opinion: '',
  });

  onMount(async () => {
    const usersRes = await getUsers();
    if (usersRes.code === 200 && usersRes.data) {
      setUsers(usersRes.data);
    }
    refreshAll();
  });

  createEffect(() => {
    const _tick = refreshTick();
    loadList();
    loadStatistics();
  });

  createEffect(() => {
    const q = query();
    loadList();
  });

  const refreshAll = () => {
    setRefreshTick((t) => t + 1);
    const sel = selectedOrder();
    if (sel) {
      loadOrderDetail(sel.id);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await getOrderList(query());
      if (res.code === 200 && res.data) {
        setOrders(res.data.list);
        setTotal(res.data.total);
        setGroups(res.data.groups);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    const res = await getStatistics();
    if (res.code === 200 && res.data) {
      setStatistics(res.data);
    }
  };

  const loadOrderDetail = async (orderId: number) => {
    const res = await getOrderDetail(orderId);
    if (res.code === 200 && res.data) {
      setOrderDetail(res.data);
      const updated = res.data.order;
      setSelectedOrder((prev) => {
        if (prev && prev.id === updated.id) return updated;
        return prev;
      });
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const switchRole = (user: User) => {
    setCurrentUser(user);
    setUser(user);
    setSelectedIds([]);
    setSelectedOrder(null);
    setShowDetail(false);
    setOrderDetail(null);
    showMessage('success', `已切换到 ${user.real_name}（${roleText[user.role]}）`);
    refreshAll();
  };

  const handleStatusFilter = (status: OrderStatus | null) => {
    if (status) {
      setQuery({ ...query(), status: [status], page: 1 });
    } else {
      const { status: _, ...rest } = query();
      setQuery({ ...rest, page: 1 });
    }
    setSelectedIds([]);
    setSelectedOrder(null);
  };

  const toggleSelect = (orderId: number) => {
    const ids = selectedIds();
    if (ids.includes(orderId)) {
      setSelectedIds(ids.filter((id) => id !== orderId));
    } else {
      setSelectedIds([...ids, orderId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds().length === orders().length && orders().length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders().map((o) => o.id));
    }
  };

  const viewOrder = async (order: InventoryAdjustOrder) => {
    setSelectedOrder(order);
    setShowDetail(true);
    await loadOrderDetail(order.id);
  };

  const handleSubmit = async (order: InventoryAdjustOrder) => {
    const res = await submitOrder(order.id, order.version);
    if (res.code === 200) {
      showMessage('success', '提交成功');
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '提交失败');
    }
  };

  const handleResubmit = async (order: InventoryAdjustOrder) => {
    const res = await resubmitOrder(order.id, order.version);
    if (res.code === 200) {
      showMessage('success', '重新提交成功');
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '重新提交失败');
    }
  };

  const handleVerify = async (order: InventoryAdjustOrder) => {
    if (!opinionForm().pass && !opinionForm().opinion.trim()) {
      showMessage('error', '退回时必须填写意见');
      return;
    }
    const res = await verifyOrder(order.id, order.version, opinionForm().pass, opinionForm().opinion);
    if (res.code === 200) {
      showMessage('success', opinionForm().pass ? '核验通过' : '已退回');
      setOpinionForm({ pass: true, opinion: '' });
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '核验失败');
    }
  };

  const handleReview = async (order: InventoryAdjustOrder) => {
    if (!opinionForm().pass && !opinionForm().opinion.trim()) {
      showMessage('error', '退回时必须填写意见');
      return;
    }
    const res = await reviewOrder(order.id, order.version, opinionForm().pass, opinionForm().opinion);
    if (res.code === 200) {
      showMessage('success', opinionForm().pass ? '复核通过' : '已退回');
      setOpinionForm({ pass: true, opinion: '' });
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '复核失败');
    }
  };

  const handleArchive = async (order: InventoryAdjustOrder) => {
    const res = await archiveOrder(order.id, order.version);
    if (res.code === 200) {
      showMessage('success', '归档成功');
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '归档失败');
    }
  };

  const handleSupplement = async () => {
    const order = selectedOrder();
    if (!order) return;

    if (!supplementForm().content.trim() || !supplementForm().reason.trim()) {
      showMessage('error', '请填写补录内容和原因');
      return;
    }

    const res = await addSupplement({
      order_id: order.id,
      ...supplementForm(),
    });

    if (res.code === 200) {
      showMessage('success', '补录成功');
      setShowSupplement(false);
      setSupplementForm({
        type: 'exception',
        content: '',
        field_name: '',
        old_value: '',
        new_value: '',
        reason: '',
      });
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '补录失败');
    }
  };

  const handleAddEvidence = async () => {
    const order = selectedOrder();
    if (!order) return;

    if (!evidenceForm().file_name.trim()) {
      showMessage('error', '请填写证据文件名');
      return;
    }

    const res = await addEvidence({
      order_id: order.id,
      ...evidenceForm(),
    });

    if (res.code === 200) {
      showMessage('success', '证据补充成功');
      setShowEvidence(false);
      setEvidenceForm({
        type: 'supplement',
        file_name: '',
        file_type: '',
        file_size: 0,
        remark: '',
      });
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '补充证据失败');
    }
  };

  const handleBatchSubmit = async () => {
    if (selectedIds().length === 0) {
      showMessage('error', '请先选择要提交的订单');
      return;
    }
    const res = await batchSubmit(selectedIds());
    if (res.code === 200) {
      showMessage(
        'success',
        `批量提交完成：成功 ${res.data?.success_count || 0} 条，失败 ${res.data?.fail_count || 0} 条`
      );
      setSelectedIds([]);
      refreshAll();
    } else {
      showMessage('error', res.details || res.message || '批量提交失败');
    }
  };

  const canSubmit = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (user.role !== 'warehouse_keeper') return false;
    if (order.created_by !== user.id) return false;
    return ['pending_submit', 'resubmitted'].includes(order.status);
  };

  const canResubmit = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (user.role !== 'warehouse_keeper') return false;
    if (order.created_by !== user.id) return false;
    return order.status === 'returned';
  };

  const canVerify = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (user.role !== 'warehouse_supervisor') return false;
    return order.status === 'pending_verify';
  };

  const canReview = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (user.role !== 'operation_manager') return false;
    return order.status === 'pending_review';
  };

  const canArchive = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (user.role !== 'operation_manager') return false;
    return order.status === 'review_passed';
  };

  const canSupplement = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (order.status === 'archived') return false;
    if (user.role === 'warehouse_keeper' && order.created_by !== user.id) return false;
    return true;
  };

  const canAddEvidence = (order: InventoryAdjustOrder) => {
    const user = currentUser();
    if (!user) return false;
    if (order.status === 'archived') return false;
    return true;
  };

  const filterGroups: { key: OrderStatus | null; label: string; color: string }[] = [
    { key: null, label: '全部', color: '#595959' },
    { key: 'pending_submit', label: '待提交', color: statusColor.pending_submit },
    { key: 'returned', label: '已退回', color: statusColor.returned },
    { key: 'resubmitted', label: '重新提交', color: statusColor.resubmitted },
  ];

  const allWarehouses = Array.from(new Set(orders().map((o) => o.warehouse)));

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Show when={message()}>
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            background: message()?.type === 'success' ? '#f6ffed' : '#fff2f0',
            border: `1px solid ${message()?.type === 'success' ? '#b7eb8f' : '#ffccc7'}`,
            color: message()?.type === 'success' ? '#52c41a' : '#cf1322',
            borderRadius: '8px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {message()?.text}
        </div>
      </Show>

      <header style={{
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#262626', margin: 0 }}>
            库存调整单管理系统
          </h1>
          <span style={{ color: '#8c8c8c', fontSize: '13px' }}>
            移动补录校验
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#8c8c8c' }}>角色切换：</span>
            <select
              value={currentUser()?.id || ''}
              onChange={(e) => {
                const user = users().find((u) => u.id === Number((e.target as HTMLSelectElement).value));
                if (user) switchRole(user);
              }}
              style={{
                padding: '6px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
              }}
            >
              <For each={users()}>
                {(user) => (
                  <option value={user.id}>
                    {user.real_name}（{roleText[user.role]}）
                  </option>
                )}
              </For>
            </select>
          </div>

          <div style={{
            padding: '6px 12px',
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '6px',
            color: '#1890ff',
            fontSize: '13px',
          }}>
            {currentUser()?.real_name}（{roleText[currentUser()?.role || 'warehouse_keeper']}）
          </div>

          <button
            onClick={() => {
              setCurrentUser(null);
              props.onLogout();
            }}
            style={{
              padding: '6px 16px',
              background: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              color: '#595959',
              fontSize: '13px',
            }}
          >
            退出
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <For each={filterGroups}>
                {(group) => (
                  <button
                    onClick={() => handleStatusFilter(group.key)}
                    style={{
                      padding: '6px 16px',
                      border: 'none',
                      borderRadius: '16px',
                      background: (!query().status && group.key === null) ||
                        (query().status?.includes(group.key!))
                        ? group.color
                        : '#f5f5f5',
                      color: (!query().status && group.key === null) ||
                        (query().status?.includes(group.key!))
                        ? '#fff'
                        : '#595959',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                  >
                    {group.label}
                    {group.key && groups()[group.key] !== undefined && (
                      <span style={{ marginLeft: '4px' }}>({groups()[group.key]})</span>
                    )}
                  </button>
                )}
              </For>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <select
                value={query().warehouse || ''}
                onChange={(e) => {
                  setQuery({ ...query(), warehouse: (e.target as HTMLSelectElement).value || undefined, page: 1 });
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <option value="">全部仓库</option>
                <For each={allWarehouses}>
                  {(wh) => <option value={wh}>{wh}</option>}
                </For>
              </select>

              <input
                type="text"
                placeholder="搜索单号、SKU、商品名..."
                value={query().keyword || ''}
                onInput={(e) => setQuery({ ...query(), keyword: (e.target as HTMLInputElement).value, page: 1 })}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                  width: '200px',
                }}
              />
            </div>
          </div>

          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            {statistics && [
              { label: '待提交', value: statistics.status_stats?.pending_submit || 0, color: '#faad14' },
              { label: '已退回', value: statistics.status_stats?.returned || 0, color: '#ff4d4f' },
              { label: '重新提交', value: statistics.status_stats?.resubmitted || 0, color: '#1890ff' },
              { label: '待核验', value: statistics.status_stats?.pending_verify || 0, color: '#fa8c16' },
              { label: '核验通过', value: statistics.status_stats?.verify_passed || 0, color: '#52c41a' },
              { label: '待复核', value: statistics.status_stats?.pending_review || 0, color: '#722ed1' },
              { label: '复核通过', value: statistics.status_stats?.review_passed || 0, color: '#13c2c2' },
              { label: '已归档', value: statistics.status_stats?.archived || 0, color: '#8c8c8c' },
            ].map((item) => (
              <div key={item.label} style={{
                flex: 1,
                minWidth: '100px',
                padding: '12px',
                background: '#fafafa',
                borderRadius: '8px',
                borderLeft: `4px solid ${item.color}`,
              }}>
                <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600, color: item.color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}>
            <button
              onClick={toggleSelectAll}
              style={{
                padding: '6px 16px',
                background: selectedIds().length === orders().length && orders().length > 0 ? '#1890ff' : '#fff',
                color: selectedIds().length === orders().length && orders().length > 0 ? '#fff' : '#595959',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {selectedIds().length === orders().length && orders().length > 0 ? '取消全选' : '全选'}
            </button>

            <span style={{ color: '#8c8c8c', fontSize: '13px' }}>
              已选 {selectedIds().length} 项
            </span>

            <button
              onClick={handleBatchSubmit}
              disabled={selectedIds().length === 0 || currentUser()?.role !== 'warehouse_keeper'}
              style={{
                padding: '6px 16px',
                background: selectedIds().length > 0 && currentUser()?.role === 'warehouse_keeper'
                  ? '#52c41a'
                  : '#d9d9d9',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: selectedIds().length > 0 && currentUser()?.role === 'warehouse_keeper'
                  ? 'pointer'
                  : 'not-allowed',
              }}
            >
              批量提交
            </button>

            <button
              onClick={() => refreshAll()}
              style={{
                padding: '6px 16px',
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                color: '#595959',
                fontSize: '13px',
                marginLeft: 'auto',
              }}
            >
              刷新
            </button>
          </div>

          <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%' }}>
              <thead style={{ background: '#fafafa' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959', width: '40px' }}></th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959' }}>单号</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959' }}>标题</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959' }}>仓库</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959' }}>SKU</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#595959' }}>调整数量</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#595959' }}>状态</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#595959' }}>版本</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, color: '#595959' }}>创建人</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 500, color: '#595959' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                <Show when={loading()}>
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#8c8c8c' }}>
                      加载中...
                    </td>
                  </tr>
                </Show>
                <Show when={!loading() && orders().length === 0}>
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#8c8c8c' }}>
                      暂无数据
                    </td>
                  </tr>
                </Show>
                <For each={orders()}>
                  {(order) => (
                    <tr
                      style={{
                        borderTop: '1px solid #f0f0f0',
                        background: selectedOrder()?.id === order.id ? '#e6f7ff' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => viewOrder(order)}
                    >
                      <td style={{ padding: '12px 16px' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds().includes(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#1890ff' }}>
                        {order.order_no}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{order.title}</td>
                      <td style={{ padding: '12px 16px' }}>{order.warehouse}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {order.sku}
                      </td>
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        color: order.adjust_quantity > 0 ? '#52c41a' : '#ff4d4f',
                        fontWeight: 500,
                      }}>
                        {order.adjust_quantity > 0 ? '+' : ''}{order.adjust_quantity}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: statusColor[order.status] + '20',
                          color: statusColor[order.status],
                          fontSize: '12px',
                          fontWeight: 500,
                        }}>
                          {statusText[order.status]}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#8c8c8c' }}>
                        v{order.version}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{order.created_by_name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => viewOrder(order)}
                            style={{
                              padding: '4px 8px',
                              background: '#fff',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              color: '#1890ff',
                              fontSize: '12px',
                            }}
                          >
                            详情
                          </button>
                          <Show when={canSubmit(order)}>
                            <button
                              onClick={() => handleSubmit(order)}
                              style={{
                                padding: '4px 8px',
                                background: '#52c41a',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            >
                              提交
                            </button>
                          </Show>
                          <Show when={canResubmit(order)}>
                            <button
                              onClick={() => handleResubmit(order)}
                              style={{
                                padding: '4px 8px',
                                background: '#1890ff',
                                border: 'none',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            >
                              重提
                            </button>
                          </Show>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            <div style={{
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #f0f0f0',
            }}>
              <span style={{ color: '#8c8c8c', fontSize: '13px' }}>
                共 {total()} 条
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={query().page! <= 1}
                  onClick={() => setQuery({ ...query(), page: (query().page || 1) - 1 })}
                  style={{
                    padding: '6px 12px',
                    background: query().page! > 1 ? '#fff' : '#f5f5f5',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    color: query().page! > 1 ? '#595959' : '#bfbfbf',
                    fontSize: '13px',
                    cursor: query().page! > 1 ? 'pointer' : 'not-allowed',
                  }}
                >
                  上一页
                </button>
                <span style={{
                  padding: '6px 12px',
                  color: '#595959',
                  fontSize: '13px',
                }}>
                  {query().page} / {Math.ceil(total() / (query().page_size || 10)) || 1}
                </span>
                <button
                  disabled={query().page! >= Math.ceil(total() / (query().page_size || 10))}
                  onClick={() => setQuery({ ...query(), page: (query().page || 1) + 1 })}
                  style={{
                    padding: '6px 12px',
                    background: query().page! < Math.ceil(total() / (query().page_size || 10)) ? '#fff' : '#f5f5f5',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    color: query().page! < Math.ceil(total() / (query().page_size || 10)) ? '#595959' : '#bfbfbf',
                    fontSize: '13px',
                    cursor: query().page! < Math.ceil(total() / (query().page_size || 10)) ? 'pointer' : 'not-allowed',
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          width: '400px',
          background: '#fff',
          borderLeft: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {selectedOrder() ? '订单关键证据' : '请选择订单查看详情'}
            </h3>
            <Show when={selectedOrder()}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Show when={canAddEvidence(selectedOrder()!)}>
                  <button
                    onClick={() => setShowEvidence(true)}
                    style={{
                      padding: '4px 10px',
                      background: '#1890ff',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  >
                    + 补充证据
                  </button>
                </Show>
                <Show when={canSupplement(selectedOrder()!)}>
                  <button
                    onClick={() => setShowSupplement(true)}
                    style={{
                      padding: '4px 10px',
                      background: '#722ed1',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  >
                    + 移动补录
                  </button>
                </Show>
              </div>
            </Show>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <Show when={!selectedOrder()}>
              <div style={{
                textAlign: 'center',
                color: '#8c8c8c',
                padding: '60px 20px',
                fontSize: '13px',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>&#128203;</div>
                点击左侧订单查看登记、过程核验、复核归档的关键证据
              </div>
            </Show>

            <Show when={selectedOrder() && orderDetail()}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  color: '#8c8c8c',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}>
                  基本信息
                </div>
                <div style={{
                  background: '#fafafa',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#8c8c8c' }}>单号：</span>
                    <span style={{ fontFamily: 'monospace' }}>{orderDetail()!.order.order_no}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#8c8c8c' }}>状态：</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: statusColor[orderDetail()!.order.status] + '20',
                      color: statusColor[orderDetail()!.order.status],
                      fontSize: '12px',
                    }}>
                      {statusText[orderDetail()!.order.status]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#8c8c8c' }}>版本：</span>
                    <span>v{orderDetail()!.order.version}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#8c8c8c' }}>调整数量：</span>
                    <span style={{
                      color: orderDetail()!.order.adjust_quantity > 0 ? '#52c41a' : '#ff4d4f',
                      fontWeight: 500,
                    }}>
                      {orderDetail()!.order.adjust_quantity > 0 ? '+' : ''}{orderDetail()!.order.adjust_quantity}
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: '#8c8c8c' }}>调整原因：</span>
                    <div style={{ marginTop: '4px', color: '#262626' }}>
                      {orderDetail()!.order.adjust_reason}
                    </div>
                  </div>
                  <Show when={orderDetail()!.order.verify_opinion}>
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: '4px',
                      color: '#389e0d',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        核验意见：
                      </div>
                      {orderDetail()!.order.verify_opinion}
                    </div>
                  </Show>
                  <Show when={orderDetail()!.order.return_reason}>
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: '#fff2f0',
                      border: '1px solid #ffccc7',
                      borderRadius: '4px',
                      color: '#cf1322',
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                        退回意见：
                      </div>
                      {orderDetail()!.order.return_reason}
                    </div>
                  </Show>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  color: '#8c8c8c',
                  marginBottom: '8px',
                  fontWeight: 500,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>证据材料 ({orderDetail()!.evidences.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <For each={orderDetail()!.evidences}>
                    {(evidence: OrderEvidence) => (
                      <div style={{
                        padding: '10px',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            padding: '1px 6px',
                            background: '#1890ff20',
                            color: '#1890ff',
                            borderRadius: '3px',
                            fontSize: '11px',
                          }}>
                            {evidenceTypeText[evidence.type]}
                          </span>
                          <span style={{ color: '#262626', fontWeight: 500 }}>
                            &#128206; {evidence.file_name}
                          </span>
                        </div>
                        <div style={{ color: '#8c8c8c', fontSize: '11px' }}>
                          {evidence.remark}
                        </div>
                        <div style={{ color: '#8c8c8c', fontSize: '11px', marginTop: '2px' }}>
                          {evidence.upload_by_name} · {new Date(evidence.create_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={orderDetail()!.evidences.length === 0}>
                    <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '20px', fontSize: '12px' }}>
                      暂无证据材料
                    </div>
                  </Show>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '13px',
                  color: '#8c8c8c',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}>
                  补录记录 ({orderDetail()!.supplements.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <For each={orderDetail()!.supplements}>
                    {(supp: SupplementRecord) => (
                      <div style={{
                        padding: '10px',
                        border: '1px solid #f0f0f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        borderLeft: '3px solid ' + (
                          supp.type === 'exception' ? '#ff4d4f' :
                          supp.type === 'correct' ? '#faad14' : '#722ed1'
                        ),
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            padding: '1px 6px',
                            background: (
                              supp.type === 'exception' ? '#ff4d4f20' :
                              supp.type === 'correct' ? '#faad1420' : '#722ed120'
                            ),
                            color: (
                              supp.type === 'exception' ? '#ff4d4f' :
                              supp.type === 'correct' ? '#faad14' : '#722ed1'
                            ),
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}>
                            {supplementTypeText[supp.type]}
                          </span>
                          <span style={{ color: '#8c8c8c', fontSize: '11px' }}>
                            {supp.supplemented_by_name}
                          </span>
                          <span style={{ color: '#bfbfbf', fontSize: '11px', marginLeft: 'auto' }}>
                            {new Date(supp.create_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: '#262626', marginBottom: '4px' }}>
                          {supp.content}
                        </div>
                        <Show when={supp.field_name}>
                          <div style={{
                            padding: '6px',
                            background: '#fafafa',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}>
                            <span style={{ color: '#8c8c8c' }}>{supp.field_name}：</span>
                            <span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>
                              {supp.old_value}
                            </span>
                            <span style={{ color: '#8c8c8c', margin: '0 4px' }}>&#8594;</span>
                            <span style={{ color: '#52c41a' }}>{supp.new_value}</span>
                          </div>
                        </Show>
                        <div style={{ color: '#8c8c8c', fontSize: '11px', marginTop: '4px' }}>
                          原因：{supp.reason}
                        </div>
                      </div>
                    )}
                  </For>
                  <Show when={orderDetail()!.supplements.length === 0}>
                    <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '20px', fontSize: '12px' }}>
                      暂无补录记录
                    </div>
                  </Show>
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '13px',
                  color: '#8c8c8c',
                  marginBottom: '8px',
                  fontWeight: 500,
                }}>
                  操作记录
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <For each={orderDetail()!.logs.slice(0, 15)}>
                    {(log) => (
                      <div style={{
                        padding: '8px',
                        background: '#fafafa',
                        borderRadius: '4px',
                        fontSize: '11px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 500, color: '#262626' }}>
                            {log.operation}
                          </span>
                          <span style={{ color: '#bfbfbf' }}>
                            {new Date(log.create_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: '#8c8c8c' }}>
                          {log.operator_name}（{roleText[log.operator_role]}）
                        </div>
                        <Show when={log.remark}>
                          <div style={{ color: '#595959', marginTop: '2px' }}>
                            {log.remark}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>

          <Show when={selectedOrder() && orderDetail() && (
            canVerify(selectedOrder()!) ||
            canReview(selectedOrder()!) ||
            canArchive(selectedOrder()!)
          )}>
            <div style={{
              padding: '16px',
              borderTop: '1px solid #f0f0f0',
              background: '#fafafa',
            }}>
              <Show when={canVerify(selectedOrder()!) || canReview(selectedOrder()!)}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '13px',
                    color: '#595959',
                    marginBottom: '6px',
                    fontWeight: 500,
                  }}>
                    {canVerify(selectedOrder()!) ? '核验处理' : '复核处理'}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="opinionType"
                        checked={opinionForm().pass}
                        onChange={() => setOpinionForm({ ...opinionForm(), pass: true })}
                      />
                      <span style={{ color: '#52c41a', fontSize: '13px' }}>通过</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="opinionType"
                        checked={!opinionForm().pass}
                        onChange={() => setOpinionForm({ ...opinionForm(), pass: false })}
                      />
                      <span style={{ color: '#ff4d4f', fontSize: '13px' }}>退回</span>
                    </label>
                  </div>
                  <textarea
                    placeholder={opinionForm().pass ? '请输入意见（选填）' : '请输入退回意见（必填）'}
                    value={opinionForm().opinion}
                    onInput={(e) => setOpinionForm({ ...opinionForm(), opinion: (e.target as HTMLTextAreaElement).value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      fontSize: '13px',
                      minHeight: '60px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </Show>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Show when={canVerify(selectedOrder()!)}>
                  <button
                    onClick={() => handleVerify(selectedOrder()!)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: opinionForm().pass ? '#52c41a' : '#ff4d4f',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {opinionForm().pass ? '确认核验通过' : '确认退回'}
                  </button>
                </Show>
                <Show when={canReview(selectedOrder()!)}>
                  <button
                    onClick={() => handleReview(selectedOrder()!)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: opinionForm().pass ? '#13c2c2' : '#ff4d4f',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    {opinionForm().pass ? '确认复核通过' : '确认退回'}
                  </button>
                </Show>
                <Show when={canArchive(selectedOrder()!)}>
                  <button
                    onClick={() => handleArchive(selectedOrder()!)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: '#722ed1',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                  >
                    确认归档
                  </button>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>

      <Show when={showSupplement() && selectedOrder()}>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowSupplement(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
              移动补录 - {selectedOrder()!.order_no}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                补录类型 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {(['exception', 'correct', 'review'] as SupplementType[]).map((type) => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="supplementType"
                      checked={supplementForm().type === type}
                      onChange={() => setSupplementForm({ ...supplementForm(), type })}
                    />
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: (
                        type === 'exception' ? '#ff4d4f20' :
                        type === 'correct' ? '#faad1420' : '#722ed120'
                      ),
                      color: (
                        type === 'exception' ? '#ff4d4f' :
                        type === 'correct' ? '#faad14' : '#722ed1'
                      ),
                      fontSize: '13px',
                    }}>
                      {supplementTypeText[type]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                补录内容 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <textarea
                placeholder="请详细描述补录内容..."
                value={supplementForm().content}
                onInput={(e) => setSupplementForm({ ...supplementForm(), content: (e.target as HTMLTextAreaElement).value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontSize: '12px' }}>
                  字段名
                </label>
                <input
                  type="text"
                  placeholder="如：ActualStock"
                  value={supplementForm().field_name}
                  onInput={(e) => setSupplementForm({ ...supplementForm(), field_name: (e.target as HTMLInputElement).value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontSize: '12px' }}>
                  原值
                </label>
                <input
                  type="text"
                  placeholder="修改前的值"
                  value={supplementForm().old_value}
                  onInput={(e) => setSupplementForm({ ...supplementForm(), old_value: (e.target as HTMLInputElement).value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontSize: '12px' }}>
                  新值
                </label>
                <input
                  type="text"
                  placeholder="修改后的值"
                  value={supplementForm().new_value}
                  onInput={(e) => setSupplementForm({ ...supplementForm(), new_value: (e.target as HTMLInputElement).value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                补录原因 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <textarea
                placeholder="请说明补录原因..."
                value={supplementForm().reason}
                onInput={(e) => setSupplementForm({ ...supplementForm(), reason: (e.target as HTMLTextAreaElement).value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                  minHeight: '60px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowSupplement(false)}
                style={{
                  padding: '10px 24px',
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  color: '#595959',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleSupplement}
                style={{
                  padding: '10px 24px',
                  background: '#722ed1',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                确认补录
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={showEvidence() && selectedOrder()}>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowEvidence(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '480px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
              补充证据 - {selectedOrder()!.order_no}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                证据类型 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {(['register', 'verify', 'review', 'supplement'] as EvidenceType[]).map((type) => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="evidenceType"
                      checked={evidenceForm().type === type}
                      onChange={() => setEvidenceForm({ ...evidenceForm(), type })}
                    />
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#1890ff20',
                      color: '#1890ff',
                      fontSize: '13px',
                    }}>
                      {evidenceTypeText[type]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                文件名 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="如：盘点表_20260621.pdf"
                value={evidenceForm().file_name}
                onInput={(e) => setEvidenceForm({ ...evidenceForm(), file_name: (e.target as HTMLInputElement).value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontSize: '12px' }}>
                  文件类型
                </label>
                <select
                  value={evidenceForm().file_type}
                  onChange={(e) => setEvidenceForm({ ...evidenceForm(), file_type: (e.target as HTMLSelectElement).value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <option value="">选择类型</option>
                  <option value="pdf">PDF</option>
                  <option value="image/jpeg">图片(JPG)</option>
                  <option value="image/png">图片(PNG)</option>
                  <option value="xlsx">Excel</option>
                  <option value="docx">Word</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontSize: '12px' }}>
                  文件大小(字节)
                </label>
                <input
                  type="number"
                  placeholder="如：1024000"
                  value={evidenceForm().file_size || ''}
                  onInput={(e) => setEvidenceForm({ ...evidenceForm(), file_size: Number((e.target as HTMLInputElement).value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#595959', fontWeight: 500 }}>
                备注
              </label>
              <textarea
                placeholder="请说明证据内容..."
                value={evidenceForm().remark}
                onInput={(e) => setEvidenceForm({ ...evidenceForm(), remark: (e.target as HTMLTextAreaElement).value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  fontSize: '13px',
                  minHeight: '60px',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEvidence(false)}
                style={{
                  padding: '10px 24px',
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  color: '#595959',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleAddEvidence}
                style={{
                  padding: '10px 24px',
                  background: '#1890ff',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                确认补充
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default MainLayout;
