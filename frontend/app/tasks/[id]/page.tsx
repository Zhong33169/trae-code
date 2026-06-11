'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Table,
  Modal,
  Form,
  Input,
  message,
  Spin,
  Typography,
  Divider,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import {
  isRegistrar,
  isAuditor,
  isReviewer,
  canHandleTask,
  formatTimeoutDuration,
} from '@/lib/auth';
import TaskFlowSteps from '@/components/TaskFlowSteps';
import OperationTimeline from '@/components/OperationTimeline';
import {
  Task,
  TaskNodeRecord,
  TaskActionParams,
  NODE_LABELS,
  STATUS_LABELS,
  ApiResponse,
  NODE_ORDER,
} from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ActionModalProps {
  open: boolean;
  title: string;
  action: string;
  onCancel: () => void;
  onConfirm: (params: { remark?: string; exceptionReason?: string }) => void;
  loading: boolean;
  showExceptionReason?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({
  open,
  title,
  onCancel,
  onConfirm,
  loading,
  showExceptionReason = false,
}) => {
  const [form] = Form.useForm();

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          onConfirm(values);
          form.resetFields();
        }}
      >
        <Form.Item name="remark" label="备注">
          <TextArea rows={3} placeholder="请输入备注（可选）" />
        </Form.Item>
        {showExceptionReason && (
          <Form.Item name="exceptionReason" label="异常原因">
            <TextArea rows={3} placeholder="请输入异常原因（可选）" />
          </Form.Item>
        )}
        <Form.Item className="mb-0 text-right">
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    title: string;
    action: string;
    showExceptionReason: boolean;
  }>({
    open: false,
    title: '',
    action: '',
    showExceptionReason: false,
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (taskId) {
      fetchTaskDetail();
    }
  }, [taskId]);

  const fetchTaskDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Task>>(`/tasks/${taskId}`);
      setTask(response.data.data);
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/tasks');
  };

  const handleAction = async (action: string, title: string, showExceptionReason = false) => {
    setActionModal({
      open: true,
      title,
      action,
      showExceptionReason,
    });
  };

  const handleActionConfirm = async (values: {
    remark?: string;
    exceptionReason?: string;
  }) => {
    if (!task) return;

    try {
      setActionLoading(true);
      const actionParams: TaskActionParams = {
        taskId: task.id,
        action: actionModal.action as TaskActionParams['action'],
        remark: values.remark,
        exceptionReason: values.exceptionReason,
      };

      await api.post<ApiResponse>(`/tasks/${task.id}/action`, actionParams);
      message.success('操作成功');
      setActionModal({ ...actionModal, open: false });
      fetchTaskDetail();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getActionButtons = () => {
    if (!task) return null;
    if (!canHandleTask(task.currentNode, task.status)) return null;

    const buttons: React.ReactNode[] = [];

    if (isRegistrar()) {
      if (task.status === 'rejected') {
        buttons.push(
          <Button
            key="correct"
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleAction('submit', '补正提交', true)}
          >
            补正提交
          </Button>
        );
      } else if (task.currentNode === 'order_sampling' && task.status === 'pending') {
        buttons.push(
          <Button
            key="submit"
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleAction('submit', '提交审核', true)}
          >
            提交审核
          </Button>
        );
      }
    }

    if (isAuditor()) {
      if (task.currentNode === 'sample_confirmation' && task.status === 'pending') {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleAction('approve', '样衣确认通过', true)}
          >
            确认通过
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleAction('reject', '样衣确认打回', true)}
          >
            打回补正
          </Button>
        );
      } else if (task.currentNode === 'mass_production' && task.status === 'pending') {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleAction('approve', '大货排产核准', true)}
          >
            排产核准
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleAction('reject', '大货排产打回', true)}
          >
            打回补正
          </Button>
        );
      }
    }

    if (isReviewer() && task.currentNode === 'archived' && task.status === 'pending') {
      buttons.push(
        <Button
          key="archive"
          type="primary"
          icon={<CheckOutlined />}
          onClick={() => handleAction('archive', '复核归档', true)}
        >
          复核归档
        </Button>
      );
    }

    return buttons;
  };

  const nodeRecordColumns = [
    {
      title: '节点',
      dataIndex: 'node',
      key: 'node',
      width: 120,
      render: (node: string) => NODE_LABELS[node as keyof typeof NODE_LABELS] || node,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: TaskNodeRecord) => (
        <Space>
          {record.isTimeout && <WarningOutlined className="text-red-500 animate-blink" />}
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
            {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
          </Tag>
        </Space>
      ),
    },
    {
      title: '责任人',
      dataIndex: 'assigneeName',
      key: 'assigneeName',
      width: 100,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 160,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 160,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '超时情况',
      key: 'timeout',
      width: 140,
      render: (_value: string, record: TaskNodeRecord) => {
        if (record.isTimeout && record.timeoutDuration !== undefined) {
          return (
            <span className="text-red-500 font-medium">
              {formatTimeoutDuration(record.timeoutDuration)}
            </span>
          );
        }
        return <span className="text-gray-400">正常</span>;
      },
    },
    {
      title: '异常原因',
      dataIndex: 'exceptionReason',
      key: 'exceptionReason',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <Text type="secondary">任务不存在或已被删除</Text>
        <div className="mt-4">
          <Button onClick={handleBack}>返回列表</Button>
        </div>
      </div>
    );
  }

  const sortedNodeRecords = [...task.nodeRecords].sort(
    (a, b) => NODE_ORDER.indexOf(a.node) - NODE_ORDER.indexOf(b.node)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
          <Title level={3} className="!mb-0">
            任务详情
          </Title>
          {task.isTimeout && (
            <Tag color="red" icon={<WarningOutlined className="animate-blink" />}>
              已超时
            </Tag>
          )}
        </Space>
        <Space>{getActionButtons()}</Space>
      </div>

      <Card className="mb-6">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="任务编号">
            <span className="font-mono">{task.taskNo}</span>
          </Descriptions.Item>
          <Descriptions.Item label="款号">{task.styleNo}</Descriptions.Item>
          <Descriptions.Item label="款名">{task.styleName}</Descriptions.Item>
          <Descriptions.Item label="当前节点">
            <Tag
              color={
                task.currentNode === 'order_sampling'
                  ? 'blue'
                  : task.currentNode === 'sample_confirmation'
                  ? 'cyan'
                  : task.currentNode === 'mass_production'
                  ? 'purple'
                  : 'green'
              }
            >
              {NODE_LABELS[task.currentNode]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={
                task.status === 'approved' || task.status === 'completed'
                  ? 'green'
                  : task.status === 'rejected'
                  ? 'red'
                  : task.status === 'timeout'
                  ? 'red'
                  : task.status === 'processing'
                  ? 'blue'
                  : 'default'
              }
            >
              {STATUS_LABELS[task.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="当前责任人">{task.currentAssigneeName}</Descriptions.Item>
          <Descriptions.Item label="创建人">{task.creatorName}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(task.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="剩余时长" span={2}>
            {task.isTimeout && task.timeoutDuration !== undefined ? (
              <span className="text-red-500 font-medium">
                {formatTimeoutDuration(task.timeoutDuration)}
              </span>
            ) : task.remainingTime !== undefined && task.remainingTime > 0 ? (
              <span className="text-green-600">
                {Math.floor(task.remainingTime / 3600)}小时
                {Math.floor((task.remainingTime % 3600) / 60)}分钟
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="节点进度" className="mb-6">
        <TaskFlowSteps task={task} />
      </Card>

      <Card title="节点处理记录" className="mb-6">
        <Table<TaskNodeRecord>
          rowKey="id"
          columns={nodeRecordColumns}
          dataSource={sortedNodeRecords}
          pagination={false}
          rowClassName={(record) => (record.isTimeout ? 'row-timeout' : '')}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={12}>
          <Card title="操作区" extra={<FileTextOutlined />}>
            <div className="text-center py-8">
              {getActionButtons() && getActionButtons()!.length > 0 ? (
                <Space direction="vertical" size="middle">
                  <Text type="secondary">请选择要执行的操作</Text>
                  <Space>{getActionButtons()}</Space>
                </Space>
              ) : (
                <Text type="secondary">当前节点无需操作或无操作权限</Text>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="异常说明">
            <div className="text-sm text-gray-600 leading-relaxed">
              <p>• 每个节点处理时限为24小时</p>
              <p>• 超时节点将以红色高亮显示</p>
              <p>• 打回的任务需由登记员补正后重新提交</p>
              <p>• 推进任务时可填写异常原因（可选）</p>
            </div>
          </Card>
        </Col>
      </Row>

      <Divider orientation="left">操作日志</Divider>
      <Card>
        <OperationTimeline logs={task.operationLogs || []} />
      </Card>

      <ActionModal
        open={actionModal.open}
        title={actionModal.title}
        action={actionModal.action}
        showExceptionReason={actionModal.showExceptionReason}
        loading={actionLoading}
        onCancel={() => setActionModal({ ...actionModal, open: false })}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}
