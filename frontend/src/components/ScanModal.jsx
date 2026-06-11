import React, { useState, useMemo } from 'react'
import { Modal, Form, Input, Button, message, Space, Alert, Tag, Divider, Descriptions } from 'antd'
import {
  QrcodeOutlined, SafetyOutlined, WarningOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined,
  ClockCircleOutlined, LockOutlined, CopyOutlined
} from '@ant-design/icons'
import { applicationAPI } from '../api'
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '../utils/constants'
import dayjs from 'dayjs'

export default function ScanModal({ visible, app, onCancel, onSuccess, user }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)

  const handlerMismatch = useMemo(() => {
    if (!app || !user) return { mismatch: false, expected: null, expectedId: null }
    const expected = app.current_handler_name || '待认领'
    const expectedId = app.current_handler_id
    const mismatch = expectedId && expectedId !== user.id
    return { mismatch, expected, expectedId }
  }, [app, user])

  const handleScan = async (values) => {
    if (!app) return

    if (!values.qr_code || values.qr_code.trim() === '') {
      message.warning('请输入扫码内容')
      return
    }

    if (handlerMismatch.mismatch) {
      const proceed = await new Promise((resolve) => {
        Modal.confirm({
          title: '扫码人与登记责任人不匹配',
          content: (
            <div>
              <p>确认要继续提交扫码核验吗？</p>
              <Divider style={{ margin: '8px 0' }} />
              <p>登记责任人：<Tag color="blue">{handlerMismatch.expected}</Tag>（ID: {handlerMismatch.expectedId}）</p>
              <p>您的账号：<Tag color="orange">{user?.name}</Tag>（ID: {user?.id}）</p>
              <Divider style={{ margin: '8px 0' }} />
              <p style={{ color: '#faad14' }}>
                <WarningOutlined /> 继续扫码将记录您的操作，但会标记"扫码人不匹配"并停在原队列，不会推进申请流转。
              </p>
            </div>
          ),
          okText: '继续扫码（记录并停留）',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!proceed) return
    }

    setLoading(true)
    setScanResult(null)
    try {
      const res = await applicationAPI.scan(app.id, {
        qr_code: values.qr_code.trim(),
        device_info: navigator.userAgent,
        location_info: '本地演示环境',
      })
      const data = res.data
      setScanResult(data)

      if (data.success) {
        message.success(data.message)
        setTimeout(() => onSuccess && onSuccess(), 1200)
      } else {
        if (data.stay_in_place) {
          message.warning({
            content: (
              <span>
                <WarningOutlined /> {data.message}
                <span style={{ marginLeft: 8, color: '#999' }}>（已停在原队列）</span>
              </span>
            ),
            duration: 5,
          })
        } else {
          message.warning(data.message)
        }
      }
    } catch (error) {
      if (error.response?.status === 409) {
        Modal.error({
          title: '处理冲突',
          content: `${error.response.data?.error || '该申请正在被处理，请稍后再试'}`,
        })
      } else if (error.response?.status === 403) {
        Modal.error({
          title: '越权操作',
          content: error.response.data?.error || '只有投保登记员可以执行扫码核验',
        })
      } else {
        message.error(error.response?.data?.error || '扫码核验失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleQuickScan = () => {
    form.setFieldsValue({ qr_code: app?.qr_code })
    form.submit()
  }

  const handleTestInvalid = () => {
    form.setFieldsValue({ qr_code: 'INVALID-QR-CODE-123456' })
    form.submit()
  }

  const handleTestDuplicate = () => {
    if (!app) return
    Modal.confirm({
      title: '演示说明',
      content: '重复扫码测试：使用正确的二维码连续扫码两次，第二次将触发"重复扫码"规则并停留在原状态。请先扫码成功后再扫一次。',
      okText: '填入正确码',
      cancelText: '取消',
      onOk: () => {
        form.setFieldsValue({ qr_code: app.qr_code })
        message.info('已填入正确码，点击"确认扫码核验"')
      },
    })
  }

  if (!app) return null

  return (
    <Modal
      title={
        <Space>
          <QrcodeOutlined style={{ color: '#1890ff', fontSize: 18 }} />
          <span>现场扫码核验投保申请</span>
        </Space>
      }
      open={visible}
      onCancel={() => {
        setScanResult(null)
        onCancel && onCancel()
      }}
      footer={null}
      width={680}
      destroyOnClose
    >
      <Alert
        showIcon
        type={handlerMismatch.mismatch ? 'error' : 'info'}
        style={{ marginBottom: 16 }}
        message={
          <Space wrap>
            <span>申请编号：<strong>{app.application_no}</strong></span>
            <span>投保人：<strong>{app.applicant_name}</strong></span>
            <Tag color={STATUS_COLORS[app.status]} style={{ margin: 0 }}>
              {STATUS_LABELS[app.status]}
            </Tag>
            {app.version > 1 && <Tag color="purple">v{app.version}</Tag>}
          </Space>
        }
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <QrcodeOutlined style={{ color: '#1890ff' }} />
              <span>绑定二维码：
                <code style={{
                  background: '#f0f5ff',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#1890ff',
                  marginLeft: 4,
                  fontWeight: 600,
                }}>
                  {app.qr_code}
                </code>
              </span>
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined />}
                style={{ padding: 0, height: 'auto' }}
                onClick={() => {
                  navigator.clipboard?.writeText(app.qr_code)
                  message.success('已复制二维码')
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ color: handlerMismatch.mismatch ? '#ff4d4f' : '#52c41a' }} />
              <span>登记责任人：
                <Tag color={handlerMismatch.mismatch ? 'red' : 'blue'} style={{ marginLeft: 4 }}>
                  {app.current_handler_name || '待认领'}
                </Tag>
                <span style={{ marginLeft: 4, color: '#999' }}>
                  ({ROLE_LABELS[app.current_handler_role] || '-'})
                </span>
              </span>
              {handlerMismatch.mismatch && (
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                  <WarningOutlined /> 与您不匹配！您是：{user?.name}
                </span>
              )}
              {!handlerMismatch.mismatch && (
                <span style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined /> 与您匹配，可正常扫码
                </span>
              )}
            </div>
            <div>
              <SafetyOutlined />
              <span style={{ marginLeft: 4, color: '#666' }}>
                请扫描投保资料上的二维码进行核验，确保投保资料与申请信息一致。
                核验通过后自动流转至下一环节，不通过则停在原队列。
              </span>
            </div>
          </Space>
        }
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleScan}
        preserve={false}
      >
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="险种">{app.insurance_type}</Descriptions.Item>
          <Descriptions.Item label="保额">¥{Number(app.insurance_amount || 0).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="办理时限">
            <Space>
              <ClockCircleOutlined />
              <span>{dayjs(app.deadline).format('YYYY-MM-DD HH:mm')}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(app.created_at).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          {app.exception_reason && (
            <Descriptions.Item label="上次异常原因" span={2}>
              <span style={{ color: '#ff4d4f' }}>
                <WarningOutlined /> {app.exception_reason}
              </span>
            </Descriptions.Item>
          )}
          {app.last_process_result && (
            <Descriptions.Item label="最近处理结果" span={2}>
              <Space>
                {app.last_processed_by_name && (
                  <Tag>{app.last_processed_by_name}</Tag>
                )}
                <span>{app.last_process_result}</span>
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Form.Item
          name="qr_code"
          label={
            <Space>
              <span>扫码内容（或手动输入二维码编号）</span>
              {handlerMismatch.mismatch && (
                <Tag color="red">责任人不匹配，仍将记录但停留原状态</Tag>
              )}
            </Space>
          }
          rules={[{ required: true, message: '请输入扫码内容' }]}
          extra={
            <Space wrap size={8} style={{ marginTop: 4 }}>
              <span style={{ color: '#999' }}>演示按钮：</span>
              <Button size="small" type="link" onClick={handleQuickScan} disabled={loading}>
                ✓ 填入正确码
              </Button>
              <Button size="small" type="link" onClick={handleTestInvalid} disabled={loading} danger>
                ✗ 填入无效码（测试）
              </Button>
              <Button size="small" type="link" onClick={handleTestDuplicate} disabled={loading}>
                🔄 模拟重复扫码
              </Button>
            </Space>
          }
        >
          <Input
            placeholder="请扫描二维码或手动输入二维码编号，例如 QR-INS-2024-xxxxx"
            size="large"
            prefix={<QrcodeOutlined />}
            allowClear
          />
        </Form.Item>

        {scanResult && (
          <div style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 8,
            background: scanResult.success ? '#f6ffed' : scanResult.stay_in_place ? '#fffbe6' : '#fff2f0',
            border: `1px solid ${scanResult.success ? '#b7eb8f' : scanResult.stay_in_place ? '#ffe58f' : '#ffa39e'}`,
          }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space>
                {scanResult.success ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                )}
                <strong style={{ fontSize: 16 }}>
                  {scanResult.success ? '核验成功 ✓' : scanResult.stay_in_place ? '核验不通过（停在原队列）' : '核验失败'}
                </strong>
                <Tag color={scanResult.success ? 'green' : scanResult.stay_in_place ? 'orange' : 'red'}>
                  结果：{scanResult.result}
                </Tag>
              </Space>

              <div style={{ paddingLeft: 28 }}>
                <p style={{ margin: '4px 0' }}><strong>说明：</strong>{scanResult.message}</p>
              </div>

              <Descriptions column={2} size="small" style={{ marginLeft: 28 }}>
                <Descriptions.Item label="二维码匹配">
                  {scanResult.qr_matched ? (
                    <span style={{ color: '#52c41a' }}>✓ 匹配</span>
                  ) : (
                    <span style={{ color: '#ff4d4f' }}>✗ 不匹配</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="扫码人匹配">
                  {scanResult.handler_matched ? (
                    <span style={{ color: '#52c41a' }}>✓ 匹配</span>
                  ) : (
                    <span style={{ color: '#ff4d4f' }}>
                      ✗ 不匹配
                      {scanResult.expected_handler && (
                        <span style={{ marginLeft: 4 }}>
                          （应为：{scanResult.expected_handler}）
                        </span>
                      )}
                    </span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="是否重复扫码">
                  {scanResult.is_duplicate ? (
                    <span style={{ color: '#faad14' }}>✓ 重复</span>
                  ) : (
                    <span style={{ color: '#52c41a' }}>否</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="是否停留原状态">
                  {scanResult.stay_in_place ? (
                    <Tag color="orange"><LockOutlined /> 是</Tag>
                  ) : (
                    <Tag color="green">已推进</Tag>
                  )}
                </Descriptions.Item>
                {scanResult.status_before && scanResult.status_after && (
                  <>
                    <Descriptions.Item label="扫码前状态">
                      <Tag color={STATUS_COLORS[scanResult.status_before]}>
                        {STATUS_LABELS[scanResult.status_before]}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="扫码后状态">
                      <Tag color={STATUS_COLORS[scanResult.status_after]}>
                        {STATUS_LABELS[scanResult.status_after]}
                        {scanResult.stay_in_place && (
                          <LockOutlined style={{ marginLeft: 4, fontSize: 10 }} />
                        )}
                      </Tag>
                      {scanResult.stay_in_place && scanResult.status_before === scanResult.status_after && (
                        <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>
                          状态未变化
                        </span>
                      )}
                    </Descriptions.Item>
                  </>
                )}
                {scanResult.evidence && (
                  <Descriptions.Item label="核验凭证（SHA256）" span={2}>
                    <Space direction="vertical" size={4}>
                      <SafetyOutlined style={{ color: '#1890ff' }} />
                      <code style={{
                        background: '#f0f5ff',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                        color: '#1890ff',
                      }}>
                        {scanResult.evidence}
                      </code>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, height: 'auto' }}
                        onClick={() => {
                          navigator.clipboard?.writeText(scanResult.evidence)
                          message.success('凭证已复制到剪贴板')
                        }}
                      >
                        <CopyOutlined /> 点击复制完整凭证
                      </Button>
                    </Space>
                  </Descriptions.Item>
                )}
                {scanResult.record_id && (
                  <Descriptions.Item label="记录ID">
                    #{scanResult.record_id}
                  </Descriptions.Item>
                )}
                {scanResult.current_status && (
                  <Descriptions.Item label="当前状态">
                    <Tag color={STATUS_COLORS[scanResult.current_status]}>
                      {STATUS_LABELS[scanResult.current_status]}
                    </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {scanResult.next_action && (
                <div style={{
                  paddingLeft: 28,
                  paddingTop: 8,
                  borderTop: '1px dashed #e8e8e8',
                }}>
                  <span style={{ color: '#1890ff' }}>➤ 下一步：{scanResult.next_action}</span>
                </div>
              )}
            </Space>
          </div>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space size={8}>
            <Button onClick={() => {
              setScanResult(null)
              onCancel && onCancel()
            }}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SafetyOutlined />}
              size="large"
              danger={handlerMismatch.mismatch}
            >
              {handlerMismatch.mismatch ? '继续扫码核验（将记录并停留原状态）' : '确认扫码核验（将记录凭证和审计）'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
