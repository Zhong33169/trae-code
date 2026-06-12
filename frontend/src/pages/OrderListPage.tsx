import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { api, extractError } from '../services/api';
import {
  OrderSummary,
  OrderStatus,
  OrderStatusLabels,
  OrderAction,
  Role,
  RoleLabels,
} from '../types';

const OrderListPage: React.FC = () => {
  const { currentUser } = useAppStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get('status') || '');
  const [filterHandlerRole, setFilterHandlerRole] = useState<string>(
    searchParams.get('handlerRole') || '',
  );
  const [filterMyTasks, setFilterMyTasks] = useState<boolean>(
    searchParams.get('myTasks') === 'true',
  );
  const [error, setError] = useState<any>(null);

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState<OrderAction | ''>('');
  const [batchComment, setBatchComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  useEffect(() => {
    if (currentUser) {
      loadOrders();
    }
  }, [currentUser, filterStatus, filterHandlerRole, filterMyTasks]);

  useEffect(() => {
    const statusFromUrl = searchParams.get('status') || '';
    const handlerRoleFromUrl = searchParams.get('handlerRole') || '';
    const myTasksFromUrl = searchParams.get('myTasks') === 'true';

    if (statusFromUrl !== filterStatus) setFilterStatus(statusFromUrl);
    if (handlerRoleFromUrl !== filterHandlerRole) setFilterHandlerRole(handlerRoleFromUrl);
    if (myTasksFromUrl !== filterMyTasks) setFilterMyTasks(myTasksFromUrl);
  }, [searchParams]);

  const loadOrders = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    setError(null);

    try {
      const params: { status?: string; handlerRole?: string; myTasks?: boolean } = {};
      if (filterStatus) params.status = filterStatus;
      if (filterHandlerRole) params.handlerRole = filterHandlerRole;
      if (filterMyTasks) params.myTasks = true;

      const response = await api
        .withOperator(currentUser.id)
        .orders.getList(params);
      setOrders(response.data.items);
      setTotal(response.data.total);

      const urlParams: any = {};
      if (filterStatus) urlParams.status = filterStatus;
      if (filterHandlerRole) urlParams.handlerRole = filterHandlerRole;
      if (filterMyTasks) urlParams.myTasks = 'true';
      setSearchParams(urlParams);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(orders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleViewDetail = (id: string) => {
    navigate(`/orders/${id}`);
  };

  const getAvailableBatchActions = () => {
    if (!currentUser || selectedIds.length === 0) return [];

    const selectedOrders = orders.filter((o) => selectedIds.includes(o.id));
    const statuses = [...new Set(selectedOrders.map((o) => o.status))];

    if (statuses.length !== 1) {
      return [];
    }

    const status = statuses[0];

    const actionMap: Record<Role, Record<OrderStatus, OrderAction[]>> = {
      [Role.REGISTRAR]: {
        [OrderStatus.PENDING_REGISTRATION]: [OrderAction.SUBMIT_REGISTRATION],
        [OrderStatus.PENDING_CORRECTION]: [OrderAction.SUBMIT_CORRECTION],
        [OrderStatus.DRAFT]: [OrderAction.SUBMIT_REGISTRATION],
        [OrderStatus.PENDING_REVIEW]: [],
        [OrderStatus.PENDING_FINAL_REVIEW]: [],
        [OrderStatus.ARCHIVED]: [],
        [OrderStatus.REJECTED]: [],
      },
      [Role.SUPERVISOR]: {
        [OrderStatus.PENDING_REVIEW]: [
          OrderAction.APPROVE_REVIEW,
          OrderAction.REQUEST_CORRECTION,
          OrderAction.REJECT_REVIEW,
        ],
        [OrderStatus.DRAFT]: [],
        [OrderStatus.PENDING_REGISTRATION]: [],
        [OrderStatus.PENDING_CORRECTION]: [],
        [OrderStatus.PENDING_FINAL_REVIEW]: [],
        [OrderStatus.ARCHIVED]: [],
        [OrderStatus.REJECTED]: [],
      },
      [Role.REVIEWER]: {
        [OrderStatus.PENDING_FINAL_REVIEW]: [
          OrderAction.APPROVE_FINAL_REVIEW,
          OrderAction.REJECT_FINAL_REVIEW,
        ],
        [OrderStatus.DRAFT]: [],
        [OrderStatus.PENDING_REGISTRATION]: [],
        [OrderStatus.PENDING_CORRECTION]: [],
        [OrderStatus.PENDING_REVIEW]: [],
        [OrderStatus.ARCHIVED]: [],
        [OrderStatus.REJECTED]: [],
      },
    };

    return actionMap[currentUser.role]?.[status] || [];
  };

  const handleBatchProcess = async () => {
    if (!currentUser || !batchAction || !batchComment.trim()) return;

    setIsProcessing(true);
    setBatchResult(null);

    try {
      const response = await api.withOperator(currentUser.id).orders.batchProcess({
        orderIds: selectedIds,
        action: batchAction,
        comment: batchComment,
      });

      setBatchResult(response.data);

      if (response.data.failed.length === 0) {
        setTimeout(() => {
          setShowBatchModal(false);
          setSelectedIds([]);
          setBatchAction('');
          setBatchComment('');
          setBatchResult(null);
          loadOrders();
        }, 1500);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefresh = () => {
    loadOrders();
    setSelectedIds([]);
  };

  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: OrderStatus.PENDING_REGISTRATION, label: '待登记' },
    { value: OrderStatus.PENDING_CORRECTION, label: '待补正' },
    { value: OrderStatus.PENDING_REVIEW, label: '待审核' },
    { value: OrderStatus.PENDING_FINAL_REVIEW, label: '待复核' },
    { value: OrderStatus.ARCHIVED, label: '已归档' },
    { value: OrderStatus.REJECTED, label: '已驳回' },
  ];

  const availableActions = getAvailableBatchActions();

  const actionLabels: Record<OrderAction, string> = {
    [OrderAction.SUBMIT_REGISTRATION]: '提交登记',
    [OrderAction.REQUEST_CORRECTION]: '要求补正',
    [OrderAction.SUBMIT_CORRECTION]: '提交补正',
    [OrderAction.APPROVE_REVIEW]: '审核通过',
    [OrderAction.REJECT_REVIEW]: '审核驳回',
    [OrderAction.APPROVE_FINAL_REVIEW]: '复核通过归档',
    [OrderAction.REJECT_FINAL_REVIEW]: '复核驳回',
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 场地订单列表</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ alignSelf: 'center', fontSize: '13px', color: '#888' }}>
              共 {total} 条记录
            </span>
            <button className="btn btn-default btn-sm" onClick={handleRefresh}>
              🔄 刷新
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">状态筛选：</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">岗位筛选：</label>
            <select
              value={filterHandlerRole}
              onChange={(e) => setFilterHandlerRole(e.target.value)}
            >
              <option value="">全部岗位</option>
              <option value={Role.REGISTRAR}>{RoleLabels[Role.REGISTRAR]}</option>
              <option value={Role.SUPERVISOR}>{RoleLabels[Role.SUPERVISOR]}</option>
              <option value={Role.REVIEWER}>{RoleLabels[Role.REVIEWER]}</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                className="checkbox"
                checked={filterMyTasks}
                onChange={(e) => setFilterMyTasks(e.target.checked)}
                style={{ marginRight: '6px', verticalAlign: 'middle' }}
              />
              只看我的待办
            </label>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="batch-actions">
            <span>已选择 {selectedIds.length} 条订单</span>
            {availableActions.length > 0 ? (
              <>
                {availableActions.map((action) => (
                  <button
                    key={action}
                    className={`btn btn-sm ${
                      action.includes('approve')
                        ? 'btn-success'
                        : action.includes('reject')
                        ? 'btn-error'
                        : action.includes('correction')
                        ? 'btn-warning'
                        : 'btn-primary'
                    }`}
                    onClick={() => {
                      setBatchAction(action);
                      setShowBatchModal(true);
                    }}
                  >
                    {actionLabels[action]}
                  </button>
                ))}
              </>
            ) : (
              <span style={{ color: '#f5222d' }}>
                所选订单状态不一致或您无权限批量处理
              </span>
            )}
            <button
              className="btn btn-default btn-sm"
              onClick={() => setSelectedIds([])}
            >
              取消选择
            </button>
          </div>
        )}

        {error && (
          <div className="error-box" style={{ marginBottom: '16px' }}>
            <div className="error-title">❌ 错误</div>
            <div className="error-message">{error.message}</div>
          </div>
        )}

        {isLoading ? (
          <div className="empty-state">
            <div className="loading"></div>
            <p style={{ marginTop: '12px' }}>加载订单列表中...</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.length === orders.length && orders.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>订单编号</th>
                  <th>场地</th>
                  <th>申请人</th>
                  <th>预约时间</th>
                  <th>状态</th>
                  <th>当前处理人</th>
                  <th>材料</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">暂无订单数据</div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      className={selectedIds.includes(order.id) ? 'selected' : ''}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.includes(order.id)}
                          onChange={(e) =>
                            handleSelectOne(order.id, e.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
                          {order.orderNo}
                        </code>
                      </td>
                      <td>
                        {order.venueName}
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {order.venueType}
                        </div>
                      </td>
                      <td>{order.applicantName}</td>
                      <td>
                        {order.bookingDate}
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {order.bookingTime}
                        </div>
                      </td>
                      <td>
                        <span className={`status-tag ${order.status}`}>
                          {order.statusLabel}
                        </span>
                        {order.isOverdue && (
                          <span className="overdue-badge">已逾期</span>
                        )}
                      </td>
                      <td>{order.currentHandlerName}</td>
                      <td>
                        {order.hasAllMaterials ? (
                          <span style={{ color: '#52c41a' }}>✓ 齐全</span>
                        ) : (
                          <span style={{ color: '#f5222d' }}>
                            ! 缺 {order.missingMaterialsCount} 项
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '12px', color: '#888' }}>
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="link-btn"
                          onClick={() => handleViewDetail(order.id)}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBatchModal && (
        <div className="modal-overlay" onClick={() => !isProcessing && setShowBatchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">批量处理</h3>
              <button
                className="modal-close"
                onClick={() => setShowBatchModal(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                即将对 <strong>{selectedIds.length}</strong> 条订单执行{' '}
                <strong>{batchAction && actionLabels[batchAction]}</strong> 操作
              </p>

              <div className="form-group">
                <label className="form-label required">处理意见</label>
                <textarea
                  value={batchComment}
                  onChange={(e) => setBatchComment(e.target.value)}
                  placeholder="请输入处理意见，必填"
                  disabled={isProcessing}
                />
              </div>

              {batchResult && (
                <div style={{ marginTop: '16px' }}>
                  {batchResult.success.length > 0 && (
                    <div className="success-box">
                      <div className="success-title">
                        ✅ 成功处理 {batchResult.success.length} 条
                      </div>
                    </div>
                  )}
                  {batchResult.failed.length > 0 && (
                    <div className="error-box" style={{ marginTop: '12px' }}>
                      <div className="error-title">
                        ❌ 处理失败 {batchResult.failed.length} 条
                      </div>
                      <div style={{ marginTop: '12px', maxHeight: '200px', overflow: 'auto' }}>
                        {batchResult.failed.map((f: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: '8px',
                              background: 'white',
                              borderRadius: '4px',
                              marginBottom: '8px',
                              fontSize: '12px',
                            }}
                          >
                            <div>
                              <strong>{f.orderNo}</strong>: {f.error}
                            </div>
                            {f.details && (
                              <div style={{ color: '#888', marginTop: '4px' }}>
                                {JSON.stringify(f.details)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-default"
                onClick={() => setShowBatchModal(false)}
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBatchProcess}
                disabled={isProcessing || !batchComment.trim()}
              >
                {isProcessing ? (
                  <>
                    <span className="loading"></span> 处理中...
                  </>
                ) : (
                  '确认处理'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderListPage;
