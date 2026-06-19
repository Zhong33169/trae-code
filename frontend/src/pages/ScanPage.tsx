import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Result,
  Tag,
  Descriptions,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  QrcodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { harvestApi, ScanVerifyDto } from '../api';
import {
  HarvestRecord,
  HarvestStatus,
  StatusLabelMap,
  StatusColorMap,
  Role,
  User,
  ScanResult,
  ScanResultLabelMap,
  ScanResultColorMap,
} from '../types';
import dayjs from 'dayjs';

const { TextArea } = Input;

const ScanPage: React.FC = () => {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<HarvestRecord | null>(null);
  const [scanResult, setScanResult] = useState<{
    result: ScanResult;
    message: string;
  } | null>(null);

  const [currentUser] = useState<User>(() => {
    const saved = localStorage.getItem('userInfo');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const recordId = searchParams.get('recordId');
    if (recordId) {
      loadRecord(recordId);
    }
  }, [searchParams]);

  const loadRecord = async (recordId: string) => {
    try {
      const data = (await harvestApi.findById(recordId)) as HarvestRecord;
      setRecord(data);
      form.setFieldsValue({ scan_code: data.record_no });
    } catch (e: any) {
      message.error('加载记录失败');
    }
  };

  const handleQueryRecord = async () => {
    const scanCode = form.getFieldValue('scan_code');
    if (!scanCode) {
      message.warning('请输入记录编号');
      return;
    }
    try {
      const records = (await harvestApi.findAll({ keyword: scanCode })) as HarvestRecord[];
      if (records.length > 0) {
        setRecord(records[0]);
        setScanResult(null);
      } else {
        message.warning('未找到对应记录');
      }
    } catch (e: any) {
      message.error('查询失败');
    }
  };

  const handleScanSubmit = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      setLoading(true);

      const dto: ScanVerifyDto = {
        scan_code: values.scan_code,
        credential: values.credential,
        remark: values.remark,
      };

      const result = (await harvestApi.scan(record.id, dto)) as {
        result: ScanResult;
        message: string;
      };

      setScanResult(result);
      message.info(result.message);

      if (result.result === ScanResult.SUCCESS) {
        loadRecord(record.id);
      }
    } catch (e: any) {
      message.error(e.response?.data?.message || '扫码核验失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRecord(null);
    setScanResult(null);
    form.resetFields();
  };

  if (currentUser?.role !== Role.TECHNICIAN) {
    return (
      <Card>
        <Result
          status="warning"
          title="仅农技员可执行扫码核验"
          subTitle="请切换到农技员角色后再操作"
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="header-bar">
        <h2>
          <QrcodeOutlined style={{ marginRight: 8 }} />
          扫码核验
        </h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="扫码录入">
            <Form form={form} layout="vertical">
              <Form.Item
                name="scan_code"
                label="扫码内容（记录编号）"
                rules={[{ required: true, message: '请输入扫码内容' }]}
              >
                <Input
                  placeholder="扫描二维码或输入记录编号，如 HS202506190001"
                  size="large"
                  suffix={
                    <Button
                      type="text"
                      icon={<SearchOutlined />}
                      onClick={handleQueryRecord}
                    />
                  }
                />
              </Form.Item>

              {record && (
                <Card
                  size="small"
                  style={{ marginBottom: 16, background: '#fafafa' }}
                  title="采收记录信息"
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="记录编号">
                      {record.record_no}
                    </Descriptions.Item>
                    <Descriptions.Item label="作物">{record.crop_name}</Descriptions.Item>
                    <Descriptions.Item label="批次号">{record.batch_no}</Descriptions.Item>
                    <Descriptions.Item label="采收日期">{record.harvest_date}</Descriptions.Item>
                    <Descriptions.Item label="种植户">{record.planter}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={StatusColorMap[record.status]}>
                        {StatusLabelMap[record.status]}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Form.Item
                name="credential"
                label="核验凭证（现场照片/视频链接）"
                rules={[{ required: true, message: '请上传核验凭证' }]}
                help="扫码核验必须记录凭证，可填写照片链接或描述"
              >
                <TextArea rows={3} placeholder="请输入核验凭证，如现场照片链接" />
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="可选备注信息" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<QrcodeOutlined />}
                  loading={loading}
                  onClick={handleScanSubmit}
                  disabled={!record || record.status !== HarvestStatus.SUBMITTED}
                >
                  确认扫码核验
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={12}>
          {scanResult && (
            <Card
              style={{
                marginBottom: 16,
                borderColor:
                  scanResult.result === ScanResult.SUCCESS ? '#52c41a' : '#ff4d4f',
              }}
            >
              {scanResult.result === ScanResult.SUCCESS ? (
                <Result
                  status="success"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  title="核验通过"
                  subTitle={scanResult.message}
                  extra={
                    <Button type="primary" onClick={() => navigate(`/harvest/${record?.id}`)}>
                      查看记录详情
                    </Button>
                  }
                />
              ) : (
                <Result
                  status="error"
                  icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  title={ScanResultLabelMap[scanResult.result]}
                  subTitle={scanResult.message}
                />
              )}
              <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="扫码时间"
                      value={dayjs().format('YYYY-MM-DD HH:mm:ss')}
                      valueStyle={{ fontSize: 14 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="核验结果"
                      value={ScanResultLabelMap[scanResult.result]}
                      valueStyle={{
                        color:
                          scanResult.result === ScanResult.SUCCESS ? '#52c41a' : '#ff4d4f',
                        fontSize: 14,
                      }}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          )}

          <Card title="核验说明">
            <div style={{ lineHeight: 2 }}>
              <p>
                <Tag color="blue">核验人</Tag> 仅农技员可执行扫码核验
              </p>
              <p>
                <Tag color="green">核验时机</Tag> 记录状态为「待核验」时可扫码
              </p>
              <p>
                <Tag color="red">无效码</Tag> 二维码与记录编号不匹配
              </p>
              <p>
                <Tag color="orange">重复扫码</Tag> 该记录已完成核验，不可重复操作
              </p>
              <p>
                <Tag color="purple">证据缺失</Tag> 必须上传现场核验凭证
              </p>
              <p>
                <Tag color="red">扫码人不匹配</Tag> 非农技员角色不可核验
              </p>
              <p style={{ marginTop: 16, color: '#666', fontSize: 13 }}>
                提示：核验失败时，记录会停留在原队列，不会推进状态
              </p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ScanPage;
