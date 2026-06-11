import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Button, Space, Input, Select, Modal, Form, InputNumber,
  message, Popconfirm, Checkbox, Tooltip, Badge
} from 'antd'
import {
  PlusOutlined, QrcodeOutlined, ReloadOutlined,
  AppstoreOutlined, FilterOutlined, UserOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined
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

  const navigate = useNavigate()

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await applicationAPI.list(filters)
      setList(res.data.data)
    } catch (error) {
      message.error('加载列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [filters])

  const getDeadlineClass = (app) => {
    if (!app.time_limit_met) return 'overdue'
    if (app.hours_left < 24) return 'warning'
    return 'normal'
  }

  const handleScan = (app) => {
    setScanApp(app)
    setScanModalVisible(true)
  }

  const handleScanSuccess = () => {
    setScanModalVisible(false)
    loadList()
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
    if (app.current_handler_role && app.current_handler_role !== user?.role) {
      message.error(`当前岗位无法修改此申请`)
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
    setBatchModalVisible(true)
  }

  const handleBatchSuccess = () => {
    setBatchModalVisible(false)
    setSelectedRowKeys([])
    loadList()
  }

  const getAvailableActions = () => {
    const firstApp = list.find(a => a.id === selectedRowKeys[0])
    if (!firstApp) return []

    const status = firstApp.status
    const role = user?.role

    const actions = []
    if (role === 'registrar') {
      if (['pending_scan', 'scan_failed'].includes(status)) {
        // 扫码是单独的操作
      }
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
      ['pending_scan', 'scan_failed'].includes(app.status) &&
      !app.is_locked
  }

  const canEdit = (app) => {
    return user?.role === 'registrar' &&
      ['pending_scan', 'revision_required', 'scan_failed'].includes(app.status) &&
      !app.is_locked
  }

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'application_no',
      key: 'application_no',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <Space>
          <a onClick={() => navigate(`/applications/${record.id}`)}>{text}</a>
          {record.is_locked && (
            <Tooltip title="正在被处理中">
              <Badge status="processing" text="处理中" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '投保人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100,
    },
    {
      title: '身份证号',
      dataIndex: 'applicant_id_card',
      key: 'applicant_id_card',
      width: 180,
    },
    {
      title: '险种',
      dataIndex: 'insurance_type',
      key: 'insurance_type',
      width: 80,
    },
    {
      title: '保额',
      dataIndex: 'insurance_amount',
      key: 'insurance_amount',
      width: 100,
      render: (val) => `¥${val.toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '当前责任人',
      dataIndex: 'current_handler_name',
      key: 'current_handler_name',
      width: 180,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span><UserOutlined /> {text || '待认领'}</span>
          <Tag style={{ margin: 0 }}>{ROLE_LABELS[record.current_handler_role] || '-'}</Tag>
        </Space>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 180,
      render: (deadline, record) => {
        return (
          <span className={getDeadlineClass(record)}>
            {dayjs(deadline).format('YYYY-MM-DD HH:mm')}
            {!record.time_limit_met && <span> (已逾期)</span>}
            {record.time_limit_met && record.hours_left < 24 && <span> (剩余{record.hours_left}小时)</span>}
          </span>
        )
      },
    },
    {
      title: '异常原因',
      dataIndex: 'exception_reason',
      key: 'exception_reason',
      width: 200,
      ellipsis: true,
      render: (text) => {
        if (!text) return '-'
        return (
          <Tooltip title={text}>
            <span><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> {text}</span>
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
          <Tooltip title={text}>
            <span>
              {record.last_processed_by_name && (
                <span style={{ color: '#999' }}>[{record.last_processed_by_name}]</span>
              )}
              {text || '-'}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/applications/${record.id}`)}
          >
            详情
          </Button>
          {canScan(record) && (
            <Button
              type="link"
              size="small"
              icon={<QrcodeOutlined />}
              onClick={() => handleScan(record)}
            >
              扫码
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
      const allSameStatus = selectedApps.every(a => a.status === selectedApps[0]?.status)
      const allUnlocked = selectedApps.every(a => !a.is_locked)

      if (!allSameStatus && selectedApps.length > 1) {
        message.warning('批量处理请选择相同状态的申请')
        return
      }
      if (!allUnlocked) {
        message.warning('存在正在处理中的申请，请等待处理完成后再选择')
        return
      }

      setSelectedRowKeys(newSelectedRowKeys)
    },
    getCheckboxProps: (record) => ({
      disabled: record.is_locked ||
        (user?.role === 'registrar' &&
          !['revision_required'].includes(record.status)) ||
        (user?.role === 'supervisor' && record.status !== 'pending_review') ||
        (user?.role === 'reviewer' && record.status !== 'pending_approval'),
    }),
  }

  return (
    <div>
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
            placeholder="搜索申请编号/投保人/身份证"
            allowClear
            style={{ width: 250 }}
            onSearch={(value) => setFilters({ ...filters, search: value })}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="岗位筛选"
            allowClear
            style={{ width: 150 }}
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
            只看我的
          </Checkbox>
        </Space>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1600 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
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
    </div>
  )
}
