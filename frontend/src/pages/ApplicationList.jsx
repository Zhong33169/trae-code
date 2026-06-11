import React, { useState, useEffect, useMemo } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, Modal, Form, InputNumber,
  message, Popconfirm, Checkbox, Tooltip, Badge, Alert, Divider, Descriptions
} from 'antd'
import {
  PlusOutlined, QrcodeOutlined, ReloadOutlined,
  AppstoreOutlined, FilterOutlined, UserOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
  SafetyCertificateOutlined, LockOutlined, TeamOutlined,
  CopyOutlined, EyeOutlined, WarningOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { applicationAPI } from '../api'
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, INSURANCE_TYPES, getMaterialsByType, ACTION_LABELS } from '../utils/constants'
import dayjs from 'dayjs'
import ScanModal from '../components/ScanModal'
import BatchProcessModal from '../components/BatchProcessModal'
import ApplicationFormModal from '../components/ApplicationFormModal'

const { Search } = Input
const { Option } = Select

export default function ApplicationList({ user }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [selectedApps, setSelectedApps] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    role_filter: user?.role || '',
    search: '',
    only_mine: true,
  })

  const [scanModalVisible, setScanModalVisible] = useState(false)
  const [scanApp, setScanApp] = useState(null)
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const [formModalVisible, setFormModalVisible] = useState(false)
  const [editingApp, setEditingApp] = useState(null)
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [qrModalApp, setQrModalApp] = useState(null)

  const navigate = useNavigate()

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await applicationAPI.list(filters)
      const data = res.data.data || []
      setList(data)
    } catch (error) {
      message.error('加载列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [filters])

  useEffect(() => {
    const apps = list.filter(a => selectedRowKeys.includes(a.id))
    setSelectedApps(apps)
  }, [selectedRowKeys, list])

  const getDeadlineClass = (app) => {
    if (!app.time_limit_met) return 'overdue'
    if (app.hours_left < 24) return 'warning'
    return 'normal'
  }

  const handleScan = (app) => {
    if (app.current_handler_id && app.current_handler_id !== user?.id) {
      Modal.warning({
        title: '扫码人与登记责任人不匹配',
        content: (
          <div>
            <p>该申请登记责任人是：<Tag color="blue">{app.current_handler_name}</Tag>（ID: {app.current_handler_id}）</p>
            <p>您：<Tag color="orange">{user?.name}</Tag>（ID: {user?.id}）</p>
            <Divider style={{ margin: '8px 0' }} />
            <p style={{ color: '#faad14' }}>
              <WarningOutlined /> 继续扫码会记录您的操作，但会标记"处理人不匹配"并停在原队列，不会推进申请流转。
            </p>
            <p style={{ color: '#666' }}>是否继续打开扫码弹窗？</p>
          </div>
        ),
        okText: '继续打开扫码弹窗',
        cancelText: '取消',
        onOk: () => {
          setScanApp(app)
          setScanModalVisible(true)
        },
      })
      return
    }
    setScanApp(app)
    setScanModalVisible(true)
  }

  const handleScanSuccess = () => {
    setScanModalVisible(false)
    loadList()
  }

  const handleShowQR = (app) => {
    setQrModalApp(app)
    setQrModalVisible(true)
  }

  const handleCreate = () => {
    setEditingApp(null)
    setFormModalVisible(true)
  }

  const handleEdit = (app) => {
    if (!['pending_scan', 'revision_required', 'scan_failed'].includes(app.status)) {
      message.error('当前状态不允许修改')
      return
    }
    if (app.is_locked) {
      message.warning('该申请正在被处理中，请稍后再试')
      return
    }
    if (app.current_handler_role && app.current_handler_role !== user?.role) {
      message.error(`当前岗位无法修改此申请`)
      return
    }
    if (app.current_handler_id && app.current_handler_id !== user?.id) {
      message.warning(`该申请由 ${app.current_handler_name} 负责，请与其沟通后再操作`)
      return
    }
    setEditingApp(app)
    setFormModalVisible(true)
  }

  const handleFormSuccess = () => {
    setFormModalVisible(false)
    loadList()
  }

  const handleBatchProcess = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要处理的申请')
      return
    }
    const lockedApps = selectedApps.filter(a => a.is_locked)
    if (lockedApps.length > 0) {
      message.warning(`选中的申请中有 ${lockedApps.length} 条正在被处理，请等待处理完成`)
      return
    }
    const firstStatus = selectedApps[0]?.status
    const notSameStatus = selectedApps.some(a => a.status !== firstStatus)
    if (notSameStatus) {
      message.error('批量处理要求所有申请为相同状态，请重新选择')
      return
    }
    setBatchModalVisible(true)
  }

  const handleBatchSuccess = () => {
    setBatchModalVisible(false)
    setSelectedRowKeys([])
    setSelectedApps([])
    loadList()
  }

  const getAvailableActions = () => {
    const firstApp = selectedApps[0]
    if (!firstApp) return []

    const status = firstApp.status
    const role = user?.role

    const actions = []
    if (role === 'registrar') {
      if (status === 'revision_required') {
        actions.push({ value: 'submit_revise', label: ACTION_LABELS.submit_revise })
      }
    }
    if (role === 'supervisor' && status === 'pending_review') {
      actions.push({ value: 'approve', label: ACTION_LABELS.approve })
      actions.push({ value: 'request_revise', label: ACTION_LABELS.request_revise })
      actions.push({ value: 'reject', label: ACTION_LABELS.reject })
    }
    if (role === 'reviewer' && status === 'pending_approval') {
      actions.push({ value: 'approve', label: '复核通过并归档' })
      actions.push({ value: 'request_revise', label: ACTION_LABELS.request_revise })
      actions.push({ value: 'reject', label: ACTION_LABELS.reject })
    }
    return actions
  }

  const canScan = (app) => {
    return user?.role === 'registrar' &&
      ['pending_scan', 'scan_failed', 'revision_required'].includes(app.status) &&
      !app.is_locked
  }

  const canEdit = (app) => {
    return user?.role === 'registrar' &&
      ['pending_scan', 'revision_required', 'scan_failed'].includes(app.status) &&
      !app.is_locked
  }

  const rowClassName = (record) => {
    if (record.is_locked) return 'row-locked'
    if (!record.time_limit_met) return 'row-overdue'
    if (record.is_my_task) return 'row-mine'
    if (record.exception_reason) return 'row-exception'
    return ''
  }

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'application_no',
      key: 'application_no',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Space>
            <a onClick={() => navigate(`/applications/${record.id}`)}><strong>{text}</strong></a>
            {record.is_locked && (
              <Tooltip title={record.locked_by ? `正在被 ${record.locked_by.name}（${ROLE_LABELS[record.locked_by.role]}）处理中` : '正在被处理中'}>
                <Badge status="processing" text={<span><LockOutlined /> 处理中</span>} />
              </Tooltip>
            )}
          </Space>
          <Space size={4}>
            {record.is_my_task ? (
              <Tag color="blue" style={{ margin: 0 }}><UserOutlined /> 我的任务</Tag>
            ) : (
              record.current_handler_role === user?.role && (
                <Tag color="default" style={{ margin: 0 }}><TeamOutlined /> 同岗待认领</Tag>
              )
            )}
            {record.version > 1 && (
              <Tag color="purple" style={{ margin: 0 }}>v{record.version}</Tag>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: '投保人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 90,
    },
    {
      title: '绑定二维码',
      dataIndex: 'qr_code',
      key: 'qr_code',
      width: 170,
      render: (text, record) => (
        <Space>
          <QrcodeOutlined style={{ color: '#1890ff' }} />
          <Tooltip title={`二维码：${text}\n点击查看详情`}>
            <a onClick={() => handleShowQR(record)}>
              <code style={{ background: '#f0f5ff', padding: '2px 8px', borderRadius: 4, color: '#1890ff' }}>
                {text}
              </code>
            </a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '险种/保额',
      key: 'insurance',
      width: 130,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>{record.insurance_type}</span>
          <span style={{ color: '#666', fontSize: 12 }}>¥{record.insurance_amount.toLocaleString()}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]} style={{ fontSize: 12, padding: '2px 10px' }}>
          {STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '当前责任人',
      dataIndex: 'current_handler_name',
      key: 'current_handler_name',
      width: 150,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.is_my_task ? (
              <span style={{ color: '#1890ff', fontWeight: 600 }}>
                <UserOutlined /> {text || '待我认领'}
              </span>
            ) : (
              <span><UserOutlined /> {text || '待认领'}</span>
            )}
          </Space>
          <Tag color={record.current_handler_role === user?.role ? 'blue' : 'default'} style={{ margin: 0 }}>
            {ROLE_LABELS[record.current_handler_role] || '-'}
          </Tag>
          {record.locked_by && (
            <span style={{ color: '#faad14', fontSize: 12 }}>
              <LockOutlined /> {record.locked_by.name}（{ROLE_LABELS[record.locked_by.role]}）正在处理
            </span>
          )}
        </Space>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 160,
      render: (deadline, record) => {
        return (
          <span className={getDeadlineClass(record)}>
            <div>{dayjs(deadline).format('YYYY-MM-DD HH:mm')}</div>
            <div style={{ fontSize: 12 }}>
              {!record.time_limit_met && <span style={{ color: '#ff4d4f' }}>⚠ 已逾期</span>}
              {record.time_limit_met && record.hours_left < 24 && (
                <span style={{ color: '#faad14' }}>⏰ 剩余{record.hours_left}小时</span>
              )}
              {record.time_limit_met && record.hours_left >= 24 && (
                <span style={{ color: '#52c41a' }}>✓ 剩余{record.hours_left}小时</span>
              )}
            </div>
          </span>
        )
      },
    },
    {
      title: '扫码核验凭证',
      key: 'evidence',
      width: 150,
      render: (_, record) => {
        if (!record.last_evidence) {
          return <span style={{ color: '#999' }}>未扫码</span>
        }
        const resultTag = record.last_scan_result === 'success' ? (
          <Tag color="green" style={{ margin: 0 }}>通过</Tag>
        ) : record.last_scan_result === 'duplicate' ? (
          <Tag color="orange" style={{ margin: 0 }}>重复</Tag>
        ) : record.last_scan_result === 'handler_mismatch' ? (
          <Tag color="purple" style={{ margin: 0 }}>人不匹配</Tag>
        ) : (
          <Tag color="red" style={{ margin: 0 }}>失败</Tag>
        )
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <SafetyCertificateOutlined style={{ color: record.last_scan_result === 'success' ? '#52c41a' : '#ff4d4f' }} />
              {resultTag}
            </Space>
            <Tooltip title={`核验凭证：${record.last_evidence}\n扫码时间：${record.last_scan_time ? dayjs(record.last_scan_time).format('YYYY-MM-DD HH:mm:ss') : '-'}`}>
              <code style={{ fontSize: 11, color: '#666', background: '#f9f9f9', padding: '1px 4px', borderRadius: 2 }}>
                {record.last_evidence}
              </code>
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: '异常原因',
      dataIndex: 'exception_reason',
      key: 'exception_reason',
      width: 180,
      ellipsis: true,
      render: (text, record) => {
        if (!text) return <span style={{ color: '#999' }}>-</span>
        return (
          <Tooltip title={
            <div>
              <div><strong>异常原因：</strong></div>
              <div>{text}</div>
              <Divider style={{ margin: '8px 0' }} />
              <div>申请编号：{record.application_no}</div>
              <div>当前状态：{STATUS_LABELS[record.status]}</div>
            </div>
          }>
            <span style={{ color: '#ff4d4f' }}>
              <ExclamationCircleOutlined /> {text.length > 25 ? text.slice(0, 25) + '...' : text}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: '最近处理结果',
      dataIndex: 'last_process_result',
      key: 'last_process_result',
      width: 200,
      ellipsis: true,
      render: (text, record) => {
        return (
          <Tooltip title={
            <div>
              <div>{text || '-'}</div>
              {record.last_processed_by_name && (
                <div style={{ marginTop: 8, color: '#666' }}>
                  处理人：{record.last_processed_by_name}
                  {record.last_processed_at && (
                    <span> （{dayjs(record.last_processed_at).format('YYYY-MM-DD HH:mm')}）</span>
                  )}
                </div>
              )}
            </div>
          }>
            <Space direction="vertical" size={0}>
              <span>{text || '-'}</span>
              {record.last_processed_by_name && (
                <span style={{ color: '#999', fontSize: 12 }}>
                  [{record.last_processed_by_name}]
                  {record.last_processed_at && ` · ${dayjs(record.last_processed_at).format('MM-DD HH:mm')}`}
                </span>
              )}
            </Space>
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/applications/${record.id}`)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<QrcodeOutlined />}
            onClick={() => handleShowQR(record)}
          >
            二维码
          </Button>
          {canScan(record) && (
            <Button
              type="link"
              size="small"
              icon={<QrcodeOutlined />}
              onClick={() => handleScan(record)}
              danger={record.status === 'scan_failed'}
            >
              {record.status === 'scan_failed' ? '重新扫码' : '扫码核验'}
            </Button>
          )}
          {canEdit(record) && (
            <Button
              type="link"
              size="small"
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      const selectedApps = list.filter(a => newSelectedRowKeys.includes(a.id))
      if (selectedApps.length > 1) {
        const allSameStatus = selectedApps.every(a => a.status === selectedApps[0]?.status)
        if (!allSameStatus) {
          message.warning('批量处理请选择相同状态的申请')
          return
        }
      }
      const lockedApps = selectedApps.filter(a => a.is_locked)
      if (lockedApps.length > 0) {
        message.warning('存在正在处理中的申请，请等待处理完成后再选择')
        return
      }
      setSelectedRowKeys(newSelectedRowKeys)
    },
    getCheckboxProps: (record) => ({
      disabled: record.is_locked ||
        (record.exception_reason && record.status === 'pending_scan') ||
        (user?.role === 'registrar' &&
          !['revision_required'].includes(record.status)) ||
        (user?.role === 'supervisor' && record.status !== 'pending_review') ||
        (user?.role === 'reviewer' && record.status !== 'pending_approval'),
    }),
  }

  const selectedVersions = selectedApps.map(a => a.version)

  const myTaskCount = list.filter(a => a.is_my_task).length
  const lockedCount = list.filter(a => a.is_locked).length
  const overdueCount = list.filter(a => !a.time_limit_met).length
  const exceptionCount = list.filter(a => a.exception_reason).length

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>投保申请列表</h2>
        <Space wrap size={8}>
          <Tag color="blue">我的待办：{myTaskCount}</Tag>
          {lockedCount > 0 && <Tag color="orange">处理中：{lockedCount}</Tag>}
          {overdueCount > 0 && <Tag color="red">已逾期：{overdueCount}</Tag>}
          {exceptionCount > 0 && <Tag color="warning">异常：{exceptionCount}</Tag>}
        </Space>
      </div>

      {(lockedCount > 0 || overdueCount > 0 || exceptionCount > 0) && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space wrap>
              {lockedCount > 0 && <span>🔒 有 {lockedCount} 条申请正在被其他用户处理，请等待或刷新确认</span>}
              {overdueCount > 0 && <span>⏰ 有 {overdueCount} 条申请已逾期，请优先处理</span>}
              {exceptionCount > 0 && <span>⚠ 有 {exceptionCount} 条申请存在异常，请及时跟进</span>}
            </Space>
          }
        />
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          {user?.role === 'registrar' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新增投保申请
            </Button>
          )}
          <Button
            type="primary"
            ghost
            icon={<AppstoreOutlined />}
            onClick={handleBatchProcess}
            disabled={selectedRowKeys.length === 0}
          >
            批量处理 ({selectedRowKeys.length})
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadList}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
        <Space wrap>
          <Search
            placeholder="搜索编号/投保人/身份证/二维码"
            allowClear
            style={{ width: 260 }}
            onSearch={(value) => setFilters({ ...filters, search: value })}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140 }}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="岗位筛选"
            allowClear
            style={{ width: 140 }}
            value={filters.role_filter}
            onChange={(value) => setFilters({ ...filters, role_filter: value })}
          >
            <Option value="registrar">投保登记员</Option>
            <Option value="supervisor">投保审核主管</Option>
            <Option value="reviewer">复核负责人</Option>
          </Select>
          <Checkbox
            checked={filters.only_mine}
            onChange={(e) => setFilters({ ...filters, only_mine: e.target.checked })}
          >
            只看我的任务
          </Checkbox>
        </Space>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        rowClassName={rowClassName}
        scroll={{ x: 1850 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条 | 我的 ${myTaskCount} 条`,
          defaultPageSize: 20,
        }}
      />

      {scanModalVisible && (
        <ScanModal
          visible={scanModalVisible}
          app={scanApp}
          onCancel={() => setScanModalVisible(false)}
          onSuccess={handleScanSuccess}
          user={user}
        />
      )}

      {batchModalVisible && (
        <BatchProcessModal
          visible={batchModalVisible}
          selectedIds={selectedRowKeys}
          selectedVersions={selectedVersions}
          selectedStatus={selectedApps[0]?.status}
          availableActions={getAvailableActions()}
          onCancel={() => setBatchModalVisible(false)}
          onSuccess={handleBatchSuccess}
          user={user}
        />
      )}

      {formModalVisible && (
        <ApplicationFormModal
          visible={formModalVisible}
          app={editingApp}
          onCancel={() => setFormModalVisible(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {qrModalVisible && qrModalApp && (
        <Modal
          title="投保申请 - 绑定二维码信息"
          open={qrModalVisible}
          onCancel={() => setQrModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setQrModalVisible(false)}>
              关闭
            </Button>,
            <Button key="detail" type="primary" onClick={() => {
              setQrModalVisible(false)
              navigate(`/applications/${qrModalApp.id}`)
            }}>
              查看详情
            </Button>,
          ]}
          width={520}
        >
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="申请编号">
              <strong>{qrModalApp.application_no}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="投保人">
              {qrModalApp.applicant_name}（{qrModalApp.applicant_id_card}）
            </Descriptions.Item>
            <Descriptions.Item label="险种/保额">
              {qrModalApp.insurance_type} / ¥{qrModalApp.insurance_amount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="绑定二维码">
              <Space>
                <QrcodeOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <code style={{ background: '#f0f5ff', padding: '4px 10px', borderRadius: 4, color: '#1890ff', fontSize: 14, fontWeight: 600 }}>
                  {qrModalApp.qr_code}
                </code>
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() => {
                    navigator.clipboard?.writeText(qrModalApp.qr_code)
                    message.success('二维码已复制')
                  }}
                />
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={STATUS_COLORS[qrModalApp.status]}>{STATUS_LABELS[qrModalApp.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前责任人">
              {qrModalApp.current_handler_name
                ? `${qrModalApp.current_handler_name}（${ROLE_LABELS[qrModalApp.current_handler_role]}）`
                : '待认领'}
            </Descriptions.Item>
            {qrModalApp.last_evidence && (
              <Descriptions.Item label="最近扫码凭证">
                <Space direction="vertical" size={4}>
                  <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                  <code style={{
                    background: qrModalApp.last_scan_result === 'success' ? '#f6ffed' : '#fff2f0',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    wordBreak: 'break-all',
                  }}>
                    {qrModalApp.last_evidence}
                  </code>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    结果：{qrModalApp.last_scan_result}
                    {qrModalApp.last_scan_time && ` · ${dayjs(qrModalApp.last_scan_time).format('YYYY-MM-DD HH:mm:ss')}`}
                  </span>
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Modal>
      )}
    </div>
  )
}
