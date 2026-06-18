'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Card,
  Statistic,
  Row,
  Col,
  message,
  Modal,
  Checkbox,
  Form,
  InputNumber,
  DatePicker,
} from 'antd';
import {
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { orderApi, orderApi as api, orderApi } from '@/services/api';
import { useAuthStore } from '@/store';
import type { RectificationOrder, Statistics, AllowedAction } from '@/types';
import { STATUS_COLORS } from '@/types';

const { RangePicker } = DatePicker;

export default function OrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<RectificationOrder[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    department: undefined as string | undefined,
    is_overdue: undefined as boolean | undefined,
    keyword: undefined as string | undefined,
  });
  const [batchModal, setBatchModal] = useState(false);
  const [batchForm] = Form.useForm();
  const [allowedBatchActions, setAllowedBatchActions] = useState<AllowedAction[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await orderApi.getList({
        ...filters,
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      });
      setOrders(response.items);
      setStatistics(response.statistics);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPagination((p) => ({ ...p, current: 1 }));
    fetchData();
  };

  const handleReset = () => {
    setFilters({
      status: undefined,
      department: undefined,
      is_overdue: undefined,
      keyword: undefined,
    });
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleTableChange = (newPagination: any) => {
    setPagination(newPagination);
  };

  const handleBatchAction = async () => {
    try {
      const values = await batchForm.validateFields();
      const action = values.action;
      const targetOrder = orders.find((o) => o.id === selectedRowKeys[0]);
      const actionInfo = targetOrder?.allowed_actions?.find((a) => a.action === action);

      const extraData: any = {};
      if (action === 'APPROVE_QUALITY' || action === 'REJECT') {
        extraData.quality_data = {
          problems_found: values.problems_found,
          quality_score: values.quality_score,
          check_result: action === 'APPROVE_QUALITY' ? 'PASS' : 'FAIL',
          quality_opinion: values.quality_opinion,
        };
      }
      if (action === 'SEND_NOTICE') {
        extraData.notice_data = {
          notice_title: values.notice_title,
          notice_content: values.notice_content,
          deadline: values.deadline?.toISOString(),
          recipient_department: values.recipient_department,
        };
      }
      if (action === 'APPROVE_ARCHIVE' || action === 'REJECT_RECTIFICATION') {
        extraData.review_data = {
          review_opinion: values.review_opinion,
          review_result: action === 'APPROVE_ARCHIVE' ? 'PASS' : 'FAIL',
          archive_location: values.archive_location,
        };
      }
      if (action === 'CONFIRM') {
        extraData.director_opinion = values.director_opinion;
      }

      const result = await orderApi.batchOperation({
        order_ids: selectedRowKeys,
        action,
        remark: values.remark,
        data: {
          overdue_reason: values.overdue_reason,
          follow_up_action: values.follow_up_action,
          ...extraData,
        },
      });

      message.success(
        `批量操作完成：成功 ${result.success_count} 条，失败 ${result.failed_count} 条`
      );
      setBatchModal(false);
      batchForm.resetFields();
      setSelectedRowKeys([]);
      fetchData();

      if (result.results.some((r) => !r.success)) {
        Modal.error({
          title: '部分操作失败',
          content: (
            <ul>
              {result.results.filter((r) => !r.success).map((r) => (
                <li key={r.order_id}>
                  {r.order_no || `#${r.order_id}`}: {r.message}
                </li>
              ))}
            </ul>
          ),
        });
      }
    } catch (error: any) {
      message.error(error.message || '批量操作失败');
    }
  };

  const handleRowSelect = (newSelectedRowKeys: number[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    if (newSelectedRowKeys.length > 0) {
      const firstOrder = orders.find((o) => o.id === newSelectedRowKeys[0]);
      if (firstOrder?.allowed_actions) {
        const sameActions = newSelectedRowKeys.every((id) => {
          const order = orders.find((o) => o.id === id);
          return order?.status === firstOrder.status;
        });
        if (sameActions) {
          setAllowedBatchActions(firstOrder.allowed_actions);
        } else {
          setAllowedBatchActions([]);
          message.warning('请选择相同状态的整改单进行批量操作');
        }
      }
    } else {
      setAllowedBatchActions([]);
    }
  };

  const statusOptions = [
    { value: 'PENDING_SUBMIT', label: '待提交' },
    { value: 'SUBMITTED', label: '已提交' },
    { value: 'REJECTED', label: '已退回' },
    { value: 'RESUBMITTED', label: '重新提交' },
    { value: 'QUALITY_CHECKED', label: '质控已审核' },
    { value: 'NOTICE_SENT', label: '整改通知已发送' },
    { value: 'REVIEWED', label: '复核通过' },
    { value: 'ARCHIVED', label: '已归档' },
    { value: 'CONFIRMED', label: '医务部确认' },
  ];

  const columns = [
    {
      title: '整改单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 130,
      render: (text: string, record: RectificationOrder) => (
        <Link href={`/orders/${record.id}`} style={{ color: '#1677ff', fontWeight: 500 }}>
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
      title: '病历号',
      dataIndex: 'medical_record_no',
      key: 'medical_record_no',
      width: 120,
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 100,
      filters: user?.role !== 'DEPARTMENT_SECRETARY' ? [
        { text: '内科', value: '内科' },
        { text: '外科', value: '外科' },
      ] : undefined,
      onFilter: (value: string, record: RectificationOrder) => record.department === value,
    },
    {
      title: '诊断',
      dataIndex: 'diagnosis',
      key: 'diagnosis',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: RectificationOrder) => (
        <Space>
          <Tag color={STATUS_COLORS[status]}>
            {record.status_cn}
          </Tag>
          {record.is_overdue && (
            <Tag color="red" icon={<WarningOutlined />} className="overdue-tag">
              已超时
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '当前节点',
      dataIndex: 'current_node_cn',
      key: 'current_node_cn',
      width: 120,
    },
    {
      title: '处理人',
      key: 'handlers',
      width: 150,
      render: (_: any, record: RectificationOrder) => (
        <Space direction="vertical" size={0}>
          {record.department_secretary_name && (
            <span style={{ fontSize: 12 }}>秘书: {record.department_secretary_name}</span>
          )}
          {record.quality_doctor_name && (
            <span style={{ fontSize: 12 }}>质控: {record.quality_doctor_name}</span>
          )}
          {record.medical_director_name && (
            <span style={{ fontSize: 12 }}>主任: {record.medical_director_name}</span>
          )}
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: RectificationOrder) => (
        <Link href={`/orders/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>
            详情
          </Button>
        </Link>
      ),
    },
  ];

  const visibleColumns = columns.filter((col) => {
    if (!user) return true;
    if (user.role === 'DEPARTMENT_SECRETARY') {
      return !['medical_director_name'].includes(col.key as string);
    }
    return true;
  });

  const rowSelection = {
    selectedRowKeys,
    onChange: handleRowSelect,
    getCheckboxProps: (record: RectificationOrder) => ({
      disabled: !record.allowed_actions || record.allowed_actions.length === 0,
    }),
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="整改单总数"
              value={statistics?.total || 0}
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="待我处理"
              value={statistics?.pending_my_action || 0}
              valueStyle={{ color: '#1677ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="已超时"
              value={statistics?.overdue_count || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic
              title="已完成"
              value={statistics?.by_status?.CONFIRMED || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]}>
          <Input
            placeholder="搜索整改单号/患者姓名/病历号"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onPressEnter={handleSearch}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            style={{ width: 150 }}
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v })}
            allowClear
            options={statusOptions}
          />
          <Select
            placeholder="是否超时"
            style={{ width: 120 }}
            value={filters.is_overdue}
            onChange={(v) => setFilters({ ...filters, is_overdue: v })}
            allowClear
            options={[
              { value: true, label: '是' },
              { value: false, label: '否' },
            ]}
          />
          {user?.role !== 'DEPARTMENT_SECRETARY' && (
            <Select
              placeholder="科室筛选"
              style={{ width: 120 }}
              value={filters.department}
              onChange={(v) => setFilters({ ...filters, department: v })}
              allowClear
              options={[
                { value: '内科', label: '内科' },
                { value: '外科', label: '外科' },
              ]}
            />
          )}
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
          {selectedRowKeys.length > 0 && allowedBatchActions.length > 0 && (
            <Button
              type="primary"
              danger
              onClick={() => setBatchModal(true)}
            >
              批量操作 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={visibleColumns}
          dataSource={orders}
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={`批量操作 (${selectedRowKeys.length} 条)`}
        open={batchModal}
        onCancel={() => setBatchModal(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={batchForm} layout="vertical">
          <Form.Item
            name="action"
            label="选择操作"
            rules={[{ required: true, message: '请选择操作' }]}
          >
            <Select
              options={allowedBatchActions.map((a) => ({
                value: a.action,
                label: `${a.action_cn} → ${a.new_status_cn}`,
              }))}
              onChange={(val) => batchForm.setFieldsValue({
                check_result: val === 'APPROVE_QUALITY' ? 'PASS' :
                  val === 'REJECT' ? 'FAIL' :
                  val === 'APPROVE_ARCHIVE' ? 'PASS' :
                  val === 'REJECT_RECTIFICATION' ? 'FAIL' : undefined,
              })}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const action = getFieldValue('action');
              if (action === 'APPROVE_QUALITY' || action === 'REJECT') {
                return (
                  <>
                    <Form.Item name="problems_found" label="发现问题">
                      <Input.TextArea rows={2} placeholder="请输入发现的问题" />
                    </Form.Item>
                    <Form.Item name="quality_score" label="质量评分">
                      <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
                    </Form.Item>
                    <Form.Item name="quality_opinion" label="质控意见">
                      <Input.TextArea rows={2} placeholder="请输入质控意见" />
                    </Form.Item>
                  </>
                );
              }
              if (action === 'SEND_NOTICE') {
                return (
                  <>
                    <Form.Item name="notice_title" label="通知标题" rules={[{ required: true }]}>
                      <Input placeholder="整改通知" />
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
                );
              }
              if (action === 'APPROVE_ARCHIVE' || action === 'REJECT_RECTIFICATION') {
                return (
                  <>
                    <Form.Item name="review_opinion" label="复核意见" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} placeholder="请输入复核意见" />
                    </Form.Item>
                    <Form.Item name="archive_location" label="归档位置">
                      <Input placeholder="档案柜编号等" />
                    </Form.Item>
                  </>
                );
              }
              if (action === 'CONFIRM') {
                return (
                  <Form.Item name="director_opinion" label="主任意见">
                    <Input.TextArea rows={2} placeholder="请输入医务部主任意见" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="overdue_reason" label="超时原因（如超时必填）">
            <Input.TextArea rows={2} placeholder="如有超时请填写原因" />
          </Form.Item>
          <Form.Item name="follow_up_action" label="后续处理">
            <Input.TextArea rows={2} placeholder="请输入后续处理措施" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleBatchAction}>
                确认批量操作
              </Button>
              <Button onClick={() => setBatchModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
