import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Row,
  Col,
  Modal,
  Form,
  message,
  Card,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { harvestApi, BatchProcessDto, BatchProcessItem } from '../api';
import {
  HarvestRecord,
  HarvestStatus,
  StatusLabelMap,
  StatusColorMap,
  Role,
} from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

const HarvestListPage: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<HarvestRecord[]>([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchAction, setBatchAction] = useState<'SUBMIT' | 'VERIFY_PASS' | 'REVIEW_PASS'>('SUBMIT');
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string[]>(searchParams.getAll('status'));
  const [queueFilter, setQueueFilter] = useState<string>(searchParams.get('queue') || '');
  const [keyword, setKeyword] = useState<string>(searchParams.get('keyword') || '');

  useEffect(() => {
    if (user) loadRecords();
  }, [user, statusFilter, queueFilter, keyword]);

  useEffect(() => {
    if (queueFilter) {
      if (queueFilter === 'FIELD_ADMIN') {
        setBatchAction('SUBMIT');
      } else if (queueFilter === 'TECHNICIAN') {
        setBatchAction('VERIFY_PASS');
      } else if (queueFilter === 'COOP_DIRECTOR') {
        setBatchAction('REVIEW_PASS');
      }
    } else if (statusFilter.length > 0) {
      if (statusFilter.includes(HarvestStatus.DRAFT) || statusFilter.includes(HarvestStatus.PENDING_CORRECTION)) {
        setBatchAction('SUBMIT');
      } else if (statusFilter.includes(HarvestStatus.SUBMITTED)) {
        setBatchAction('VERIFY_PASS');
      } else if (statusFilter.includes(HarvestStatus.VERIFIED) || statusFilter.includes(HarvestStatus.PENDING_REVIEW)) {
        setBatchAction('REVIEW_PASS');
      }
    }
  }, [statusFilter, queueFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (queueFilter) params.queue = queueFilter;
      if (statusFilter.length > 0) params.status = statusFilter;
      if (keyword) params.keyword = keyword;
      const data = (await harvestApi.findAll(params)) as HarvestRecord[];
      setRecords(data);
    } catch (e: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    const newParams = new URLSearchParams();
    if (queueFilter) newParams.set('queue', queueFilter);
    statusFilter.forEach((s) => newParams.append('status', s));
    if (value) newParams.set('keyword', value);
    setSearchParams(newParams);
  };

  const handleStatusChange = (value: string[]) => {
    setStatusFilter(value || []);
    const newParams = new URLSearchParams();
    if (queueFilter) newParams.set('queue', queueFilter);
    (value || []).forEach((s) => newParams.append('status', s));
    if (keyword) newParams.set('keyword', keyword);
    setSearchParams(newParams);
  };

  const handleBatchProcess = async () => {
    try {
      const values = await form.validateFields();
      const recordsWithVersion: BatchProcessItem[] = selectedRecords.map((r) => ({
        id: r.id,
        version: r.version,
      }));
      const dto: BatchProcessDto = {
        records: recordsWithVersion,
        action: batchAction,
        comment: values.comment,
      };
      const result = await harvestApi.batch(dto);
      message.success(`批量处理完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
      if (result.failed > 0) {
        result.details
          .filter((d: any) => !d.success)
          .forEach((d: any) => {
            message.error(`${d.id}: ${d.message}`);
          });
      }
      setBatchModalVisible(false);
      setSelectedRowKeys([]);
      setSelectedRecords([]);
      form.resetFields();
      loadRecords();
    } catch (e: any) {
      message.error(e.response?.data?.message || '批量处理失败');
    }
  };

  const getActionOptions = () => {
    const options: { label: string; value: 'SUBMIT' | 'VERIFY_PASS' | 'REVIEW_PASS' }[] = [];
    if (user?.role === Role.FIELD_ADMIN) {
      options.push({ label: '批量提交核验', value: 'SUBMIT' });
    }
    if (user?.role === Role.TECHNICIAN) {
      options.push({ label: '批量核验通过', value: 'VERIFY_PASS' });
    }
    if (user?.role === Role.COOP_DIRECTOR) {
      options.push({ label: '批量复核通过', value: 'REVIEW_PASS' });
    }
    return options;
  };

  const columns = [
    {
      title: '记录编号',
      dataIndex: 'record_no',
      key: 'record_no',
      render: (text: string, record: HarvestRecord) => (
        <a onClick={() => navigate(`/harvest/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '作物',
      dataIndex: 'crop_name',
      key: 'crop_name',
    },
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
    },
    {
      title: '采收日期',
      dataIndex: 'harvest_date',
      key: 'harvest_date',
    },
    {
      title: '面积(亩)',
      dataIndex: 'harvest_area',
      key: 'harvest_area',
    },
    {
      title: '预估重量(kg)',
      dataIndex: 'estimated_weight',
      key: 'estimated_weight',
    },
    {
      title: '实际重量(kg)',
      dataIndex: 'actual_weight',
      key: 'actual_weight',
      render: (val: number) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: HarvestStatus) => (
        <Tag color={StatusColorMap[status]}>{StatusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '截止时限',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (time: string) =>
        time ? (
          <Tag color={dayjs(time).isBefore(dayjs()) ? 'error' : 'default'}>
            {dayjs(time).format('YYYY-MM-DD')}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HarvestRecord) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate(`/harvest/${record.id}`)}>
            详情
          </Button>
          {(record.status === HarvestStatus.DRAFT || record.status === HarvestStatus.PENDING_CORRECTION) &&
            record.created_by === user?.id && (
              <Button type="link" size="small" onClick={() => navigate(`/harvest/edit/${record.id}`)}>
                编辑
              </Button>
            )}
          {record.status === HarvestStatus.SUBMITTED && user?.role === Role.TECHNICIAN && (
            <Button
              type="link"
              size="small"
              icon={<QrcodeOutlined />}
              onClick={() => navigate(`/scan?recordId=${record.id}`)}
            >
              扫码
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], selectedRows: HarvestRecord[]) => {
      setSelectedRowKeys(keys);
      setSelectedRecords(selectedRows);
    },
    getCheckboxProps: (record: HarvestRecord) => ({
      disabled:
        (batchAction === 'SUBMIT' &&
          record.status !== HarvestStatus.DRAFT &&
          record.status !== HarvestStatus.PENDING_CORRECTION) ||
        (batchAction === 'VERIFY_PASS' &&
          record.status !== HarvestStatus.SUBMITTED) ||
        (batchAction === 'REVIEW_PASS' &&
          record.status !== HarvestStatus.VERIFIED &&
          record.status !== HarvestStatus.PENDING_REVIEW) ||
        (batchAction === 'SUBMIT' && record.created_by !== user?.id),
    }),
  };

  return (
    <div>
      <div className="header-bar">
        <h2>采收记录列表</h2>
        <Space>
          {user?.role === Role.FIELD_ADMIN && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/harvest/create')}>
              新增采收记录
            </Button>
          )}
          {selectedRowKeys.length > 0 && getActionOptions().length > 0 && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => setBatchModalVisible(true)}
            >
              批量处理 ({selectedRowKeys.length})
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadRecords} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Search
            placeholder="搜索记录编号、作物名称、批次号"
            allowClear
            enterButton={<SearchOutlined />}
            size="large"
            onSearch={handleSearch}
            defaultValue={keyword}
          />
        </Col>
        <Col span={6}>
          <Select
            placeholder="筛选状态（可多选）"
            allowClear
            mode="multiple"
            maxTagCount="responsive"
            style={{ width: '100%' }}
            size="large"
            onChange={handleStatusChange}
            value={statusFilter}
          >
            {Object.entries(StatusLabelMap).map(([key, label]) => (
              <Option key={key} value={key}>
                {label}
              </Option>
            ))}
          </Select>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={records}
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title="批量处理"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBatchModalVisible(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleBatchProcess}>
            确认处理
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="处理动作">
            <Select
              value={batchAction}
              onChange={setBatchAction}
              style={{ width: '100%' }}
            >
              {getActionOptions().map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="comment"
            label="处理意见"
            rules={[{ required: true, message: '请输入处理意见' }]}
          >
            <TextArea rows={4} placeholder="请输入处理意见" />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 13 }}>
            已选择 {selectedRowKeys.length} 条记录进行批量处理
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default HarvestListPage;
