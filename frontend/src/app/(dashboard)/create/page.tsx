'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { orderApi } from '@/services/api';
import { useAuthStore } from '@/store';

export default function CreateOrderPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const result = await orderApi.create({
        ...values,
        department: user?.department || values.department,
      });
      message.success('整改单创建成功');
      router.push(`/orders/${result.id}`);
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          返回列表
        </Button>
      </Space>

      <Card title="新建病历整改单">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="patient_name"
                label="患者姓名"
                rules={[{ required: true, message: '请输入患者姓名' }]}
              >
                <Input placeholder="请输入患者姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="medical_record_no"
                label="病历号"
                rules={[{ required: true, message: '请输入病历号' }]}
              >
                <Input placeholder="请输入病历号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="department"
                label="科室"
                initialValue={user?.department}
                rules={[{ required: true, message: '请选择科室' }]}
              >
                <Input disabled={!!user?.department} placeholder="请输入科室" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="diagnosis"
                label="诊断"
              >
                <Input placeholder="请输入诊断" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content"
            label="病历存在问题"
            rules={[{ required: true, message: '请描述病历存在的问题' }]}
          >
            <Input.TextArea rows={4} placeholder="请详细描述病历存在的问题" />
          </Form.Item>

          <Form.Item
            name="rectification_requirements"
            label="整改要求"
            rules={[{ required: true, message: '请输入整改要求' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入具体的整改要求" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
                size="large"
              >
                创建整改单
              </Button>
              <Button onClick={() => router.back()} size="large">
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
