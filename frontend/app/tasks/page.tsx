'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  message,
  Spin,
  Typography,
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
} from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { isRegistrar, isAuditor, isReviewer, formatDuration, formatTimeoutDuration, canHandleTask } from '@/lib/auth';
import {
  Task,
  TaskListResponse,
  TaskQueryParams,
  TaskNode,
  TaskStatus,
  NODE_LABELS,
  STATUS_LABELS,
  ApiResponse,
} from '@/types';
import type { TableProps } from 'antd';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { confirm } = Modal;

interface CreateTaskForm {
  styleNo: string;
  styleName: string;
  remark?: string;
}

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    timeout: 0,
    completed: 0,
  });

  const [filters, setFilters] = useState<TaskQueryParams>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<CreateTaskForm>();
  const [createLoading, setCreateLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params: TaskQueryParams = {
        page,
        pageSize,
        ...filters,
      };
      const response = await api.get<ApiResponse<TaskListResponse>>('/tasks', { params });
      const data = response.data.data;
      setTasks(data.items);
      setTotal(data.total);
      setStats(data.stats);
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

  const handleCreateTask = async (values: CreateTaskForm) => {
    try {
      setCreateLoading(true);
      await api.post<ApiResponse<Task>>('/tasks', values);
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

  const handleViewDetail = (id: number) => {
    router.push(`/tasks/${id}`);
  };

  const handleQuickAction = (task: Task, action: string) => {
    confirm({
      title: '操作确认',
      icon: <ExclamationCircleFilled />,
      content: `确定要对任务【${task.taskNo}】执行"${action}"操作吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.post<ApiResponse>(`/tasks/${task.id}/action`, { action });
          message.success('操作成功');
          fetchTasks();
        } catch (error) {
          console.error('Action failed:', error);
        }
      },
    });
  };

  const getActionButtons = (task: Task) => {
    const buttons: React.ReactNode[] = [
      <Button key="view" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(task.id)}>
        详情
      </Button>,
    ];

    if (canHandleTask(task.currentNode, task.status)) {
      const role = isRegistrar() ? 'registrar' : isAuditor() ? 'auditor' : 'reviewer';
      
      if (role === 'registrar') {
        if (task.status === 'rejected') {
          buttons.push(
            <Button
              key="correct"
              type="primary"
              size="small"
              onClick={() => handleQuickAction(task, '补正提交')}
            >
              补正提交
            </Button>
          );
        } else if (task.currentNode === 'order_sampling' && task.status === 'pending') {
          buttons.push(
            <Button
              key="submit"
              type="primary"
              size="small"
              onClick={() => handleQuickAction(task, '提交审核')}
            >
              提交审核
            </Button>
          );
        }
      }

      if (role === 'auditor') {
        if (task.currentNode === 'sample_confirmation' && task.status === 'pending') {
          buttons.push(
            <Button
              key="approve"
              type="primary"
              size="small"
              onClick={() => handleViewDetail(task.id)}
            >
              样衣确认
            </Button>
          );
        } else if (task.currentNode === 'mass_production' && task.status === 'pending') {
          buttons.push(
            <Button
              key="approve"
              type="primary"
              size="small"
              onClick={() => handleViewDetail(task.id)}
            >
              大货排产
            </Button>
          );
        }
      }

      if (role === 'reviewer' && task.currentNode === 'archived' && task.status === 'pending') {
        buttons.push(
          <Button
            key="archive"
            type="primary"
            size="small"
            onClick={() => handleViewDetail(task.id)}
          >
            复核归档
          </Button>
        );
      }
    }

    return buttons;
  };

  const columns: TableProps<Task>['columns'] = [
    {
      title: '任务编号',
      dataIndex: 'taskNo',
      key: 'taskNo',
      width: 140,
      render: (text) => <span className="font-mono">{text}</span>,
    },
    {
      title: '款号',
      dataIndex: 'styleNo',
      key: 'styleNo',
      width: 120,
    },
    {
      title: '款名',
      dataIndex: 'styleName',
      key: 'styleName',
      ellipsis: true,
    },
    {
      title: '当前节点',
      dataIndex: 'currentNode',
      key: 'currentNode',
      width: 120,
      render: (node: TaskNode, record) => (
        <Space>
          {record.isTimeout && (
            <WarningOutlined className="text-red-500 animate-blink" />
          )}
          <Tag
            color={
              node === 'order_sampling'
                ? 'blue'
                : node === 'sample_confirmation'
                ? 'cyan'
                : node === 'mass_production'
                ? 'purple'
                : 'green'
            }
          >
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
        <Tag
          color={
            status === 'approved' || status === 'completed'
              ? 'green'
              : status === 'rejected'
              ? 'red'
              : status === 'timeout'
              ? 'red'
              : status === 'processing'
              ? 'blue'
              : 'default'
          }
        >
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '责任人',
      dataIndex: 'currentAssigneeName',
      key: 'currentAssigneeName',
      width: 100,
    },
    {
      title: '剩余时长',
      key: 'remainingTime',
      width: 140,
      render: (_, record) => {
        if (record.isTimeout && record.timeoutDuration !== undefined) {
          return (
            <span className="text-red-500 font-medium">
              {formatTimeoutDuration(record.timeoutDuration)}
            </span>
          );
        }
        if (record.remainingTime !== undefined && record.remainingTime > 0) {
          return (
            <span className="text-green-600">
              {formatDuration(record.remainingTime)}
            </span>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">{getActionButtons(record)}</Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">
          打样任务列表
        </Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建任务
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="任务总数"
              value={stats.total}
              prefix={<FileTextOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="待处理"
              value={stats.pending}
              prefix={<ClockCircleOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已超时"
              value={stats.timeout}
              prefix={<WarningOutlined className="text-red-500" />}
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed}
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
              value={filters.node}
              onChange={(value) => setFilters({ ...filters, node: value })}
            >
              {Object.entries(NODE_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
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
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="超时">
            <Select
              placeholder="全部"
              allowClear
              style={{ width: 120 }}
              value={filters.isTimeout}
              onChange={(value) => setFilters({ ...filters, isTimeout: value })}
            >
              <Option value={true}>已超时</Option>
              <Option value={false}>未超时</Option>
            </Select>
          </Form.Item>
          <Form.Item label="时间段">
            <RangePicker
              value={
                filters.startDate && filters.endDate
                  ? [dayjs(filters.startDate), dayjs(filters.endDate)]
                  : undefined
              }
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setFilters({
                    ...filters,
                    startDate: dates[0].format('YYYY-MM-DD'),
                    endDate: dates[1].format('YYYY-MM-DD'),
                  });
                } else {
                  setFilters({
                    ...filters,
                    startDate: undefined,
                    endDate: undefined,
                  });
                }
              }}
            />
          </Form.Item>
          <Form.Item label="关键词">
            <Input
              placeholder="任务编号/款号/款名"
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

      <Card>
        <Spin spinning={loading}>
          <Table<Task>
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            rowClassName={(record) => (record.isTimeout ? 'row-timeout' : '')}
            scroll={{ x: 1000 }}
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
      >
        <Form<CreateTaskForm>
          form={createForm}
          layout="vertical"
          onFinish={handleCreateTask}
        >
          <Form.Item
            name="styleNo"
            label="款号"
            rules={[{ required: true, message: '请输入款号' }]}
          >
            <Input placeholder="请输入款号" />
          </Form.Item>
          <Form.Item
            name="styleName"
            label="款名"
            rules={[{ required: true, message: '请输入款名' }]}
          >
            <Input placeholder="请输入款名" />
          </Form.Item>
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
    </div>
  );
}
