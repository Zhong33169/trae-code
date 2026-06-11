import React, { useState, useEffect } from 'react'
import { Table, Tag, Button, Space, Input, Select, DatePicker } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { auditAPI } from '../api'
import { ROLE_LABELS } from '../utils/constants'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select
const { RangePicker } = DatePicker

export default function AuditLogs({ user }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({})

  const loadData = async () => {
    setLoading(true)
    try {
      const params = { ...filters }
      if (filters.date_range) {
        params.start_date = filters.date_range[0].format('YYYY-MM-DD')
        params.end_date = filters.date_range[1].format('YYYY-MM-DD')
        delete params.date_range
      }
      const res = await auditAPI.list(params)
      setList(res.data.data)
    } catch (error) {
      console.error('加载审计日志失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters])

  const getActionColor = (action) => {
    if (action.includes('pass') || action === 'approve' || action === 'create') return 'green'
    if (action.includes('fail') || action === 'reject') return 'red'
    if (action === 'login') return 'blue'
    if (action.includes('revise')) return 'orange'
    return 'default'
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      dataIndex: 'username',
      key: 'username',
      width: 120,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <span>{text}</span>
          <Tag style={{ margin: 0 }}>{ROLE_LABELS[record.user_role]}</Tag>
        </Space>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action) => <Tag color={getActionColor(action)}>{action}</Tag>,
    },
    {
      title: '资源类型',
      dataIndex: 'resource_type',
      key: 'resource_type',
      width: 100,
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 80,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
    },
    {
      title: '客户端',
      dataIndex: 'user_agent',
      key: 'user_agent',
      width: 200,
      ellipsis: true,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>审计日志</h2>
        <Space>
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 150 }}
            onChange={(v) => setFilters({ ...filters, action: v })}
          >
            <Option value="login">登录</Option>
            <Option value="create">创建</Option>
            <Option value="update">更新</Option>
            <Option value="scan_pass">扫码通过</Option>
            <Option value="scan_fail">扫码失败</Option>
            <Option value="process">处理</Option>
            <Option value="batch_process">批量处理</Option>
          </Select>
          <Select
            placeholder="资源类型"
            allowClear
            style={{ width: 120 }}
            onChange={(v) => setFilters({ ...filters, resource_type: v })}
          >
            <Option value="user">用户</Option>
            <Option value="application">投保申请</Option>
          </Select>
          <RangePicker
            onChange={(dates) => setFilters({ ...filters, date_range: dates })}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          defaultPageSize: 50,
        }}
      />
    </div>
  )
}
