import React, { useState } from 'react'
import { Modal, Form, Input, Button, message, Space, Alert, Tag } from 'antd'
import { QrcodeOutlined, SafetyOutlined } from '@ant-design/icons'
import { applicationAPI } from '../api'
import { STATUS_LABELS, STATUS_COLORS } from '../utils/constants'

export default function ScanModal({ visible, app, onCancel, onSuccess, user }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)

  const handleScan = async (values) => {
    setLoading(true)
    try {
      const res = await applicationAPI.scan(app.id, {
        qr_code: values.qr_code,
        device_info: navigator.userAgent,
        location_info: '本地演示环境',
      })
      const data = res.data
      setScanResult(data)

      if (data.success) {
        message.success(data.message)
        setTimeout(() => onSuccess(), 1000)
      } else {
        message.warning(data.message)
      }
    } catch (error) {
      message.error(error.response?.data?.error || '扫码失败')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickScan = () => {
    form.setFieldsValue({ qr_code: app?.qr_code })
    form.submit()
  }

  return (
    <Modal
      title={
        <Space>
          <QrcodeOutlined /> 扫码核验投保申请
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      {app && (
        <div style={{ marginBottom: 20 }}>
          <Alert
            showIcon
            type="info"
            message={
              <Space>
                <span>申请编号：{app.application_no}</span>
                <span>投保人：{app.applicant_name}</span>
                <Tag color={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Tag>
              </Space>
            }
            description={
              <div>
                <div>绑定二维码：<code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{app.qr_code}</code></div>
                <div style={{ marginTop: 8, color: '#666' }}>
                  <SafetyOutlined /> 请扫描投保资料上的二维码进行核验，确保投保资料与申请信息一致
                </div>
              </div>
            }
          />
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleScan}
      >
        <Form.Item
          name="qr_code"
          label="扫码内容（或手动输入二维码编号）"
          rules={[{ required: true, message: '请输入扫码内容' }]}
        >
          <Input
            placeholder="请扫描二维码或手动输入二维码编号"
            size="large"
            prefix={<QrcodeOutlined />}
          />
        </Form.Item>

        {scanResult && (
          <div style={{ marginBottom: 16, padding: 12, background: scanResult.success ? '#f6ffed' : '#fff2f0', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              {scanResult.success ? '核验成功' : '核验失败'}：{scanResult.message}
            </div>
            {scanResult.record_id && (
              <div style={{ fontSize: 12, color: '#666' }}>
                核验凭证：<span className="scan-evidence">{scanResult.record_id}</span>
              </div>
            )}
            {scanResult.next_action && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                下一步：{scanResult.next_action}
              </div>
            )}
          </div>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认扫码核验
            </Button>
            <Button onClick={handleQuickScan} disabled={loading}>
              快速填入正确码（演示用）
            </Button>
            <Button onClick={onCancel}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
