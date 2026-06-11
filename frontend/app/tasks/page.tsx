'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Select,
  DatePicker,
  Input,
  Modal,
  Form,
  InputNumber,
  message,
  Spin,
  Typography,
  Divider,
  List,
  Alert,
} from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  ExclamationCircleFilled,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  SafetyOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { isRegistrar, isAuditor, isReviewer, getUserRole } from '@/lib/auth';
import {
  TaskListItem,
  TaskListResponse,
  TaskListQuery,
  TaskNode,
  TaskStatus,
  CreateTaskRequest,
  BatchAdvanceRequest,
  BatchAdvanceResult,
  BatchItemResult,
  NODE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  ApiResponse,
  getResponsibleName,
  getStatusColor,
  getNodeColor,
} from '@/types';
import { formatTimeoutDisplay } from '@/lib/auth';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface BatchActionOption {
  action: 'submit' | 'approve' | 'reject';
  label: string;
  node: TaskNode;
  role: string;
}

function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [timeoutCount, setTimeoutCount] = useState(0);
  const [computedPending, setComputedPending] = useState(0);
  const [computedCompleted, setComputedCompleted] = useState(0);

  const [filters, setFilters] = useState<TaskListQuery>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<CreateTaskRequest>();
  const [createLoading, setCreateLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<TaskListItem[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = Form.useForm<{
    action: 'submit' | 'approve' | 'reject';
    remark?: string;
    abnormal_reason?: string;
  }>();
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchAdvanceResult | null>(null);
  const [batchSelectedAction, setBatchSelectedAction] = useState<'submit' | 'approve' | 'reject' | null>(null);

  const role = getUserRole();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number | undefined> = {
        page,
        page_size: pageSize,
        status: filters.status,
        current_node: filters.current_node,
        keyword: filters.keyword || undefined,
        is_timeout: filters.is_timeout || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };
      const response = await api.get<ApiResponse<TaskListResponse>>('/tasks', { params });
      const data = response.data.data;
      if (data) {
        setTasks(data.list);
        setTotal(data.total);
        setTimeoutCount(data.timeout_count);
        setComputedPending(data.list.filter((t) => t.status === 'pending' || t.status === 'processing').length);
        setComputedCompleted(data.list.filter((t) => t.status === 'completed' || t.status === 'archived').length);
        setSelectedRowKeys([]);
        setSelectedRows([]);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    setCanCreate(isRegistrar());
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create' && canCreate) {
      setCreateModalVisible(true);
    }
  }, [searchParams, canCreate]);

  const handleSearch = () => {
    setPage(1);
    fetchTasks();
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
  };

  const handleCreateTask = async (values: CreateTaskRequest) => {
    try {
      setCreateLoading(true);
      await api.post<ApiResponse>('/tasks', values);
      message.success('任务创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewDetail = (id: string) => {
    router.push(`/tasks/${id}`);
  };

  const handleQuickAction = (task: TaskListItem, action: string, actionLabel: string) => {
    Modal.confirm({
      title: '操作确认',
      icon: <ExclamationCircleFilled />,
      content: `确定要对任务【${task.task_no}】执行"${actionLabel}"操作吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.post<ApiResponse>(`/tasks/${task.id}/advance`, { action });
          message.success('操作成功');
          fetchTasks();
        } catch (error) {
          console.error('Action failed:', error);
        }
      },
    });
  };

  const availableBatchActions = useMemo<BatchActionOption[]>(() => {
    if (selectedRows.length === 0) return [];

    const actions: BatchActionOption[] = [];
    const nodes = new Set<TaskNode>(selectedRows.map((r) => r.current_node));
    const role = getUserRole();

    if (role === 'registrar') {
      if (nodes.has('order_sampling')) {
        actions.push({
          action: 'submit',
          label: '提交审核',
          node: 'order_sampling',
          role: 'registrar',
        });
      }
      const hasRejected = selectedRows.some((r) => r.status === 'rejected');
      if (hasRejected) {
        actions.push({
          action: 'submit',
          label: '补正提交',
          node: 'order_sampling',
          role: 'registrar',
        });
      }
    }

    if (role === 'auditor') {
      if (nodes.has('order_sampling')) {
        actions.push({
          action: 'approve',
          label: '审核通过',
          node: 'order_sampling',
          role: 'auditor',
        });
        actions.push({
          action: 'reject',
          label: '打回补正',
          node: 'order_sampling',
          role: 'auditor',
        });
      }
      if (nodes.has('sample_confirmation')) {
        actions.push({
          action: 'approve',
          label: '确认通过',
          node: 'sample_confirmation',
          role: 'auditor',
        });
        actions.push({
          action: 'reject',
          label: '打回补正',
          node: 'sample_confirmation',
          role: 'auditor',
        });
      }
      if (nodes.has('production_scheduling')) {
        actions.push({
          action: 'submit',
          label: '提交复核',
          node: 'production_scheduling',
          role: 'auditor',
        });
      }
    }

    if (role === 'reviewer' && nodes.has('production_scheduling')) {
      actions.push({
        action: 'approve',
        label: '复核归档',
        node: 'production_scheduling',
        role: 'reviewer',
      });
      actions.push({
        action: 'reject',
        label: '打回',
        node: 'production_scheduling',
        role: 'reviewer',
      });
    }

    const uniqueActions: BatchActionOption[] = [];
    const seen = new Set<string>();
    for (const a of actions) {
      const key = `${a.action}-${a.label}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueActions.push(a);
      }
    }
    return uniqueActions;
  }, [selectedRows]);

  const handleBatchActionClick = (action: 'submit' | 'approve' | 'reject', label: string) => {
    setBatchSelectedAction(action);
    batchForm.setFieldsValue({ action, remark: '', abnormal_reason: '' });
    setBatchResult(null);
    setBatchModalVisible(true);
  };

  const handleBatchAdvance = async (values: {
    action: 'submit' | 'approve' | 'reject';
    remark?: string;
    abnormal_reason?: string;
  }) => {
    try {
      setBatchLoading(true);
      const request: BatchAdvanceRequest = {
        task_ids: selectedRowKeys.map((k) => k.toString()),
        action: values.action,
        remark: values.remark,
        abnormal_reason: values.abnormal_reason,
      };
      const response = await api.post<ApiResponse<BatchAdvanceResult>>('/tasks/batch-advance', request);
      const result = response.data.data;
      setBatchResult(result || null);

      if (result) {
        if (result.fail_count === 0) {
          message.success(`批量操作成功，共处理 ${result.success_count} 个任务`);
          setBatchModalVisible(false);
          fetchTasks();
        } else if (result.success_count === 0) {
          message.error(`批量操作全部失败，共 ${result.fail_count} 个`);
        } else {
          message.warning(`批量操作部分成功：成功 ${result.success_count} 个，失败 ${result.fail_count} 个`);
        }
      }
    } catch (error) {
      console.error('Batch advance failed:', error);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchModalClose = () => {
    if (batchResult && batchResult.success_count > 0) {
      fetchTasks();
    }
    setBatchModalVisible(false);
    setBatchResult(null);
    setBatchSelectedAction(null);
    batchForm.resetFields();
  };

  const getActionButtons = (task: TaskListItem) => {
    const buttons: React.ReactNode[] = [
      <Button key="view" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(task.id)}>
        详情
      </Button>,
    ];

    if (role === 'registrar') {
      if (task.current_node === 'order_sampling' && (task.status === 'pending' || task.status === 'processing')) {
        buttons.push(
          <Button
            key="submit"
            type="primary"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleQuickAction(task, 'submit', '提交审核')}
          >
            提交审核
          </Button>
        );
      }
      if (task.status === 'rejected') {
        buttons.push(
          <Button
            key="correct"
            type="primary"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleQuickAction(task, 'submit', '补正提交')}
          >
            补正提交
          </Button>
        );
      }
    }

    if (role === 'auditor') {
      if (task.current_node === 'order_sampling') {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleQuickAction(task, 'approve', '审核通过')}
          >
            审核通过
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleQuickAction(task, 'reject', '打回补正')}
          >
            打回补正
          </Button>
        );
      }
      if (task.current_node === 'sample_confirmation') {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleQuickAction(task, 'approve', '确认通过')}
          >
            确认通过
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleQuickAction(task, 'reject', '打回补正')}
          >
            打回补正
          </Button>
        );
      }
      if (task.current_node === 'production_scheduling') {
        buttons.push(
          <Button
            key="submit"
            type="primary"
            size="small"
            icon={<SendOutlined />}
            onClick={() => handleQuickAction(task, 'submit', '提交复核')}
          >
            提交复核
          </Button>
        );
      }
    }

    if (role === 'reviewer' && task.current_node === 'production_scheduling') {
      buttons.push(
        <Button
          key="approve"
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          onClick={() => handleQuickAction(task, 'approve', '复核归档')}
        >
          复核归档
        </Button>
      );
      buttons.push(
        <Button
          key="reject"
          danger
          size="small"
          icon={<CloseOutlined />}
          onClick={() => handleQuickAction(task, 'reject', '打回')}
        >
          打回
        </Button>
      );
    }

    return buttons;
  };

  const columns: TableProps<TaskListItem>['columns'] = [
    {
      title: '任务编号',
      dataIndex: 'task_no',
      key: 'task_no',
      width: 140,
      render: (text) => <span className="font-mono">{text}</span>,
    },
    {
      title: '款号',
      dataIndex: 'style_no',
      key: 'style_no',
      width: 120,
    },
    {
      title: '款名',
      dataIndex: 'style_name',
      key: 'style_name',
      ellipsis: true,
    },
    {
      title: '当前节点',
      dataIndex: 'current_node',
      key: 'current_node',
      width: 120,
      render: (node: TaskNode, record) => (
        <Space>
          {record.is_timeout && (
            <WarningOutlined className="text-red-500 animate-blink" />
          )}
          <Tag color={getNodeColor(node)}>
            {NODE_LABELS[node]}
          </Tag>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TaskStatus) => (
        <Tag color={getStatusColor(status)}>
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '责任人',
      key: 'responsible',
      width: 100,
      render: (_: unknown, record: TaskListItem) => getResponsibleName(record),
    },
    {
      title: '剩余时长',
      key: 'timeout_hours',
      width: 140,
      render: (_: unknown, record: TaskListItem) => {
        if (record.is_timeout && record.timeout_hours > 0) {
          return (
            <span className="text-red-500 font-medium">
              {formatTimeoutDisplay(record.timeout_hours)}
            </span>
          );
        }
        if (record.current_node !== 'archived') {
          return <span className="text-green-600">正常</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: TaskListItem) => (
        <Space size="small" wrap>{getActionButtons(record)}</Space>
      ),
    },
  ];

  const rowSelection: TableProps<TaskListItem>['rowSelection'] = {
    selectedRowKeys,
    onChange: (keys, rows) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: (record) => ({
      disabled: record.current_node === 'archived',
    }),
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">
          打样任务列表
        </Title>
        <Space>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              新建任务
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="任务总数"
              value={total}
              prefix={<FileTextOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="待处理"
              value={computedPending}
              prefix={<ClockCircleOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已超时"
              value={timeoutCount}
              prefix={<WarningOutlined className="text-red-500" />}
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={computedCompleted}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="mb-6">
        <Form layout="inline" onFinish={handleSearch}>
          <Form.Item label="节点">
            <Select
              placeholder="全部节点"
              allowClear
              style={{ width: 150 }}
              value={filters.current_node}
              onChange={(value) => setFilters({ ...filters, current_node: value })}
            >
              {Object.entries(NODE_LABELS).map(([key, label]) => (
                <Select.Option key={key} value={key}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="状态">
            <Select
              placeholder="全部状态"
              allowClear
              style={{ width: 150 }}
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Select.Option key={key} value={key}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="超时">
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 120 }}
              value={filters.is_timeout}
              onChange={(value) => setFilters({ ...filters, is_timeout: value })}
            >
              <Select.Option value="1">已超时</Select.Option>
              <Select.Option value="0">未超时</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="时间段">
            <RangePicker
              value={
                filters.start_date && filters.end_date
                  ? [dayjs(filters.start_date), dayjs(filters.end_date)]
                  : undefined
              }
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilters({
                    ...filters,
                    start_date: dates[0].format('YYYY-MM-DD'),
                    end_date: dates[1].format('YYYY-MM-DD'),
                  });
                } else {
                  setFilters({
                    ...filters,
                    start_date: undefined,
                    end_date: undefined,
                  });
                }
              }}
            />
          </Form.Item>
          <Form.Item label="关键词">
            <Input
              placeholder="任务编号/款号/款名/客户"
              allowClear
              style={{ width: 200 }}
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {selectedRowKeys.length > 0 && (
        <Card className="mb-4">
          <Space wrap>
            <span className="text-gray-600">
              <SelectOutlined className="mr-1" />
              已选择 <strong className="text-blue-600">{selectedRowKeys.length}</strong> 项
            </span>
            <Divider type="vertical" />
            {availableBatchActions.length > 0 ? (
              <Space wrap>
                <span className="text-gray-500">批量操作：</span>
                {availableBatchActions.map((opt) => (
                  <Button
                    key={`${opt.action}-${opt.node}`}
                    type={opt.action === 'reject' ? 'default' : 'primary'}
                    danger={opt.action === 'reject'}
                    icon={
                      opt.action === 'approve' ? <CheckOutlined /> :
                      opt.action === 'reject' ? <CloseOutlined /> : <SendOutlined />
                    }
                    onClick={() => handleBatchActionClick(opt.action, opt.label)}
                  >
                    {opt.label}
                    <Tag color={getNodeColor(opt.node)} className="ml-1">{NODE_LABELS[opt.node]}</Tag>
                  </Button>
                ))}
              </Space>
            ) : (
              <span className="text-gray-400">
                当前角色无可执行的批量操作
              </span>
            )}
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              取消选择
            </Button>
          </Space>
        </Card>
      )}

      <Card>
        <Spin spinning={loading}>
          <Table<TaskListItem>
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            rowSelection={rowSelection}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条记录`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            rowClassName={(record) => (record.is_timeout ? 'row-timeout' : '')}
            scroll={{ x: 1100 }}
          />
        </Spin>
      </Card>

      <Modal
        title="新建打样任务"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form<CreateTaskRequest>
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="style_no"
                label="款号"
                rules={[{ required: true, message: '请输入款号' }]}
              >
                <Input placeholder="请输入款号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="style_name"
                label="款名"
                rules={[{ required: true, message: '请输入款名' }]}
              >
                <Input placeholder="请输入款名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_name" label="客户名">
                <Input placeholder="请输入客户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fabric_type" label="面料">
                <Input placeholder="请输入面料类型" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="color" label="颜色">
                <Input placeholder="请输入颜色" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="size_spec" label="尺码">
                <Input placeholder="请输入尺码规格" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="数量">
                <InputNumber placeholder="请输入数量" min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级">
                <Select placeholder="请选择优先级" allowClear>
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <Select.Option key={key} value={key}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
          </Form.Item>
          <Form.Item className="mb-0 text-right">
            <Space>
              <Button
                onClick={() => {
                  setCreateModalVisible(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <SafetyOutlined />
            批量推进
          </Space>
        }
        open={batchModalVisible}
        onCancel={handleBatchModalClose}
        footer={null}
        destroyOnClose
        width={650}
        maskClosable={false}
      >
        {!batchResult ? (
          <Form
            form={batchForm}
            layout="vertical"
            onFinish={handleBatchAdvance}
          >
            <Alert
              type="info"
              showIcon
              message={`已选择 ${selectedRowKeys.length} 个任务进行批量操作`}
              className="mb-4"
            />
            <Form.Item
              name="action"
              label="操作类型"
              rules={[{ required: true, message: '请选择操作类型' }]}
            >
              <Select disabled={!!batchSelectedAction}>
                {availableBatchActions.map((opt) => (
                  <Select.Option key={`${opt.action}-${opt.node}`} value={opt.action}>
                    <Space>
                      <span>{opt.label}</span>
                      <Tag color={getNodeColor(opt.node)}>{NODE_LABELS[opt.node]}</Tag>
                      <Tag color="blue">{ROLE_LABELS[opt.role as keyof typeof ROLE_LABELS]}</Tag>
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="remark" label="备注说明">
              <TextArea rows={2} placeholder="请输入备注说明（可选）" />
            </Form.Item>
            <Form.Item name="abnormal_reason" label="异常原因">
              <TextArea rows={3} placeholder="如有异常，请填写异常原因（可选）" />
            </Form.Item>
            <Form.Item className="mb-0 text-right">
              <Space>
                <Button onClick={handleBatchModalClose}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" loading={batchLoading}>
                  确认批量操作
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Alert
              type={batchResult.fail_count === 0 ? 'success' : batchResult.success_count === 0 ? 'error' : 'warning'}
              showIcon
              message={`批量操作完成：成功 ${batchResult.success_count} 个，失败 ${batchResult.fail_count} 个`}
              className="mb-4"
            />
            <Divider orientation="left">处理明细</Divider>
            <List
              size="small"
              dataSource={batchResult.results}
              renderItem={(item: BatchItemResult) => (
                <List.Item>
                  <Space className="w-full" wrap>
                    {item.success ? (
                      <CheckCircleOutlined className="text-green-500" />
                    ) : (
                      <CloseOutlined className="text-red-500" />
                    )}
                    <span className="font-mono font-medium">{item.task_no}</span>
                    {item.success && item.action && (
                      <Tag color="green">
                        {item.from_node && NODE_LABELS[item.from_node as TaskNode]}
                        <span className="mx-1">→</span>
                        {item.to_node && NODE_LABELS[item.to_node as TaskNode]}
                      </Tag>
                    )}
                    {!item.success && item.error && (
                      <span className="text-red-500 text-sm">{item.error}</span>
                    )}
                  </Space>
                </List.Item>
              )}
            />
            <div className="mt-4 text-right">
              <Button type="primary" onClick={handleBatchModalClose}>
                {batchResult.fail_count === 0 ? '完成' : '关闭'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function TasksPageWithSuspense() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Spin size="large" /></div>}>
      <TasksPage />
    </Suspense>
  );
}

export default TasksPageWithSuspense;
