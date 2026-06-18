'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Timeline,
  Table,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Divider,
  Row,
  Col,
  Statistic,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  UserOutlined,
  EditOutlined,
  ReloadOutlined,
  FileTextOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import dayjs from 'dayjs';
import { orderApi, qualityApi, logsApi } from '@/services/api';
import { useAuthStore } from '@/store';
import type { RectificationOrder, OperationLog, NodeRecord } from '@/types';
import { STATUS_COLORS } from '@/types';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<RectificationOrder | null>(null);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [actionModal, setActionModal] = useState(false);
  const [currentAction, setCurrentAction] = useState<{
    action: string;
    action_cn: string;
    new_status: string;
    new_status_cn: string;
  } | null>(null);
  const [form] = Form.useForm();
  const [linkedEntities, setLinkedEntities] = useState<any>(null);

  const orderId = Number(params.id);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orderData, logsData, linkedData] = await Promise.all([
        orderApi.getDetail(orderId),
        logsApi.getOrderLogs(orderId),
        qualityApi.getLinked(orderId),
      ]);
      setOrder(orderData);
      setLogs(logsData.items);
      setLinkedEntities(linkedData);
    } catch (error: any) {
      message.error(error.message || '加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchData();
    }
  }, [orderId]);

  const handleAction = (action: any) => {
    setCurrentAction(action);
    form.resetFields();
    setActionModal(true);
  };

  const handleSubmitAction = async () => {
    if (!order || !currentAction) return;

    try {
      const values = await form.validateFields();
      const { action } = currentAction;

      let result;

      if (action === 'APPROVE_QUALITY' || action === 'REJECT') {
        result = await qualityApi.submitQuality(orderId, {
          problems_found: values.problems_found,
          quality_score: values.quality_score,
          check_result: action === 'APPROVE_QUALITY' ? 'PASS' : 'FAIL',
          quality_opinion: values.quality_opinion,
          remark: values.remark,
        });
      } else if (action === 'SEND_NOTICE') {
        result = await qualityApi.sendNotice(orderId, {
          notice_title: values.notice_title,
          notice_content: values.notice_content,
          deadline: values.deadline?.toISOString(),
          recipient_department: values.recipient_department,
          remark: values.remark,
        });
      } else if (action === 'APPROVE_ARCHIVE' || action === 'REJECT_RECTIFICATION') {
        result = await qualityApi.reviewArchive(orderId, {
          review_opinion: values.review_opinion,
          review_result: action === 'APPROVE_ARCHIVE' ? 'PASS' : 'FAIL',
          archive_location: values.archive_location,
          remark: values.remark,
        });
      } else {
        result = await orderApi.updateStatus(orderId, {
          action,
          remark: values.remark,
          overdue_reason: values.overdue_reason,
          follow_up_action: values.follow_up_action,
          extra_data: action === 'CONFIRM' ? {
            director_opinion: values.director_opinion,
          } : undefined,
        });
      }

      message.success(`${currentAction.action_cn}成功，状态已变更为「${result.new_status_cn}」`);
      setActionModal(false);
      form.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  if (loading && !order) {
    return <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>;
  }

  if (!order) {
    return <div style={{ textAlign: 'center', padding: 40 }}>整改单不存在</div>;
  }

  const timelineItems = order.nodes?.map((node: NodeRecord) => {
    let color = 'gray';
    let dot = <ClockCircleOutlined />;

    if (node.status === 'COMPLETED') {
      color = 'green';
      dot = <CheckCircleOutlined />;
    } else if (node.status === 'IN_PROGRESS') {
      color = node.is_overdue ? 'red' : 'blue';
      dot = node.is_overdue ? <WarningOutlined /> : <ClockCircleOutlined />;
    }

    return {
      color,
      dot,
      children: (
        <div style={{ paddingBottom: 16 }}>
          <Space>
            <strong>{node.node_name_cn}</strong>
            {node.is_overdue && node.status === 'IN_PROGRESS' && (
              <Tag color="red" icon={<WarningOutlined />}>已超时</Tag>
            )}
            {node.status === 'COMPLETED' && (
              <Tag color="green">已完成</Tag>
            )}
            {node.status === 'IN_PROGRESS' && !node.is_overdue && (
              <Tag color="blue">进行中</Tag>
            )}
            {node.status === 'PENDING' && (
              <Tag>待处理</Tag>
            )}
          </Space>
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
            <div>开始时间：{node.started_at ? dayjs(node.started_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
            <div>截止时间：{node.deadline ? dayjs(node.deadline).format('YYYY-MM-DD HH:mm') : '-'}</div>
            {node.completed_at && (
              <div>完成时间：{dayjs(node.completed_at).format('YYYY-MM-DD HH:mm')}</div>
            )}
            {node.handler_name && (
              <div>处理人：{node.handler_name}</div>
            )}
            {node.overdue_reason && (
              <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                超时原因：{node.overdue_reason}
              </div>
            )}
            {node.follow_up_action && (
              <div style={{ color: '#1677ff', marginTop: 4 }}>
                后续处理：{node.follow_up_action}
              </div>
            )}
          </div>
        </div>
      ),
    };
  });

  const logColumns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100,
    },
    {
      title: '操作',
      dataIndex: 'operation_cn',
      key: 'operation_cn',
      width: 140,
    },
    {
      title: '状态变更',
      key: 'status',
      render: (_: any, record: OperationLog) => (
        <Space>
          {record.old_status_cn && <Tag>{record.old_status_cn}</Tag>}
          {record.old_status_cn && <span>→</span>}
          {record.new_status_cn && <Tag color={STATUS_COLORS[record.new_status!]}>{record.new_status_cn}</Tag>}
        </Space>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '额外信息',
      key: 'extra',
      render: (_: any, record: OperationLog) => {
        if (!record.extra_data) return null;
        const keys = Object.keys(record.extra_data).filter(
          (k) => record.extra_data![k] !== null && record.extra_data![k] !== undefined
        );
        if (keys.length === 0) return null;
        return (
          <Tooltip
            title={
              <div>
                {keys.map((k) => (
                  <div key={k}>
                    <strong>{k}:</strong> {String(record.extra_data![k])}
                  </div>
                ))}
              </div>
            }
          >
            <Button type="link" size="small">查看详情</Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回列表
        </Button>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>
          刷新
        </Button>
      </Space>

      <Card
        title={
          <Space>
            <FileTextOutlined />
            整改单详情
            <Tag color={STATUS_COLORS[order.status]}>{order.status_cn}</Tag>
            {order.is_overdue && (
              <Tag color="red" icon={<WarningOutlined />} className="overdue-tag">已超时</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {order.allowed_actions?.map((action) => (
              <Button
                key={action.action}
                type="primary"
                icon={action.action.includes('REJECT') ? undefined : <SendOutlined />}
                danger={action.action.includes('REJECT')}
                onClick={() => handleAction(action)}
              >
                {action.action_cn}
              </Button>
            ))}
          </Space>
        }
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="整改单号">{order.order_no}</Descriptions.Item>
              <Descriptions.Item label="科室">{order.department}</Descriptions.Item>
              <Descriptions.Item label="患者姓名">{order.patient_name}</Descriptions.Item>
              <Descriptions.Item label="病历号">{order.medical_record_no}</Descriptions.Item>
              <Descriptions.Item label="诊断" span={2}>
                {order.diagnosis || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态" span={2}>
                <Space>
                  <Tag color={STATUS_COLORS[order.status]}>{order.status_cn}</Tag>
                  <span style={{ color: '#888' }}>（节点：{order.current_node_cn}）</span>
                </Space>
              </Descriptions.Item>
              {order.department_secretary_name && (
                <Descriptions.Item label="科室秘书">
                  {order.department_secretary_name}
                </Descriptions.Item>
              )}
              {order.quality_doctor_name && (
                <Descriptions.Item label="质控医生">
                  {order.quality_doctor_name}
                </Descriptions.Item>
              )}
              {order.medical_director_name && (
                <Descriptions.Item label="医务部主任">
                  {order.medical_director_name}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {dayjs(order.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {dayjs(order.updated_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">内容详情</Divider>

            <Descriptions bordered column={1} size="small">
              {order.content && (
                <Descriptions.Item label="病历问题">{order.content}</Descriptions.Item>
              )}
              {order.rectification_requirements && (
                <Descriptions.Item label="整改要求">{order.rectification_requirements}</Descriptions.Item>
              )}
              {order.quality_opinion && (
                <Descriptions.Item label="质控意见">
                  <span style={{ color: '#1677ff' }}>{order.quality_opinion}</span>
                </Descriptions.Item>
              )}
              {order.notice_content && (
                <Descriptions.Item label="整改通知">
                  <span style={{ color: '#faad14' }}>{order.notice_content}</span>
                </Descriptions.Item>
              )}
              {order.review_opinion && (
                <Descriptions.Item label="复核意见">
                  <span style={{ color: '#52c41a' }}>{order.review_opinion}</span>
                </Descriptions.Item>
              )}
              {order.director_opinion && (
                <Descriptions.Item label="主任意见">
                  <span style={{ color: '#722ed1' }}>{order.director_opinion}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            {linkedEntities && Object.keys(linkedEntities).length > 0 && (
              <>
                <Divider orientation="left">关联业务数据</Divider>
                {linkedEntities.quality_control && (
                  <Card size="small" title="质控记录" style={{ marginBottom: 12 }}>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="检查结果">
                        <Tag color={linkedEntities.quality_control.check_result === 'PASS' ? 'green' : 'red'}>
                          {linkedEntities.quality_control.check_result === 'PASS' ? '通过' : '不通过'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="质量评分">
                        {linkedEntities.quality_control.quality_score || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="发现问题" span={2}>
                        {linkedEntities.quality_control.problems_found || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="检查时间" span={2}>
                        {linkedEntities.quality_control.checked_at
                          ? dayjs(linkedEntities.quality_control.checked_at).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
                {linkedEntities.rectification_notice && (
                  <Card size="small" title="整改通知" style={{ marginBottom: 12 }}>
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="标题">
                        {linkedEntities.rectification_notice.notice_title}
                      </Descriptions.Item>
                      <Descriptions.Item label="接收科室">
                        {linkedEntities.rectification_notice.recipient_department}
                      </Descriptions.Item>
                      <Descriptions.Item label="整改期限" span={2}>
                        {dayjs(linkedEntities.rectification_notice.deadline).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                      <Descriptions.Item label="通知内容" span={2}>
                        {linkedEntities.rectification_notice.notice_content}
                      </Descriptions.Item>
                      <Descriptions.Item label="发送时间" span={2}>
                        {dayjs(linkedEntities.rectification_notice.sent_at).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
                {linkedEntities.review_archive && (
                  <Card size="small" title="复核归档">
                    <Descriptions column={2} size="small">
                      <Descriptions.Item label="复核结果">
                        <Tag color={linkedEntities.review_archive.review_result === 'PASS' ? 'green' : 'red'}>
                          {linkedEntities.review_archive.review_result === 'PASS' ? '通过' : '不通过'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="归档位置">
                        {linkedEntities.review_archive.archive_location || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="复核意见" span={2}>
                        {linkedEntities.review_archive.review_opinion}
                      </Descriptions.Item>
                      <Descriptions.Item label="归档时间" span={2}>
                        {dayjs(linkedEntities.review_archive.archived_at).format('YYYY-MM-DD HH:mm')}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                )}
              </>
            )}
          </Col>

          <Col xs={24} lg={10}>
            <Card title="节点时间线" size="small" className="node-timeline">
              <Timeline items={timelineItems} />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card title="操作日志" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          columns={logColumns}
          dataSource={logs}
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={
          <Space>
            <EditOutlined />
            {currentAction?.action_cn}
            <span style={{ color: '#888', fontSize: 14, fontWeight: 'normal' }}>
              → {currentAction?.new_status_cn}
            </span>
          </Space>
        }
        open={actionModal}
        onCancel={() => setActionModal(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {currentAction?.action === 'APPROVE_QUALITY' || currentAction?.action === 'REJECT' ? (
            <>
              <Form.Item name="problems_found" label="发现问题">
                <Input.TextArea rows={2} placeholder="请输入发现的问题" />
              </Form.Item>
              <Form.Item name="quality_score" label="质量评分">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
              </Form.Item>
              <Form.Item name="quality_opinion" label="质控意见" rules={[{ required: true, message: '请输入质控意见' }]}>
                <Input.TextArea rows={2} placeholder="请输入质控意见" />
              </Form.Item>
            </>
          ) : currentAction?.action === 'SEND_NOTICE' ? (
            <>
              <Form.Item name="notice_title" label="通知标题" rules={[{ required: true }]}>
                <Input placeholder="病历整改通知" />
              </Form.Item>
              <Form.Item name="notice_content" label="通知内容" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="请输入整改通知内容" />
              </Form.Item>
              <Form.Item name="deadline" label="整改期限" rules={[{ required: true }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="recipient_department" label="接收科室" rules={[{ required: true }]}>
                <Select options={[
                  { value: '内科', label: '内科' },
                  { value: '外科', label: '外科' },
                ]} />
              </Form.Item>
            </>
          ) : currentAction?.action === 'APPROVE_ARCHIVE' || currentAction?.action === 'REJECT_RECTIFICATION' ? (
            <>
              <Form.Item name="review_opinion" label="复核意见" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="请输入复核意见" />
              </Form.Item>
              <Form.Item name="archive_location" label="归档位置">
                <Input placeholder="档案柜编号等" />
              </Form.Item>
            </>
          ) : currentAction?.action === 'CONFIRM' ? (
            <Form.Item name="director_opinion" label="主任意见">
              <Input.TextArea rows={2} placeholder="请输入医务部主任意见" />
            </Form.Item>
          ) : null}

          {order?.is_overdue && (
            <Form.Item
              name="overdue_reason"
              label="超时原因"
              rules={[{ required: true, message: '该节点已超时，请填写超时原因' }]}
            >
              <Input.TextArea rows={2} placeholder="请详细说明超时原因" />
            </Form.Item>
          )}
          {order?.is_overdue && (
            <Form.Item name="follow_up_action" label="后续处理措施">
              <Input.TextArea rows={2} placeholder="请说明后续处理措施" />
            </Form.Item>
          )}

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSubmitAction}>
                确认{currentAction?.action_cn}
              </Button>
              <Button onClick={() => setActionModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
