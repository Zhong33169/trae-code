import React, { useState } from 'react'
import { Modal, Form, Select, Input, Button, message, Space, Alert } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import { applicationAPI } from '../api'

const { Option } = Select
const { TextArea } = Input

export default function BatchProcessModal({ visible, selectedIds, availableActions, onCancel, onSuccess, user }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  const handleSubmit = async (values) => {
    setLoading(true)
    try {
      const res = await applicationAPI.batchProcess({
        ids: selectedIds,
        action: values.action,
        opinion: values.opinion,
      })
      const data = res.data
      setResults(data)

      if (data.fail_count > 0) {
        message.warning(`批量处理完成：成功 ${data.success_count} 条，失败 ${data.fail_count} 条`)
      } else {
        message.success(`批量处理成功：${data.success_count} 条`)
        setTimeout(() => onSuccess(), 1000)
      }
    } catch (error) {
      message.error(error.response?.data?.error || '批量处理失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <AppstoreOutlined /> 批量处理
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Alert
        showIcon
        type="info"
        message={`已选择 ${selectedIds.length} 条投保申请`}
        description="请选择处理动作并填写处理意见，所选申请将按相同规则处理"
        style={{ marginBottom: 20 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Form.Item
          name="action"
          label="处理动作"
          rules={[{ required: true, message: '请选择处理动作' }]}
        >
          <Select placeholder="请选择处理动作">
            {availableActions.map(action => (
              <Option key={action.value} value={action.value}>{action.label}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="opinion"
          label="处理意见"
          rules={[{ required: true, message: '请填写处理意见' }]}
        >
          <TextArea
          rows={4}
          placeholder="请填写处理意见，将应用到所有选中的申请"
        />
        </Form.Item>

        {results && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>处理结果：</div>
          {results.results?.map((r, idx) => (
            <div key={idx} style={{ fontSize: 12, color: r.success ? '#52c41a' : '#ff4d4f' }}>
              {r.application_no || `ID:${r.id}`}: {r.success ? `成功 → ${r.new_status || ''}` : `失败 - ${r.error}`}
            </div>
          ))}
        </div>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认批量处理
            </Button>
            <Button onClick={onCancel}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
