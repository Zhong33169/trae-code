import React, { useState, useMemo } from 'react'
import { Modal, Form, Select, Input, Button, message, Space, Alert, Tag, Descriptions, Divider } from 'antd'
import { AppstoreOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons'
import { applicationAPI } from '../api'
import { STATUS_LABELS, STATUS_COLORS, ACTION_LABELS } from '../utils/constants'

const { Option } = Select
const { TextArea } = Input

export default function BatchProcessModal({
  visible, selectedIds, selectedVersions, selectedStatus,
  availableActions, onCancel, onSuccess, user
}) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  const versionCheck = useMemo(() => {
    if (!selectedVersions || selectedVersions.length === 0) return { allNew: true, maxVersion: 0 }
    return {
      allNew: selectedVersions.every(v => v === 1),
      maxVersion: Math.max(...selectedVersions),
      minVersion: Math.min(...selectedVersions),
    }
  }, [selectedVersions])

  const handleSubmit = async (values) => {
    if (selectedIds.length === 0) {
      message.warning('请至少选择一条申请')
      return
    }
    if (!selectedStatus) {
      message.warning('选择状态异常，请刷新后重试')
      return
    }

    setLoading(true)
    setResults(null)
    try {
      const payload = {
        ids: selectedIds,
        versions: selectedVersions || [],
        action: values.action,
        opinion: values.opinion,
      }
      const res = await applicationAPI.batchProcess(payload)
      const data = res.data
      setResults(data)

      if (data.fail_count > 0) {
        const failItems = data.results?.filter(r => !r.success) || []
        const failReasons = failItems.slice(0, 5).map(r => `${r.application_no || `ID:${r.id}`}: ${r.error}`).join('\n')
        Modal.warning({
          title: `批量处理完成（部分失败）`,
          content: (
            <div>
              <p>成功：<strong style={{ color: '#52c41a' }}>{data.success_count} 条</strong>，失败：<strong style={{ color: '#ff4d4f' }}>{data.fail_count} 条</strong></p>
              {failReasons && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <p style={{ marginBottom: 4 }}>失败详情（前5条）：</p>
                  <pre style={{
                    background: '#fff2f0',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    margin: 0,
                  }}>
                    {failReasons}
                  </pre>
                </>
              )}
            </div>
          ),
        })
        setTimeout(() => onSuccess && onSuccess(), 1500)
      } else {
        Modal.success({
          title: '批量处理成功',
          content: (
            <div>
              <p>已成功处理 <strong style={{ color: '#52c41a' }}>{data.success_count} 条</strong> 投保申请</p>
              {data.results?.[0]?.new_status && (
                <p>流转至：<Tag color={STATUS_COLORS[data.results[0].new_status]}>
                  {STATUS_LABELS[data.results[0].new_status]}
                </Tag></p>
              )}
              <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
                <SafetyCertificateOutlined /> 所有操作已记录审计日志
              </p>
            </div>
          ),
          onOk: () => onSuccess && onSuccess(),
        })
      }
    } catch (error) {
      if (error.response?.status === 409) {
        Modal.error({
          title: '并发冲突',
          content: `处理失败：${error.response.data?.error || '数据版本不匹配，请刷新页面后重试'}`,
        })
      } else if (error.response?.status === 403) {
        Modal.error({
          title: '越权操作',
          content: `无权执行此操作：${error.response.data?.error || '请联系管理员'}`,
        })
      } else if (error.response?.status === 400) {
        message.error(error.response.data?.error || '请求参数错误')
      } else {
        message.error('批量处理失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <AppstoreOutlined /> 批量办理投保申请
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={560}
      destroyOnClose
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message={
          <Space wrap>
            <span>已选择：<strong>{selectedIds.length}</strong> 条申请</span>
            {selectedStatus && (
              <span>当前状态：
                <Tag color={STATUS_COLORS[selectedStatus]} style={{ marginLeft: 4 }}>
                  {STATUS_LABELS[selectedStatus]}
                </Tag>
              </span>
            )}
            {versionCheck.maxVersion > 1 && (
              <span style={{ color: '#faad14' }}>
                <WarningOutlined /> 含已修改数据（v{versionCheck.minVersion} ~ v{versionCheck.maxVersion}）
              </span>
            )}
          </Space>
        }
        description="所有选中申请将按相同规则流转，请确保处理意见适用"
      />

      <Descriptions column={2} size="small" style={{ marginBottom: 16 }} bordered>
        <Descriptions.Item label="处理人">
          {user?.name}（{user?.role === 'registrar' ? '投保登记员' : user?.role === 'supervisor' ? '审核主管' : '复核负责人'}）
        </Descriptions.Item>
        <Descriptions.Item label="并发控制">
          <span style={{ color: '#52c41a' }}>✓ 已接入版本号校验</span>
        </Descriptions.Item>
        <Descriptions.Item label="状态约束">
          <span style={{ color: '#52c41a' }}>✓ 同状态批量</span>
        </Descriptions.Item>
        <Descriptions.Item label="审计记录">
          <span style={{ color: '#52c41a' }}>✓ 全部留痕</span>
        </Descriptions.Item>
      </Descriptions>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
      >
        <Form.Item
          name="action"
          label="处理动作"
          rules={[{ required: true, message: '请选择处理动作' }]}
          extra={availableActions.length === 0 ? '当前岗位在该状态下暂无批量动作' : ''}
        >
          <Select
            placeholder={`请选择对 ${STATUS_LABELS[selectedStatus] || '当前状态'} 申请的处理动作`}
            disabled={availableActions.length === 0}
          >
            {availableActions.map(action => (
              <Option key={action.value} value={action.value}>{action.label}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="opinion"
          label="处理意见"
          rules={[
            { required: true, message: '请填写处理意见' },
            { min: 5, message: '处理意见至少5个字，便于后续审计追溯' },
          ]}
          extra="此意见将记录到所有选中申请的处理记录和审计日志中"
        >
          <TextArea
            rows={5}
            placeholder={`请详细填写对这 ${selectedIds.length} 条 ${STATUS_LABELS[selectedStatus] || ''} 申请的处理意见，便于后续审计和追溯...`}
          />
        </Form.Item>

        {results && (
          <div style={{
            marginBottom: 16,
            padding: 12,
            background: '#f5f5f5',
            borderRadius: 4,
            maxHeight: 220,
            overflowY: 'auto',
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
              处理结果（成功 {results.success_count} / 失败 {results.fail_count}）：
            </div>
            {results.results?.map((r, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: 12,
                  padding: '4px 0',
                  borderBottom: idx < results.results.length - 1 ? '1px dashed #e8e8e8' : 'none',
                }}
              >
                <span style={{ color: r.success ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
                  {r.success ? '✓' : '✗'}
                </span>
                {' '}
                <code>{r.application_no || `ID:${r.id}`}</code>
                {r.success ? (
                  <span style={{ color: '#666', marginLeft: 8 }}>
                    → {STATUS_LABELS[r.new_status] || '处理成功'}
                    {r.new_version && <Tag color="purple" style={{ marginLeft: 4 }}>v{r.new_version}</Tag>}
                  </span>
                ) : (
                  <span style={{ color: '#ff4d4f', marginLeft: 8 }}>
                    失败 - {r.error}
                    {r.your_version && r.current_version && (
                      <span style={{ color: '#faad14', marginLeft: 8 }}>
                        （版本v{r.your_version} → v{r.current_version}）
                      </span>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              setResults(null)
              onCancel && onCancel()
            }}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={availableActions.length === 0}
              danger={availableActions.some(a => a.value === 'reject' || a.value === 'request_revise')}
            >
              <SafetyCertificateOutlined /> 确认批量办理（共 {selectedIds.length} 条）
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
