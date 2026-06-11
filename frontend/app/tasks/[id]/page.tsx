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
  getUserRole,
} from '@/lib/auth';
import TaskFlowSteps from '@/components/TaskFlowSteps';
import OperationTimeline from '@/components/OperationTimeline';
import {
  TaskDetail,
  NodeRecordDetail,
  NODE_LABELS,
  STATUS_LABELS,
  ApiResponse,
  NODE_ORDER,
  getResponsibleName,
  getStatusColor,
  getNodeColor,
} from '@/types';
import { formatTimeoutDisplay } from '@/lib/auth';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ActionModalProps {
  open: boolean;
  title: string;
  action: string;
  onCancel: () => void;
  onConfirm: (params: { remark?: string; abnormal_reason?: string }) => void;
  loading: boolean;
  showAbnormalReason?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({
  open,
  title,
  onCancel,
  onConfirm,
  loading,
  showAbnormalReason = false,
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
        {showAbnormalReason && (
          <Form.Item name="abnormal_reason" label="异常原因">
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
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    title: string;
    action: string;
    showAbnormalReason: boolean;
  }>({
    open: false,
    title: '',
    action: '',
    showAbnormalReason: false,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const role = getUserRole();

  useEffect(() => {
    if (taskId) {
      fetchTaskDetail();
    }
  }, [taskId]);

  const fetchTaskDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<TaskDetail>>(`/tasks/${taskId}`);
      if (response.data.data) {
        setTask(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/tasks');
  };

  const handleAction = (action: string, title: string, showAbnormalReason = false) => {
    setActionModal({
      open: true,
      title,
      action,
      showAbnormalReason,
    });
  };

  const handleActionConfirm = async (values: {
    remark?: string;
    abnormal_reason?: string;
  }) => {
    if (!task) return;

    try {
      setActionLoading(true);
      await api.post<ApiResponse>(`/tasks/${task.id}/advance`, {
        action: actionModal.action,
        remark: values.remark,
        abnormal_reason: values.abnormal_reason,
      });
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

    const buttons: React.ReactNode[] = [];

    if (role === 'registrar') {
      if (task.current_node === 'order_sampling' && (task.status === 'pending' || task.status === 'processing')) {
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
      }
    }

    if (role === 'auditor') {
      if (task.current_node === 'order_sampling') {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleAction('approve', '审核通过', true)}
          >
            审核通过
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleAction('reject', '打回补正', true)}
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
            icon={<CheckOutlined />}
            onClick={() => handleAction('approve', '确认通过', true)}
          >
            确认通过
          </Button>
        );
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleAction('reject', '打回补正', true)}
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
            icon={<SendOutlined />}
            onClick={() => handleAction('submit', '提交复核', true)}
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
          icon={<CheckOutlined />}
          onClick={() => handleAction('approve', '复核归档', true)}
        >
          复核归档
        </Button>
      );
      buttons.push(
        <Button
          key="reject"
          danger
          icon={<CloseOutlined />}
          onClick={() => handleAction('reject', '打回', true)}
        >
          打回
        </Button>
      );
    }

    return buttons;
  };

  const nodeRecordColumns = [
    {
      title: '节点',
      dataIndex: 'node_type',
      key: 'node_type',
      width: 120,
      render: (nodeType: string) => NODE_LABELS[nodeType as keyof typeof NODE_LABELS] || nodeType,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const actionMap: Record<string, string> = {
          create: '创建',
          submit: '提交',
          approve: '通过',
          reject: '打回',
          process: '处理中',
        };
        return actionMap[action] || action;
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
      render: (text: string) => text || '-',
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 160,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 160,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '超时情况',
      key: 'timeout',
      width: 140,
      render: (_: string, record: NodeRecordDetail) => {
        if (record.is_timeout === 1 && record.timeout_hours > 0) {
          return (
            <span className="text-red-500 font-medium">
              {formatTimeoutDisplay(record.timeout_hours)}
            </span>
          );
        }
        return <span className="text-gray-400">正常</span>;
      },
    },
    {
      title: '异常原因',
      dataIndex: 'abnormal_reason',
      key: 'abnormal_reason',
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

  const sortedNodeRecords = [...task.node_records].sort(
    (a, b) => NODE_ORDER.indexOf(a.node_type as typeof NODE_ORDER[number]) - NODE_ORDER.indexOf(b.node_type as typeof NODE_ORDER[number])
  );

  const actionButtons = getActionButtons();

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
          {task.is_timeout && (
            <Tag color="red" icon={<WarningOutlined className="animate-blink" />}>
              已超时
            </Tag>
          )}
        </Space>
        <Space>{actionButtons}</Space>
      </div>

      <Card className="mb-6">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="任务编号">
            <span className="font-mono">{task.task_no}</span>
          </Descriptions.Item>
          <Descriptions.Item label="款号">{task.style_no}</Descriptions.Item>
          <Descriptions.Item label="款名">{task.style_name}</Descriptions.Item>
          <Descriptions.Item label="当前节点">
            <Tag color={getNodeColor(task.current_node)}>
              {NODE_LABELS[task.current_node]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={getStatusColor(task.status)}>
              {STATUS_LABELS[task.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="责任人">{getResponsibleName(task)}</Descriptions.Item>
          <Descriptions.Item label="创建人">{task.registrar_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="剩余时长" span={2}>
            {task.is_timeout && task.timeout_hours > 0 ? (
              <span className="text-red-500 font-medium">
                {formatTimeoutDisplay(task.timeout_hours)}
              </span>
            ) : task.current_node !== 'archived' ? (
              <span className="text-green-600">正常</span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="更多信息" className="mb-6">
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="订单号">{task.order_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="客户名">{task.customer_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="面料">{task.fabric_type || '-'}</Descriptions.Item>
          <Descriptions.Item label="颜色">{task.color || '-'}</Descriptions.Item>
          <Descriptions.Item label="尺码">{task.size_spec || '-'}</Descriptions.Item>
          <Descriptions.Item label="数量">{task.quantity ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="优先级">{task.priority || '-'}</Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(task.updated_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="节点进度" className="mb-6">
        <TaskFlowSteps task={task} />
      </Card>

      <Card title="节点处理记录" className="mb-6">
        <Table<NodeRecordDetail>
          rowKey="id"
          columns={nodeRecordColumns}
          dataSource={sortedNodeRecords}
          pagination={false}
          rowClassName={(record) => (record.is_timeout === 1 ? 'row-timeout' : '')}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={12}>
          <Card title="操作区" extra={<FileTextOutlined />}>
            <div className="text-center py-8">
              {actionButtons && actionButtons.length > 0 ? (
                <Space direction="vertical" size="middle">
                  <Text type="secondary">请选择要执行的操作</Text>
                  <Space>{actionButtons}</Space>
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
        <OperationTimeline logs={task.operation_logs || []} />
      </Card>

      <ActionModal
        open={actionModal.open}
        title={actionModal.title}
        action={actionModal.action}
        showAbnormalReason={actionModal.showAbnormalReason}
        loading={actionLoading}
        onCancel={() => setActionModal({ ...actionModal, open: false })}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}
