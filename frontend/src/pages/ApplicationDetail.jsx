import React, { useState, useEffect } from 'react'
import {
  Card, Descriptions, Tag, Button, Space, Form, Select, Input,
  message, Row, Col, Timeline, Table, Badge, Modal, Alert, Popconfirm, Tooltip
} from 'antd'
import {
  ArrowLeftOutlined, QrcodeOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined,
  SafetyOutlined, ClockCircleOutlined, UserOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { applicationAPI } from '../api'
import {
  STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, ACTION_LABELS,
  INSURANCE_TYPES, getMaterialsByType
} from '../utils/constants'
import dayjs from 'dayjs'
import ScanModal from '../components/ScanModal'
import ApplicationFormModal from '../components/ApplicationFormModal'

const { Option } = Select
const { TextArea } = Input

export default function ApplicationDetail({ user }) {
  const [app, setApp] = useState(null)
  const [history, setHistory] = useState({ scan_records: [], process_records: [] })
  const [loading, setLoading] = useState(false)
  const [processModalVisible, setProcessModalVisible] = useState(false)
  const [scanModalVisible, setScanModalVisible] = useState(false)
  const [formModalVisible, setFormModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [processing, setProcessing] = useState(false)

  const { id } = useParams()
  const navigate = useNavigate()

  const loadData = async () => {
    setLoading(true)
    try {
      const [appRes, historyRes] = await Promise.all([
        applicationAPI.get(id),
        applicationAPI.history(id),
      ])
      setApp(appRes.data)
      setHistory(historyRes.data)
    } catch (error) {
      message.error('加载详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  if (!app) return null

  const appData = app.data
  const availableActions = app.available_actions || []
  const timeLimitMet = app.time_limit_met
  const hoursLeft = app.hours_left
  const isLocked = app.is_locked

  const getDeadlineClass = () => {
    if (!timeLimitMet) return 'overdue'
    if (hoursLeft < 24) return 'warning'
    return 'normal'
  }

  const handleProcess = async (values) => {
    setProcessing(true)
    try {
      const res = await applicationAPI.process(id, {
        action: values.action,
        opinion: values.opinion,
        version: appData.version,
      })
      message.success('处理成功')
      setProcessModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error) {
      if (error.response?.status === 409) {
        const data = error.response.data
        Modal.error({
          title: '处理失败',
          content: (
            <div>
              <p>{data.error}</p>
              <p>您的版本: {data.your_version}，当前版本: {data.current_version}</p>
              <p>请刷新页面后重试</p>
            </div>
          ),
          onOk: () => loadData(),
        })
      } else {
        message.error(error.response?.data?.error || '处理失败')
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleScanSuccess = () => {
    setScanModalVisible(false)
    loadData()
  }

  const handleFormSuccess = () => {
    setFormModalVisible(false)
    loadData()
  }

  const getActionLabel = (action) => {
    return ACTION_LABELS[action] || action
  }

  const getActionType = (action) => {
    if (action === 'approve' || action === 'scan_pass') return 'primary'
    if (action === 'reject' || action === 'scan_fail') return 'danger'
    return 'default'
  }

  const canScan = user?.role === 'registrar' &&
    ['pending_scan', 'scan_failed'].includes(appData.status) &&
    !isLocked

  const canEdit = user?.role === 'registrar' &&
    ['pending_scan', 'revision_required', 'scan_failed'].includes(appData.status) &&
    !isLocked

  const canProcess = availableActions.length > 0 && !isLocked

  const materials = appData.materials ? JSON.parse(appData.materials) : getMaterialsByType(appData.insurance_type)

  const materialColumns = [
    { title: '材料名称', dataIndex: 'name', key: 'name' },
    { title: '必填', dataIndex: 'required', key: 'required', width: 80, render: v => v ? '是' : '否' },
    { title: '已提供', dataIndex: 'provided', key: 'provided', width: 100,
      render: v => v ? <Badge status="success" text="是" /> : <Badge status="error" text="否" /> },
    { title: '已核验', dataIndex: 'verified', key: 'verified', width: 100,
      render: v => v ? <Badge status="success" text="是" /> : <Badge status="default" text="否" /> },
    { title: '备注', dataIndex: 'notes', key: 'notes' },
  ]

  const allEvents = [
    ...history.scan_records.map(r => ({
      time: dayjs(r.scan_time).format('YYYY-MM-DD HH:mm:ss'),
      color: r.result === 'success' ? 'green' : 'red',
      content: (
        <div className="timeline-content">
          <div><strong>扫码核验 - {r.result === 'success' ? '通过' : '失败'}</strong></div>
          <div>操作人：{r.scanner_name}（{ROLE_LABELS[r.scanner_role]}）</div>
          <div>扫码内容：{r.qr_code}</div>
          {r.failure_reason && <div>失败原因：{r.failure_reason}</div>}
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            凭证：{r.evidence?.substring(0, 32)}...
          </div>
        </div>
      )
    })),
    ...history.process_records.map(r => ({
      time: dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss'),
      color: ['approve', 'scan_pass'].includes(r.action) ? 'green' :
             ['reject', 'scan_fail'].includes(r.action) ? 'red' : 'blue',
      content: (
        <div className="timeline-content">
          <div><strong>{getActionLabel(r.action)}</strong></div>
          <div>操作人：{r.handler_name}（{ROLE_LABELS[r.handler_role]}）</div>
          <div>状态流转：{STATUS_LABELS[r.from_status]} → {STATUS_LABELS[r.to_status]}</div>
          <div>处理意见：{r.opinion}</div>
          {r.processing_time_seconds > 0 && (
            <div>处理耗时：{r.processing_time_seconds}秒</div>
          )}
          {!r.time_limit_met && (
            <div style={{ color: '#ff4d4f' }}>⚠ 超时处理</div>
          )}
        </div>
      )
    }))
  ].sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/applications')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>投保申请详情</h2>
          <Tag color={STATUS_COLORS[appData.status]}>{STATUS_LABELS[appData.status]}</Tag>
          {isLocked && <Badge status="processing" text="正在被处理中" />}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={() => setFormModalVisible(true)}>
              编辑
            </Button>
          )}
          {canScan && (
            <Button type="primary" icon={<QrcodeOutlined />} onClick={() => setScanModalVisible(true)}>
              扫码核验
            </Button>
          )}
          {canProcess && (
            <Button type="primary" onClick={() => setProcessModalVisible(true)}>
              处理申请
            </Button>
          )}
        </Space>
      </div>

      {isLocked && (
        <Alert
          showIcon
          type="warning"
          message="该申请正在被其他用户处理，请稍后再操作或刷新页面查看最新状态"
          style={{ marginBottom: 16 }}
        />
      )}

      {!timeLimitMet && (
        <Alert
          showIcon
          type="error"
          message="该申请已超过办理时限！"
          description={`截止时间：${dayjs(appData.deadline).format('YYYY-MM-DD HH:mm')}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="基本信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号">{appData.application_no}</Descriptions.Item>
              <Descriptions.Item label="绑定二维码"><code>{appData.qr_code}</code></Descriptions.Item>
              <Descriptions.Item label="投保人">{appData.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{appData.applicant_id_card}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{appData.applicant_phone}</Descriptions.Item>
              <Descriptions.Item label="险种">{appData.insurance_type}</Descriptions.Item>
              <Descriptions.Item label="保险金额">¥{appData.insurance_amount.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="保费">¥{appData.premium.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={STATUS_COLORS[appData.status]}>{STATUS_LABELS[appData.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="版本号">v{appData.version}</Descriptions.Item>
              <Descriptions.Item label="当前处理人">
                <Space>
                  <UserOutlined /> {appData.current_handler_name || '待认领'}
                  <Tag>{ROLE_LABELS[appData.current_handler_role] || '-'}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="办理时限">
                <span className={getDeadlineClass()}>
                  <ClockCircleOutlined /> {dayjs(appData.deadline).format('YYYY-MM-DD HH:mm')}
                  {!timeLimitMet && ' (已逾期)'}
                  {timeLimitMet && hoursLeft < 24 && ` (剩余${hoursLeft}小时)`}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(appData.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="最近处理时间">
                {appData.last_processed_at ? dayjs(appData.last_processed_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              {appData.exception_reason && (
                <Descriptions.Item label="异常原因" span={2} style={{ color: '#ff4d4f' }}>
                  {appData.exception_reason}
                </Descriptions.Item>
              )}
              {appData.last_process_result && (
                <Descriptions.Item label="最近处理结果" span={2}>
                  <Space>
                    {appData.last_processed_by_name && (
                      <Tag>处理人：{appData.last_processed_by_name}</Tag>
                    )}
                    {appData.last_process_result}
                  </Space>
                </Descriptions.Item>
              )}
              {appData.notes && (
                <Descriptions.Item label="备注" span={2}>{appData.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="投保材料清单" style={{ marginBottom: 16 }}>
            <Table
              className="material-table"
              columns={materialColumns}
              dataSource={materials}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="流转历史" style={{ marginBottom: 16 }} bodyStyle={{ maxHeight: 600, overflowY: 'auto' }}>
            {allEvents.length > 0 ? (
              <Timeline
                mode="left"
                items={allEvents.map(event => ({
                  color: event.color,
                  label: event.time,
                  children: event.content,
                }))}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                暂无流转记录
              </div>
            )}
          </Card>

          {history.scan_records.length > 0 && (
            <Card title="扫码核验记录" bodyStyle={{ maxHeight: 300, overflowY: 'auto' }}>
              {history.scan_records.map((record, idx) => (
                <div key={idx} style={{
                  padding: 12,
                  background: record.result === 'success' ? '#f6ffed' : '#fff2f0',
                  borderRadius: 4,
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>
                      {record.result === 'success' ?
                        <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      }
                      <strong style={{ marginLeft: 4 }}>
                        {record.result === 'success' ? '核验通过' : '核验失败'}
                      </strong>
                    </span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {dayjs(record.scan_time).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <div>扫码人：{record.scanner_name}</div>
                    <div>扫码内容：{record.qr_code}</div>
                    {record.failure_reason && (
                      <div style={{ color: '#ff4d4f' }}>原因：{record.failure_reason}</div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <SafetyOutlined /> 核验凭证：
                      <span className="scan-evidence" style={{ marginTop: 4 }}>{record.evidence}</span>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="处理投保申请"
        open={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleProcess}
        >
          <Alert
            showIcon
            type="info"
            message={`当前状态：${STATUS_LABELS[appData.status]}`}
            description="请选择处理动作并填写处理意见"
            style={{ marginBottom: 20 }}
          />

          <Form.Item
            name="action"
            label="处理动作"
            rules={[{ required: true, message: '请选择处理动作' }]}
          >
            <Select placeholder="请选择处理动作">
              {availableActions.map(action => (
                <Option key={action} value={action}>
                  {getActionLabel(action)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="opinion"
            label="处理意见"
            rules={[{ required: true, message: '请填写处理意见' }]}
          >
            <TextArea rows={4} placeholder="请详细填写处理意见，将记录到审计日志中" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={processing}>
                确认处理
              </Button>
              <Button onClick={() => setProcessModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {scanModalVisible && (
        <ScanModal
          visible={scanModalVisible}
          app={appData}
          onCancel={() => setScanModalVisible(false)}
          onSuccess={handleScanSuccess}
          user={user}
        />
      )}

      {formModalVisible && (
        <ApplicationFormModal
          visible={formModalVisible}
          app={appData}
          onCancel={() => setFormModalVisible(false)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
