import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Button,
  Space,
  message,
  Row,
  Col,
  Select,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { harvestApi, CreateHarvestDto, SubmitVerifyDto } from '../api';
import { HarvestRecord, HarvestStatus, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const HarvestCreatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [record, setRecord] = useState<HarvestRecord | null>(null);

  useEffect(() => {
    if (id) {
      setIsEdit(true);
      loadRecord();
    }
  }, [id, user]);

  const loadRecord = async () => {
    if (!id) return;
    try {
      const data = (await harvestApi.findById(id)) as HarvestRecord;
      setRecord(data);
      let materialsStr = '';
      if (data.materials) {
        try {
          const parsed = JSON.parse(data.materials);
          if (Array.isArray(parsed) && parsed.length > 0) {
            materialsStr = parsed.map((m: any) => m.url || m.name).join('\n');
          }
        } catch {
          materialsStr = data.materials;
        }
      }
      form.setFieldsValue({
        ...data,
        harvest_date: data.harvest_date ? dayjs(data.harvest_date) : null,
        materials: materialsStr,
      });
    } catch (e: any) {
      message.error('加载记录失败');
    }
  };

  const parseMaterials = (raw?: string) => {
    if (!raw || !raw.trim()) return '';
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return '';
    return JSON.stringify(
      lines.map((url, i) => ({
        type: 'photo',
        name: `采收凭证${i + 1}`,
        url,
      }))
    );
  };

  const handleSave = async (submitAfter: boolean) => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const dto: CreateHarvestDto = {
        batch_no: values.batch_no,
        crop_type: values.crop_type,
        crop_name: values.crop_name,
        harvest_date: values.harvest_date.format('YYYY-MM-DD'),
        harvest_area: values.harvest_area,
        estimated_weight: values.estimated_weight,
        field_location: values.field_location,
        planter: values.planter,
        materials: parseMaterials(values.materials),
      };

      let savedRecord: HarvestRecord;
      if (isEdit && id) {
        if (record) dto.version = record.version;
        savedRecord = (await harvestApi.update(id, dto)) as HarvestRecord;
        message.success('保存成功');
      } else {
        savedRecord = (await harvestApi.create(dto)) as HarvestRecord;
        message.success('创建成功');
      }

      if (submitAfter) {
        const submitDto: SubmitVerifyDto = { comment: '提交核验', version: savedRecord.version };
        await harvestApi.submit(savedRecord.id, submitDto);
        message.success('提交核验成功');
      }

      navigate(`/harvest/${savedRecord.id}`);
    } catch (e: any) {
      message.error(e.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== Role.FIELD_ADMIN) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          仅田间管理员可新增/编辑采收记录
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="header-bar">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/harvest')}>
            返回列表
          </Button>
          <h2>{isEdit ? '编辑采收记录' : '新增采收记录'}</h2>
          {record && (
            <Space>
              <span style={{ color: '#999' }}>版本号：{record.version}</span>
            </Space>
          )}
        </Space>
      </div>

      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 800, margin: '0 auto' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="batch_no"
                label="批次号"
                rules={[{ required: true, message: '请输入批次号' }]}
              >
                <Input placeholder="如 B202501001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="crop_type"
                label="作物类型"
                rules={[{ required: true, message: '请选择作物类型' }]}
              >
                <Select placeholder="请选择作物类型">
                  <Option value="蔬菜">蔬菜</Option>
                  <Option value="水果">水果</Option>
                  <Option value="粮食">粮食</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="crop_name"
                label="作物名称"
                rules={[{ required: true, message: '请输入作物名称' }]}
              >
                <Input placeholder="如 西红柿" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="harvest_date"
                label="采收日期"
                rules={[{ required: true, message: '请选择采收日期' }]}
              >
                <DatePicker style={{ width: '100%' }} disabledDate={(d) => d && d.isAfter(dayjs())} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="harvest_area"
                label="采收面积(亩)"
                rules={[{ required: true, message: '请输入采收面积' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="如 5.5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="estimated_weight"
                label="预估重量(kg)"
                rules={[{ required: true, message: '请输入预估重量' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="如 2500" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="field_location"
                label="田间位置"
                rules={[{ required: true, message: '请输入田间位置' }]}
              >
                <Input placeholder="如 A区3号棚" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="planter"
                label="种植户"
                rules={[{ required: true, message: '请输入种植户' }]}
              >
                <Input placeholder="如 李种植户" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="materials"
            label="采收凭证材料（每行一个链接）"
            help="提交核验前必须上传，可填写照片链接或描述，每行一个"
          >
            <TextArea
              rows={4}
              placeholder={'demo/photo1.jpg\ndemo/photo2.jpg'}
            />
          </Form.Item>

          {isEdit && record && (
            <Form.Item>
              <Space>
                <span style={{ color: '#999' }}>当前状态：</span>
                <span>{record.status === HarvestStatus.DRAFT ? '草稿' : record.status === HarvestStatus.PENDING_CORRECTION ? '待补正' : record.status}</span>
              </Space>
            </Form.Item>
          )}

          <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/harvest')}>取消</Button>
              <Button
                icon={<SaveOutlined />}
                loading={loading}
                onClick={() => handleSave(false)}
              >
                保存草稿
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={loading}
                onClick={() => handleSave(true)}
              >
                保存并提交核验
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default HarvestCreatePage;
