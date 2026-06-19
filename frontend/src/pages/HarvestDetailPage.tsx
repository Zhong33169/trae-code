import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Tabs,
  Table,
  Timeline,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  QrcodeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { harvestApi, ProcessDto, SubmitVerifyDto, ScanVerifyDto } from '../api';
import {
  HarvestRecord,
  HarvestStatus,
  StatusLabelMap,
  StatusColorMap,
  Role,
  ScanRecord,
  ScanResultLabelMap,
  ScanResultColorMap,
  AuditLog,
  ProcessComment,
} from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const HarvestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [record, setRecord] = useState<HarvestRecord | null>(null);
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [comments, setComments] = useState<ProcessComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    visible: boolean;
    action: string;
    title: string;
  }>({ visible: false, action: '', title: '' });
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [scanForm] = Form.useForm();

  useEffect(() => {
    if (id && user) loadDetail();
  }, [id, user]);

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [recordData, scans, audits, cmts] = await Promise.all([
        harvestApi.findById(id),
        harvestApi.getScans(id),
        harvestApi.getAudits(id),
        harvestApi.getComments(id),
      ]);
      setRecord(recordData as HarvestRecord);
      setScanRecords(scans as ScanRecord[]);
      setAuditLogs(audits as AuditLog[]);
      setComments(cmts as ProcessComment[]);
    } catch (e: any) {
      message.error('加载详情失败');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    if (!record || !user) return false;
    return (
      (record.status === HarvestStatus.DRAFT || record.status === HarvestStatus.PENDING_CORRECTION) &&
      record.created_by === user.id
    );
  };

  const canSubmit = () => {
    if (!record || !user) return false;
    return (
      (record.status === HarvestStatus.DRAFT || record.status === HarvestStatus.PENDING_CORRECTION) &&
      record.created_by === user.id &&
      record.materials &&
      record.materials.trim().length > 0
    );
  };

  const canVerifyPass = () => {
    if (!record || !user) return false;
    return (
      (record.status === HarvestStatus.SUBMITTED || record.status === HarvestStatus.PENDING_CORRECTION) &&
      user.role === Role.TECHNICIAN
    );
  };

  const canVerifyReject = () => canVerifyPass();

  const canReviewPass = () => {
    if (!record || !user) return false;
    return (
      (record.status === HarvestStatus.VERIFIED || record.status === HarvestStatus.PENDING_REVIEW) &&
      user.role === Role.COOP_DIRECTOR
    );
  };

  const canReviewReject = () => canReviewPass();

  const canScan = () => {
    if (!record || !user) return false;
    return record.status === HarvestStatus.SUBMITTED && user.role === Role.TECHNICIAN;
  };

  const openActionModal = (action: string, title: string) => {
    setActionModal({ visible: true, action, title });
    form.resetFields();
  };

  const handleActionSubmit = async () => {
    if (!id || !record) return;
    try {
      const values = await form.validateFields();

      if (actionModal.action === 'SUBMIT') {
        const dto: SubmitVerifyDto = {
          comment: values.comment,
          deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : undefined,
          version: record.version,
        };
        await harvestApi.submit(id, dto);
        message.success('提交成功');
      } else {
        const dto: ProcessDto = {
          action: actionModal.action as any,
          comment: values.comment,
          actual_weight: values.actual_weight,
          deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : undefined,
          version: record.version,
        };
        await harvestApi.process(id, dto);
        message.success('处理成功');
      }

      setActionModal({ visible: false, action: '', title: '' });
      loadDetail();
    } catch (e: any) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const handleScanSubmit = async () => {
    if (!id || !record) return;
    try {
      const values = await scanForm.validateFields();
      const dto: ScanVerifyDto = {
        scan_code: values.scan_code,
        credential: values.credential,
        remark: values.remark,
        version: record.version,
      };
      const result = await harvestApi.scan(id, dto);
      message.info(result.message);
      setScanModalVisible(false);
      scanForm.resetFields();
      loadDetail();
    } catch (e: any) {
      message.error(e.response?.data?.message || '扫码失败');
    }
  };

  const parseMaterials = (materials?: string) => {
    if (!materials) return [];
    try {
      return JSON.parse(materials);
    } catch {
      return [];
    }
  };

  const scanColumns = [
    {
      title: '扫码时间',
      dataIndex: 'scanned_at',
      key: 'scanned_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '扫码内容',
      dataIndex: 'scan_code',
      key: 'scan_code',
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (result: string) => (
        <Tag color={ScanResultColorMap[result as keyof typeof ScanResultColorMap]}>
          {ScanResultLabelMap[result as keyof typeof ScanResultLabelMap]}
        </Tag>
      ),
    },
    {
      title: '凭证',
      dataIndex: 'credential',
      key: 'credential',
      render: (val: string) => val || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (val: string) => val || '-',
    },
  ];

  if (!record) {
    return (
      <div>
        <div className="header-bar">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/harvest')}>
            返回列表
          </Button>
          <h2>采收记录详情</h2>
        </div>
        <Card loading={loading}>记录不存在或加载中</Card>
      </div>
    );
  }

  return (
    <div>
      <div className="header-bar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/harvest')}>
            返回列表
          </Button>
          <h2>
            采收记录详情
            <Tag color={StatusColorMap[record.status]} style={{ marginLeft: 12 }}>
              {StatusLabelMap[record.status]}
            </Tag>
          </h2>
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadDetail} loading={loading}>
            刷新
          </Button>
          {canEdit() && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/harvest/edit/${record.id}`)}
            >
              编辑
            </Button>
          )}
          {canSubmit() && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => openActionModal('SUBMIT', '提交核验')}
            >
              提交核验
            </Button>
          )}
          {canScan() && (
            <Button
              type="primary"
              icon={<QrcodeOutlined />}
              onClick={() => {
                setScanModalVisible(true);
                scanForm.setFieldsValue({ scan_code: record.record_no });
              }}
            >
              扫码核验
            </Button>
          )}
          {canVerifyPass() && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => openActionModal('PASS', '核验通过')}
            >
              核验通过
            </Button>
          )}
          {canVerifyReject() && (
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => openActionModal('REJECT', '驳回补正')}
            >
              驳回补正
            </Button>
          )}
          {canReviewPass() && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => openActionModal('REVIEW_PASS', '复核通过')}
            >
              复核通过
            </Button>
          )}
          {canReviewReject() && (
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => openActionModal('REVIEW_REJECT', '复核驳回')}
            >
              复核驳回
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前处理队列"
              value={
                record.current_queue === Role.FIELD_ADMIN
                  ? '田间管理员'
                  : record.current_queue === Role.TECHNICIAN
                  ? '农技员'
                  : '合作社主任'
              }
              valueStyle={{
                color: record.current_queue === user?.role ? '#52c41a' : '#faad14',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="版本号（乐观锁）"
              value={record.version}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="截止时限"
              value={record.deadline ? dayjs(record.deadline).format('YYYY-MM-DD') : '未设置'}
              valueStyle={{
                color: record.deadline && dayjs(record.deadline).isBefore(dayjs()) ? '#ff4d4f' : '#666',
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="扫码核验次数"
              value={scanRecords.length}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="1">
        <TabPane tab="基本信息" key="1">
          <Card className="detail-section">
            <div className="detail-section-title">采收信息</div>
            <Descriptions column={2} bordered size="middle">
              <Descriptions.Item label="记录编号">{record.record_no}</Descriptions.Item>
              <Descriptions.Item label="批次号">{record.batch_no}</Descriptions.Item>
              <Descriptions.Item label="作物类型">{record.crop_type}</Descriptions.Item>
              <Descriptions.Item label="作物名称">{record.crop_name}</Descriptions.Item>
              <Descriptions.Item label="采收日期">{record.harvest_date}</Descriptions.Item>
              <Descriptions.Item label="种植户">{record.planter}</Descriptions.Item>
              <Descriptions.Item label="采收面积(亩)">{record.harvest_area}</Descriptions.Item>
              <Descriptions.Item label="田间位置">{record.field_location}</Descriptions.Item>
              <Descriptions.Item label="预估重量(kg)">{record.estimated_weight}</Descriptions.Item>
              <Descriptions.Item label="实际重量(kg)">
                {record.actual_weight ?? '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card className="detail-section" style={{ marginTop: 16 }}>
            <div className="detail-section-title">材料附件</div>
            {parseMaterials(record.materials).length > 0 ? (
              <Space wrap>
                {parseMaterials(record.materials).map((m: any, i: number) => (
                  <Tag key={i} color="blue">
                    {m.name}
                  </Tag>
                ))}
              </Space>
            ) : (
              <div style={{ color: '#999' }}>暂无材料（提交核验前必须上传）</div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="扫码记录" key="2">
          <Card>
            {scanRecords.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
                暂无扫码记录
              </div>
            ) : (
              <Table
                rowKey="id"
                columns={scanColumns}
                dataSource={scanRecords}
                pagination={false}
              />
            )}
          </Card>
        </TabPane>

        <TabPane tab="处理意见" key="3">
          <Card>
            {comments.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
                暂无处理意见
              </div>
            ) : (
              <Timeline>
                {comments.map((c) => (
                  <Timeline.Item key={c.id}>
                    <div className="timeline-item">
                      <div style={{ fontWeight: 600 }}>
                        {c.operator_name}
                        <Tag style={{ marginLeft: 8 }}>{c.action_type}</Tag>
                        <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                          {dayjs(c.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>{c.comment}</div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </TabPane>

        <TabPane tab="审计日志" key="4">
          <Card>
            {auditLogs.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
                暂无审计记录
              </div>
            ) : (
              <Timeline>
                {auditLogs.map((log) => (
                  <Timeline.Item key={log.id} color={log.new_status ? 'blue' : 'gray'}>
                    <div className="timeline-item">
                      <div style={{ fontWeight: 600 }}>
                        {log.action}
                        <span style={{ color: '#999', marginLeft: 8, fontSize: 12 }}>
                          {log.operator_name} · {dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                      {log.old_status && log.new_status && (
                        <div style={{ marginTop: 4 }}>
                          <Tag>{StatusLabelMap[log.old_status as HarvestStatus]}</Tag>
                          <span style={{ margin: '0 8px' }}>→</span>
                          <Tag color="blue">{StatusLabelMap[log.new_status as HarvestStatus]}</Tag>
                        </div>
                      )}
                      {log.remark && <div style={{ marginTop: 4, color: '#666' }}>{log.remark}</div>}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={actionModal.title}
        open={actionModal.visible}
        onCancel={() => setActionModal({ visible: false, action: '', title: '' })}
        footer={[
          <Button key="cancel" onClick={() => setActionModal({ visible: false, action: '', title: '' })}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleActionSubmit}>
            确认
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="comment"
            label="处理意见"
            rules={[{ required: true, message: '请输入处理意见' }]}
          >
            <TextArea rows={4} placeholder="请输入处理意见" />
          </Form.Item>
          {(actionModal.action === 'REJECT' || actionModal.action === 'REVIEW_REJECT') && (
            <Form.Item
              name="deadline"
              label="补正时限"
              rules={[{ required: true, message: '请选择补正时限' }]}
            >
              <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          )}
          {actionModal.action === 'REVIEW_PASS' && (
            <Form.Item
              name="actual_weight"
              label="实际过磅重量(kg)"
              rules={[{ required: true, message: '请输入实际过磅重量' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入实际过磅重量" />
            </Form.Item>
          )}
          {actionModal.action === 'SUBMIT' && (
            <Form.Item name="deadline" label="核验时限（可选）">
              <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="扫码核验"
        open={scanModalVisible}
        onCancel={() => setScanModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setScanModalVisible(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={handleScanSubmit}>
            确认核验
          </Button>,
        ]}
        destroyOnClose
      >
        <Form form={scanForm} layout="vertical">
          <Form.Item
            name="scan_code"
            label="扫码内容（记录编号）"
            rules={[{ required: true, message: '请输入扫码内容' }]}
          >
            <Input placeholder="扫描二维码或输入记录编号" />
          </Form.Item>
          <Form.Item
            name="credential"
            label="核验凭证（照片/视频链接）"
            rules={[{ required: true, message: '请上传核验凭证' }]}
          >
            <TextArea rows={3} placeholder="请输入核验凭证信息，如照片链接" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HarvestDetailPage;
