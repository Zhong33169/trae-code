import React, { useState, useEffect, useMemo } from 'react'
import {
  Card, Descriptions, Tag, Button, Space, Form, Select, Input,
  message, Row, Col, Timeline, Table, Badge, Modal, Alert, Popconfirm, Tooltip, Divider
} from 'antd'
import {
  ArrowLeftOutlined, QrcodeOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined,
  SafetyOutlined, ClockCircleOutlined, UserOutlined,
  LockOutlined, WarningOutlined, EyeOutlined, SafetyCertificateOutlined,
  TeamOutlined, CopyOutlined
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
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false)
  const [currentEvidence, setCurrentEvidence] = useState(null)
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
  const lockedBy = app.locked_by || null
  const isHandler = app.is_handler
  const canScan = app.can_scan
  const canEdit = app.can_edit
  const expectedHandler = app.expected_handler_name || (lockedBy?.name)
  const lastScanRecord = app.last_scan_record
  const scanEvidenceShort = app.scan_evidence_short
  const currentUserID = app.current_user_id

  const handlerMismatch = useMemo(() => {
    if (!appData || !user) return { mismatch: false, expected: null, reason: '' }
    const expected = appData.current_handler_name || '待认领'
    const expectedID = appData.current_handler_id
    const isMismatch = expectedID && expectedID !== user.id
    let reason = ''
    if (isMismatch) {
      reason = `您（${user.name}，ID:${user.id}）不是当前登记责任人（${expected}，ID:${expectedID}）`
    }
    return { mismatch: isMismatch, expected, expectedID, reason }
  }, [appData, user])

  const getDeadlineClass = () => {
    if (!timeLimitMet) return 'overdue'
    if (hoursLeft < 24) return 'warning'
    return 'normal'
  }

  const handleProcess = async (values) => {
    if (handlerMismatch.mismatch) {
      const proceed = await new Promise((resolve) => {
        Modal.confirm({
          title: '处理人与登记责任人不匹配',
          content: (
            <div>
              <p>您不是当前登记责任人，确认要继续提交吗？</p>
              <Divider style={{ margin: '8px 0' }} />
              <p>登记责任人：<Tag color="blue">{handlerMismatch.expected}</Tag>（ID: {handlerMismatch.expectedId}）</p>
              <p>您的账号：<Tag color="orange">{user?.name}</Tag>（ID: {user?.id}）</p>
              <Divider style={{ margin: '8px 0' }} />
              <p style={{ color: '#faad14' }}>
                <WarningOutlined /> 后端将拦截此操作，申请不会推进。
              </p>
            </div>
          ),
          okText: '继续提交',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!proceed) return
    }
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
              <p>您的版本: v{data.your_version}，当前版本: v{data.current_version}</p>
              <p>请刷新页面后重试</p>
            </div>
          ),
          onOk: () => loadData(),
        })
      } else if (error.response?.status === 403) {
        const data = error.response.data || {}
        Modal.error({
          title: data.expected_handler_id ? '责任人不匹配，操作被拦截' : '越权操作',
          content: (
            <div>
              <p>{data.error || '无权执行此操作'}</p>
              {data.expected_handler_id && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <p>登记责任人：<Tag color="blue">{data.expected_handler_name}</Tag>（ID: {data.expected_handler_id}）</p>
                  <p>当前操作人：<Tag color="orange">{data.current_user_name}</Tag>（ID: {data.current_user_id}）</p>
                  <p style={{ color: '#999', marginTop: 8 }}>请由登记责任人操作，或联系管理员变更责任人。</p>
                </>
              )}
            </div>
          ),
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
      color: r.result === 'success' ? 'green' :
             (r.result === 'duplicate' || r.result === 'handler_mismatch' || r.result === 'materials_missing')
             ? 'orange' : 'red',
      content: (
        <div className="timeline-content">
          <div style={{ marginBottom: 4 }}>
            <strong>扫码核验 - {
              r.result === 'success' ? '通过' :
              r.result === 'invalid_qr' ? '无效二维码' :
              r.result === 'duplicate' ? '重复扫码' :
              r.result === 'handler_mismatch' ? '处理人不匹配' :
              r.result === 'materials_missing' ? '材料缺失' : r.result
            }</strong>
            {r.stay_in_place && (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                <LockOutlined /> 停留原状态
              </Tag>
            )}
            {r.status_before && r.status_after && r.status_before !== r.status_after && (
              <Tag color="green" style={{ marginLeft: 4 }}>
                状态推进：{STATUS_LABELS[r.status_before]} → {STATUS_LABELS[r.status_after]}
              </Tag>
            )}
            {r.status_before && r.status_after && r.status_before === r.status_after && r.stay_in_place && (
              <Tag style={{ marginLeft: 4, color: '#999', borderColor: '#d9d9d9' }}>
                状态不变：{STATUS_LABELS[r.status_before]}
              </Tag>
            )}
          </div>
          <div>操作人：{r.scanner_name}（{ROLE_LABELS[r.scanner_role]}）</div>
          {(r.expected_handler_name || r.expected_handler_id) && (
            <div>
              登记责任人：
              <Tag color="blue">{r.expected_handler_name || '待认领'}</Tag>
              {r.expected_handler_name !== r.scanner_name && (
                <Tag color="red" style={{ marginLeft: 4 }}>与扫码人不匹配</Tag>
              )}
            </div>
          )}
          <div>扫码内容：<code>{r.qr_code}</code></div>
          {r.failure_reason && <div style={{ color: '#ff4d4f' }}>失败原因：{r.failure_reason}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <SafetyOutlined style={{ color: '#1890ff' }} />
            <span style={{ color: '#666', fontSize: 12 }}>核验凭证：</span>
            <code style={{
              fontSize: 11,
              background: '#f0f5ff',
              padding: '2px 6px',
              borderRadius: 4,
              color: '#1890ff',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}>
              {r.evidence ? r.evidence.substring(0, 40) + '...' : '-'}
            </code>
            {r.evidence && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => {
                  setCurrentEvidence(r)
                  setEvidenceModalVisible(true)
                }}
              >
                <EyeOutlined /> 查看完整
              </Button>
            )}
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
          <div style={{ marginBottom: 4 }}>
            <strong>{getActionLabel(r.action)}</strong>
            {r.old_version && r.new_version && (
              <Tag color="purple" style={{ marginLeft: 8 }}>
                v{r.old_version} → v{r.new_version}
              </Tag>
            )}
          </div>
          <div>操作人：{r.handler_name}（{ROLE_LABELS[r.handler_role]}）</div>
          <div>状态流转：{STATUS_LABELS[r.from_status]} → {STATUS_LABELS[r.to_status]}</div>
          <div>处理意见：{r.opinion}</div>
          {r.failure_reason && (
            <div style={{ color: '#ff4d4f' }}>失败/异常原因：{r.failure_reason}</div>
          )}
          {r.processing_time_seconds > 0 && (
            <div>处理耗时：{r.processing_time_seconds}秒</div>
          )}
          {!r.time_limit_met && (
            <div style={{ color: '#ff4d4f' }}>⚠ 超时处理</div>
          )}
          {r.audit_id && (
            <div style={{ color: '#999', fontSize: 12 }}>审计ID: #{r.audit_id}</div>
          )}
        </div>
      )
    }))
  ].sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())

  const missingRequiredMaterials = materials.filter(m => m.required && !m.provided)
  const isOverdue = !timeLimitMet

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/applications')}>
            返回列表
          </Button>
          <h2 style={{ margin: 0 }}>投保申请详情</h2>
          <Tag color={STATUS_COLORS[appData.status]} style={{ fontSize: 14, padding: '2px 12px' }}>
            {STATUS_LABELS[appData.status]}
          </Tag>
          <Tag color="purple" style={{ fontSize: 13 }}>
            v{appData.version}
          </Tag>
          {isLocked && (
            <Badge
              status="processing"
              text={
                <span style={{ color: '#faad14', fontWeight: 600 }}>
                  <LockOutlined /> {lockedBy ? `${lockedBy.name} 正在处理中` : '正在被处理中'}
                  {lockedBy?.role && `（${ROLE_LABELS[lockedBy.role]}）`}
                </span>
              }
            />
          )}
          {isHandler && !isLocked && (
            <Tag color="blue" icon={<TeamOutlined />}>我的任务</Tag>
          )}
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={() => setFormModalVisible(true)}>
              编辑
            </Button>
          )}
          {canScan && (
            <Button
              type="primary"
              icon={<QrcodeOutlined />}
              onClick={() => setScanModalVisible(true)}
              danger={handlerMismatch.mismatch}
            >
              {handlerMismatch.mismatch ? '扫码（责任人不匹配）' : '扫码核验'}
            </Button>
          )}
          {availableActions.length > 0 && !isLocked && (
            <Button type="primary" onClick={() => setProcessModalVisible(true)}>
              处理申请
            </Button>
          )}
        </Space>
      </div>

      {isLocked && lockedBy && (
        <Alert
          showIcon
          icon={<LockOutlined />}
          type="warning"
          style={{ marginBottom: 12 }}
          message={
            <Space>
              <span>
                <strong style={{ color: '#faad14' }}>该申请正在被处理</strong>
              </span>
              <Tag color="orange">{lockedBy.name}</Tag>
              <span style={{ color: '#666' }}>
                （{ROLE_LABELS[lockedBy.role] || lockedBy.role}，ID: {lockedBy.id || '-'}）
              </span>
            </Space>
          }
          description="为避免并发冲突，请等待其处理完成后再操作，或点击刷新查看最新状态。如确认锁异常，可联系管理员清除。"
          action={
            <Button size="small" type="link" icon={<ReloadOutlined />} onClick={loadData}>
              刷新状态
            </Button>
          }
        />
      )}

      {handlerMismatch.mismatch && !isLocked && (
        <Alert
          showIcon
          icon={<UserOutlined />}
          type="warning"
          style={{ marginBottom: 12 }}
          message="扫码人 / 处理人不匹配"
          description={handlerMismatch.reason}
          action={
            <Space>
              <Button size="small" type="link" onClick={() => setScanModalVisible(true)}>
                仍要扫码
              </Button>
              <Tag color="orange">将记录但停留原状态</Tag>
            </Space>
          }
        />
      )}

      {isOverdue && (
        <Alert
          showIcon
          type="error"
          icon={<ClockCircleOutlined />}
          message="该申请已超过办理时限！"
          description={`截止时间：${dayjs(appData.deadline).format('YYYY-MM-DD HH:mm')}，请立即处理或标记异常`}
          style={{ marginBottom: 12 }}
          action={
            <Button size="small" danger type="primary" onClick={() => setProcessModalVisible(true)}>
              立即处理
            </Button>
          }
        />
      )}

      {missingRequiredMaterials.length > 0 && (
        <Alert
          showIcon
          type="warning"
          icon={<WarningOutlined />}
          message={`有 ${missingRequiredMaterials.length} 项必填材料未提供`}
          description={
            <Space wrap>
              {missingRequiredMaterials.map((m, i) => (
                <Tag key={i} color="red">{m.name}</Tag>
              ))}
            </Space>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card
            title={
              <Space>
                <QrcodeOutlined style={{ color: '#1890ff' }} />
                <span>二维码 / 凭证 / 责任人信息</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
            bodyStyle={{ paddingBottom: 8 }}
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号" span={2}>
                <Space>
                  <strong>{appData.application_no}</strong>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(appData.application_no)
                      message.success('申请编号已复制')
                    }}
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="绑定二维码" span={2}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space>
                    <QrcodeOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <code style={{
                      background: '#f0f5ff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      color: '#1890ff',
                      fontSize: 14,
                      fontWeight: 600,
                    }}>
                      {appData.qr_code}
                    </code>
                    <Button
                      type="link"
                      size="small"
                      icon={<CopyOutlined />}
                      style={{ padding: 0, height: 'auto' }}
                      onClick={() => {
                        navigator.clipboard?.writeText(appData.qr_code)
                        message.success('二维码已复制')
                      }}
                    />
                  </Space>
                  <Space size={12}>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      创建时间：{dayjs(appData.created_at).format('MM-DD HH:mm')}
                    </span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      状态：<Tag color={STATUS_COLORS[appData.status]}>{STATUS_LABELS[appData.status]}</Tag>
                    </span>
                  </Space>
                </Space>
              </Descriptions.Item>

              <Descriptions.Item
                label={
                  <Space>
                    <UserOutlined />
                    <span>当前登记责任人</span>
                  </Space>
                }
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={handlerMismatch.mismatch ? 'red' : 'blue'} style={{ fontSize: 13 }}>
                      {appData.current_handler_name || '待认领'}
                    </Tag>
                    {appData.current_handler_role && (
                      <Tag>{ROLE_LABELS[appData.current_handler_role]}</Tag>
                    )}
                    {isHandler && (
                      <Tag color="green">
                        <CheckCircleOutlined /> 您
                      </Tag>
                    )}
                  </Space>
                  {handlerMismatch.mismatch && (
                    <span style={{ color: '#ff4d4f', fontSize: 12 }}>
                      <WarningOutlined /> 您不是当前登记责任人
                    </span>
                  )}
                </Space>
              </Descriptions.Item>

              <Descriptions.Item
                label={
                  <Space>
                    <SafetyOutlined />
                    <span>最近核验凭证</span>
                  </Space>
                }
              >
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {lastScanRecord ? (
                    <>
                      <Space>
                        <Badge
                          status={lastScanRecord.result === 'success' ? 'success' :
                            (lastScanRecord.result === 'duplicate' ? 'warning' : 'error')
                          }
                          text={
                            lastScanRecord.result === 'success' ? '核验通过' :
                            lastScanRecord.result === 'duplicate' ? '重复扫码' :
                            lastScanRecord.result === 'handler_mismatch' ? '处理人不匹配' : '核验失败'
                          }
                        />
                        {lastScanRecord.stay_in_place && (
                          <Tag color="orange"><LockOutlined /> 停留原状态</Tag>
                        )}
                        <Tag style={{ color: '#666', fontSize: 11 }}>
                          {dayjs(lastScanRecord.scan_time).format('MM-DD HH:mm')}
                        </Tag>
                      </Space>
                      {lastScanRecord.evidence && (
                        <Space direction="vertical" size={0}>
                          <span style={{ fontSize: 11, color: '#999' }}>SHA256 凭证：</span>
                          <code style={{
                            background: '#f5f5f5',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            wordBreak: 'break-all',
                            color: '#1890ff',
                          }}>
                            {scanEvidenceShort || `${lastScanRecord.evidence.substring(0, 50)}...`}
                          </code>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setCurrentEvidence(lastScanRecord)
                              setEvidenceModalVisible(true)
                            }}
                            style={{ padding: 0, textAlign: 'left' }}
                          >
                            <EyeOutlined /> 查看完整凭证 + 核验详情
                          </Button>
                        </Space>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#999' }}>暂无核验记录</span>
                  )}
                </Space>
              </Descriptions.Item>

              <Descriptions.Item label="投保人">
                {appData.applicant_name}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {appData.applicant_phone}
              </Descriptions.Item>
              <Descriptions.Item label="险种">{appData.insurance_type}</Descriptions.Item>
              <Descriptions.Item label="保险金额">¥{Number(appData.insurance_amount || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="保费">¥{Number(appData.premium || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={
                <Space>
                  <ClockCircleOutlined />
                  <span>办理时限</span>
                  {isOverdue && <span style={{ color: '#ff4d4f' }}>（已逾期）</span>}
                  {!isOverdue && hoursLeft < 24 && <span style={{ color: '#faad14' }}>（临近）</span>}
                </Space>
              }>
                <span className={getDeadlineClass()}>
                  {dayjs(appData.deadline).format('YYYY-MM-DD HH:mm')}
                  {!isOverdue && hoursLeft < 24 && <span style={{ color: '#faad14' }}>（剩{hoursLeft}h）</span>}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(appData.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="最近处理时间">
                {appData.last_processed_at ? dayjs(appData.last_processed_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最近处理人">
                {appData.last_processed_by_name ? (
                  <Space>
                    <Tag>{appData.last_processed_by_name}</Tag>
                    {appData.last_processed_by_role && (
                      <span style={{ color: '#999', fontSize: 12 }}>
                        （{ROLE_LABELS[appData.last_processed_by_role]}）
                      </span>
                    )}
                  </Space>
                ) : '-'}
              </Descriptions.Item>
              {appData.exception_reason && (
                <Descriptions.Item label="异常原因" span={2}>
                  <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                    <WarningOutlined /> {appData.exception_reason}
                  </span>
                </Descriptions.Item>
              )}
              {appData.last_process_result && (
                <Descriptions.Item label="最近处理结果" span={2}>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <span>{appData.last_process_result}</span>
                    {appData.last_processed_by_name && (
                      <span style={{ color: '#999', fontSize: 12 }}>
                        处理人：{appData.last_processed_by_name}
                        {appData.last_processed_at && ` · ${dayjs(appData.last_processed_at).format('MM-DD HH:mm')}`}
                      </span>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              {appData.notes && (
                <Descriptions.Item label="备注" span={2}>{appData.notes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card
            title={
              <Space>
                <SafetyOutlined />
                <span>投保材料清单</span>
                <Badge
                  count={`缺 ${missingRequiredMaterials.length} 项`}
                  showZero={false}
                  style={{ backgroundColor: missingRequiredMaterials.length > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {missingRequiredMaterials.length > 0 && (
              <Alert
                showIcon
                type="warning"
                style={{ marginBottom: 12 }}
                message="以下必填材料缺失将导致流转时被拦截，停留在原状态"
              />
            )}
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
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                <span>流转 / 审计历史</span>
                <Tag style={{ marginLeft: 8 }}>{allEvents.length} 条</Tag>
              </Space>
            }
            style={{ marginBottom: 16 }}
            bodyStyle={{ maxHeight: 520, overflowY: 'auto', paddingTop: 12 }}
            extra={
              <Tooltip title="刷新流转记录">
                <Button size="small" icon={<ReloadOutlined />} onClick={loadData} />
              </Tooltip>
            }
          >
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
            <Card
              title={
                <Space>
                  <QrcodeOutlined />
                  <span>扫码核验记录</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {history.scan_records.filter(r => r.result === 'success').length} 次通过 / {history.scan_records.length} 次
                  </Tag>
                </Space>
              }
              bodyStyle={{ maxHeight: 300, overflowY: 'auto' }}
            >
              {history.scan_records.map((record, idx) => (
                <div key={idx} style={{
                  padding: 12,
                  background: record.result === 'success' ? '#f6ffed' :
                    (record.result === 'duplicate' || record.result === 'handler_mismatch' || record.result === 'materials_missing' ? '#fffbe6' : '#fff2f0'),
                  borderRadius: 6,
                  marginBottom: 8,
                  border: `1px solid ${record.result === 'success' ? '#b7eb8f' :
                    (record.result === 'duplicate' || record.result === 'handler_mismatch' || record.result === 'materials_missing' ? '#ffe58f' : '#ffa39e')}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                    <Space wrap>
                      {record.result === 'success' ?
                        <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                      }
                      <strong style={{ fontSize: 13 }}>
                        {record.result === 'success' ? '核验通过' :
                         record.result === 'invalid_qr' ? '无效二维码' :
                         record.result === 'duplicate' ? '重复扫码' :
                         record.result === 'handler_mismatch' ? '处理人不匹配' :
                         record.result === 'materials_missing' ? '材料缺失' : '核验失败'}
                      </strong>
                      {record.stay_in_place && (
                        <Tag color="orange">
                          <LockOutlined /> 停留原状态
                        </Tag>
                      )}
                      {record.status_before && record.status_after && (
                        <Tag color={record.status_before === record.status_after ? 'default' : 'green'}>
                          {STATUS_LABELS[record.status_before]}
                          {' → '}
                          {STATUS_LABELS[record.status_after]}
                        </Tag>
                      )}
                    </Space>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      {dayjs(record.scan_time).format('MM-DD HH:mm:ss')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    <div>
                      <UserOutlined /> 扫码人：<strong>{record.scanner_name}</strong>
                      <span style={{ color: '#666' }}>（{ROLE_LABELS[record.scanner_role]}）</span>
                      {(record.expected_handler_name || record.expected_handler_id) && (
                        <>
                          {record.expected_handler_name !== record.scanner_name ? (
                            <span style={{ color: '#ff4d4f', marginLeft: 8 }}>
                              （登记责任人应为：{record.expected_handler_name || '待认领'}，ID: {record.expected_handler_id || '-'}）
                            </span>
                          ) : (
                            <span style={{ color: '#52c41a', marginLeft: 8 }}>
                              （与登记责任人一致）
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div><QrcodeOutlined /> 扫码内容：<code>{record.qr_code}</code></div>
                    {record.failure_reason && (
                      <div style={{ color: '#ff4d4f' }}>
                        <WarningOutlined /> 原因：{record.failure_reason}
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <SafetyOutlined style={{ color: '#1890ff' }} /> 核验凭证：
                      <div style={{
                        marginTop: 4,
                        padding: 6,
                        background: '#f0f5ff',
                        borderRadius: 4,
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: '#1890ff',
                        lineHeight: 1.4,
                      }}>
                        {record.evidence ? (
                          <>
                            {record.evidence.substring(0, 56)}...
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: '0 4px', height: 'auto', fontSize: 11 }}
                              onClick={() => {
                                setCurrentEvidence(record)
                                setEvidenceModalVisible(true)
                              }}
                            >
                              <EyeOutlined /> 查看完整
                            </Button>
                          </>
                        ) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined /> 处理投保申请
          </Space>
        }
        open={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleProcess}
        >
          <Alert
            showIcon
            type={handlerMismatch.mismatch ? 'warning' : 'info'}
            style={{ marginBottom: 16 }}
            message={
              <Space wrap>
                <span>当前状态：
                  <Tag color={STATUS_COLORS[appData.status]}>
                    {STATUS_LABELS[appData.status]}
                  </Tag>
                </span>
                <span>版本：v{appData.version}</span>
                <span>登记人：<Tag>{appData.current_handler_name || '待认领'}</Tag></span>
                <span>您：<Tag color={handlerMismatch.mismatch ? 'orange' : 'green'}>{user?.name}</Tag></span>
              </Space>
            }
            description={
              handlerMismatch.mismatch
                ? '您不是当前登记责任人，处理后仍将记录审计，但建议由责任人操作'
                : '请选择处理动作并填写处理意见（版本号将自动递增）'
            }
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
            rules={[
              { required: true, message: '请填写处理意见' },
              { min: 5, message: '处理意见至少5个字，便于后续审计追溯' },
            ]}
            extra="此意见将与版本号、时间、操作人一同记录到审计日志和流转历史中"
          >
            <TextArea rows={5} placeholder={`请详细填写对 ${STATUS_LABELS[appData.status]} 申请的处理意见...`} />
          </Form.Item>

          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="当前版本">v{appData.version}</Descriptions.Item>
            <Descriptions.Item label="处理后版本">
              <Tag color="purple">v{appData.version + 1}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              {user?.name}（{ROLE_LABELS[user?.role]}）
            </Descriptions.Item>
            <Descriptions.Item label="审计记录">
              <span style={{ color: '#52c41a' }}>✓ 全程留痕</span>
            </Descriptions.Item>
          </Descriptions>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setProcessModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={processing}>
                <SafetyOutlined /> 确认处理（v{appData.version} → v{appData.version + 1}）
              </Button>
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

      <Modal
        title={
          <Space>
            <SafetyOutlined style={{ color: '#1890ff' }} />
            <span>扫码核验凭证详情</span>
          </Space>
        }
        open={evidenceModalVisible}
        onCancel={() => setEvidenceModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setEvidenceModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={720}
      >
        {currentEvidence && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              showIcon
              type={currentEvidence.result === 'success' ? 'success' : 'warning'}
              message={
                currentEvidence.result === 'success' ? '核验通过' :
                currentEvidence.result === 'duplicate' ? '重复扫码' :
                currentEvidence.result === 'handler_mismatch' ? '处理人不匹配' : '核验失败'
              }
              description={`记录ID: #${currentEvidence.id || '-'} · ${dayjs(currentEvidence.scan_time || currentEvidence.created_at).format('YYYY-MM-DD HH:mm:ss')}`}
            />

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请编号" span={2}>
                {appData.application_no}
              </Descriptions.Item>
              <Descriptions.Item label="扫码人">
                {currentEvidence.scanner_name}（{ROLE_LABELS[currentEvidence.scanner_role]}）
                · ID: {currentEvidence.scanner_id || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="登记责任人">
                <Tag color="blue">{currentEvidence.expected_handler || appData.current_handler_name || '-'}</Tag>
                {currentEvidence.expected_handler && currentEvidence.scanner_name !== currentEvidence.expected_handler && (
                  <Tag color="red" style={{ marginLeft: 4 }}>不匹配</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="扫码内容（QR）" span={2}>
                <code>{currentEvidence.qr_code}</code>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(currentEvidence.qr_code)
                    message.success('扫码内容已复制')
                  }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="核验结果">
                <Tag color={currentEvidence.result === 'success' ? 'green' : 'orange'}>
                  {currentEvidence.result}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态是否推进">
                {currentEvidence.stay_in_place ? (
                  <Tag color="orange"><LockOutlined /> 未推进（停留原状态）</Tag>
                ) : (
                  <Tag color="green">已推进到下一状态</Tag>
                )}
              </Descriptions.Item>
              {currentEvidence.status_before && currentEvidence.status_after && (
                <>
                  <Descriptions.Item label="扫码前状态">
                    <Tag color={STATUS_COLORS[currentEvidence.status_before]}>
                      {STATUS_LABELS[currentEvidence.status_before]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="扫码后状态">
                    <Tag color={STATUS_COLORS[currentEvidence.status_after]}>
                      {STATUS_LABELS[currentEvidence.status_after]}
                      {currentEvidence.stay_in_place && currentEvidence.status_before === currentEvidence.status_after && (
                        <LockOutlined style={{ marginLeft: 4, fontSize: 10 }} />
                      )}
                    </Tag>
                    {currentEvidence.stay_in_place && (
                      <span style={{ color: '#faad14', fontSize: 12, marginLeft: 8 }}>
                        未变化
                      </span>
                    )}
                  </Descriptions.Item>
                </>
              )}
              {(currentEvidence.expected_handler_name || currentEvidence.expected_handler_id) && (
                <Descriptions.Item label="登记责任人（预期）" span={2}>
                  <Space wrap>
                    <Tag color="blue">
                      {currentEvidence.expected_handler_name || '待认领'}
                    </Tag>
                    {currentEvidence.expected_handler_id && (
                      <span style={{ color: '#666', fontSize: 12 }}>
                        ID: {currentEvidence.expected_handler_id}
                      </span>
                    )}
                    {currentEvidence.expected_handler_name &&
                      currentEvidence.scanner_name &&
                      currentEvidence.expected_handler_name !== currentEvidence.scanner_name && (
                      <Tag color="red">扫码人不匹配</Tag>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
              {currentEvidence.failure_reason && (
                <Descriptions.Item label="失败/异常原因" span={2}>
                  <span style={{ color: '#ff4d4f' }}>
                    <WarningOutlined /> {currentEvidence.failure_reason}
                  </span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="设备信息" span={2}>
                {currentEvidence.device_info || navigator.userAgent || '本地演示环境'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left" style={{ margin: '4px 0 0' }}>
              <Space>
                <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
                <span>核验凭证（SHA256 哈希，不可篡改）</span>
              </Space>
            </Divider>

            <div style={{
              padding: 16,
              background: 'linear-gradient(135deg, #f0f5ff 0%, #f6ffed 100%)',
              borderRadius: 8,
              border: '1px solid #d6e4ff',
            }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ color: '#666', fontSize: 12 }}>
                  以下凭证由「申请编号 + 扫码内容 + 扫码人ID + 扫码时间戳」经 SHA256 哈希生成，
                  记录到 SQLite 数据库，用于审计和反欺诈校验：
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 13,
                  background: '#fff',
                  padding: 12,
                  borderRadius: 6,
                  wordBreak: 'break-all',
                  lineHeight: 1.6,
                  color: '#1890ff',
                  border: '1px dashed #91caff',
                  userSelect: 'all',
                }}>
                  {currentEvidence.evidence}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Space>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard?.writeText(currentEvidence.evidence)
                        message.success('凭证哈希已复制到剪贴板')
                      }}
                    >
                      复制凭证哈希
                    </Button>
                    <Button
                      type="primary"
                      ghost
                      onClick={() => {
                        navigator.clipboard?.writeText(JSON.stringify(currentEvidence, null, 2))
                        message.success('完整记录JSON已复制')
                      }}
                    >
                      导出完整记录（JSON）
                    </Button>
                  </Space>
                </div>
              </Space>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}
