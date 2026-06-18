'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  message,
  Input,
  Form,
  Modal,
} from 'antd';
import {
  WarningOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { statisticsApi, orderApi } from '@/services/api';
import { useAuthStore } from '@/store';
import { STATUS_COLORS } from '@/types';

export default function OverduePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [handleModal, setHandleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await statisticsApi.getOverdueReport();
      setData(result.items);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordOverdue = async () => {
    if (!selectedItem) return;

    try {
      const values = await form.validateFields();
      await orderApi.updateStatus(selectedItem.order_id, {
        action: selectedItem.allowed_actions?.[0]?.action || 'SUBMIT',
        overdue_reason: values.overdue_reason,
        follow_up_action: values.follow_up_action,
        remark: values.remark,
      });

      message.success('超时原因已记录');
      setHandleModal(false);
      form.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.message || '记录失败');
    }
  };

  const openHandleModal = (item: any) => {
    setSelectedItem(item);
    form.resetFields();
    form.setFieldsValue({
      overdue_reason: item.overdue_reason,
      follow_up_action: item.follow_up_action,
    });
    setHandleModal(true);
  };

  const columns = [
    {
      title: '整改单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 130,
      render: (text: string, record: any) => (
        <Link href={`/orders/${record.order_id}`} style={{ color: '#ff4d4f', fontWeight: 500 }}>
          {text}
        </Link>
      ),
    },
    {
      title: '患者姓名',
      dataIndex: 'patient_name',
      key: 'patient_name',
      width: 100,
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 100,
    },
    {
      title: '当前状态',
      key: 'status',
      render: (_: any, record: any) => (
        <Tag color={STATUS_COLORS[record.status]}>{record.status_cn}</Tag>
      ),
    },
    {
      title: '超时节点',
      dataIndex: 'overdue_node_cn',
      key: 'overdue_node_cn',
      width: 120,
      render: (text: string) => (
        <Tag color="red" icon={<WarningOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 160,
      render: (date: string) => (
        <span style={{ color: '#ff4d4f' }}>
          <ClockCircleOutlined /> {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: '超时时长',
      key: 'overdue_duration',
      width: 120,
      render: (_: any, record: any) => {
        const hours = Math.max(0, (Date.now() - dayjs(record.deadline).valueOf()) / 3600000);
        const days = Math.floor(hours / 24);
        const remainingHours = Math.floor(hours % 24);
        return (
          <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
            {days > 0 ? `${days}天` : ''}{remainingHours}小时
          </span>
        );
      },
      sorter: (a: any, b: any) => {
        const aHours = (Date.now() - dayjs(a.deadline).valueOf()) / 3600000;
        const bHours = (Date.now() - dayjs(b.deadline).valueOf()) / 3600000;
        return aHours - bHours;
      },
    },
    {
      title: '超时原因',
      dataIndex: 'overdue_reason',
      key: 'overdue_reason',
      render: (text: string) => (
        text ? (
          <span style={{ color: '#666' }}>{text}</span>
        ) : (
          <Tag color="orange" icon={<ExclamationCircleOutlined />}>未填写</Tag>
        )
      ),
    },
    {
      title: '后续处理',
      dataIndex: 'follow_up_action',
      key: 'follow_up_action',
      render: (text: string) => text || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
      render: (text: string) => text || <span style={{ color: '#999' }}>待分配</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Link href={`/orders/${record.order_id}`}>
            <Button type="link" icon={<EyeOutlined />} size="small">
              详情
            </Button>
          </Link>
          {!record.overdue_reason && (
            <Button
              type="primary"
              danger
              icon={<EditOutlined />}
              size="small"
              onClick={() => openHandleModal(record)}
            >
              登记原因
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <WarningOutlined style={{ color: '#ff4d4f' }} /> 节点超时追踪
        <Tag color="red" style={{ marginLeft: 12 }}>共 {total} 条超时记录</Tag>
      </h2>

      <Card>
        <Table
          rowKey="order_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: '暂无超时整改单' }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            登记超时原因
            <span style={{ color: '#888', fontSize: 14 }}>
              ({selectedItem?.order_no})
            </span>
          </Space>
        }
        open={handleModal}
        onCancel={() => setHandleModal(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="overdue_reason"
            label="超时原因"
            rules={[{ required: true, message: '请填写超时原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请详细说明超时原因" />
          </Form.Item>
          <Form.Item
            name="follow_up_action"
            label="后续处理措施"
            rules={[{ required: true, message: '请填写后续处理措施' }]}
          >
            <Input.TextArea rows={3} placeholder="请说明后续处理措施和预计完成时间" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" danger onClick={handleRecordOverdue}>
                确认登记
              </Button>
              <Button onClick={() => setHandleModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
