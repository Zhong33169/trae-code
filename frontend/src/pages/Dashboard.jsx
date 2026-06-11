import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Button, Space } from 'antd'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  FileSearchOutlined,
  QrcodeOutlined,
  FileProtectOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { applicationAPI } from '../api'
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '../utils/constants'
import dayjs from 'dayjs'

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({})
  const [recentApps, setRecentApps] = useState([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, appsRes] = await Promise.all([
        applicationAPI.statistics(),
        applicationAPI.list({ role_filter: user?.role }),
      ])
      setStats(statsRes.data.data)
      setRecentApps(appsRes.data.data.slice(0, 10))
    } catch (error) {
      console.error('加载数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.role])

  const getDeadlineClass = (app) => {
    const hours = app.hours_left
    if (!app.time_limit_met) return 'overdue'
    if (hours < 24) return 'warning'
    return 'normal'
  }

  const columns = [
    {
      title: '申请编号',
      dataIndex: 'application_no',
      key: 'application_no',
      render: (text, record) => (
        <a onClick={() => navigate(`/applications/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '投保人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
    },
    {
      title: '险种',
      dataIndex: 'insurance_type',
      key: 'insurance_type',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '当前责任人',
      dataIndex: 'current_handler_name',
      key: 'current_handler_name',
      render: (text, record) => (
        <span>
          {text || '待认领'}
          <Tag style={{ marginLeft: 8 }}>
            {ROLE_LABELS[record.current_handler_role] || '-'}
          </Tag>
        </span>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (deadline, record) => (
        <span className={getDeadlineClass(record)}>
          {dayjs(deadline).format('YYYY-MM-DD HH:mm')}
          {!record.time_limit_met && ' (已逾期)'}
          {record.time_limit_met && record.hours_left < 24 && ` (剩余${record.hours_left}小时)`}
        </span>
      ),
    },
    {
      title: '异常原因',
      dataIndex: 'exception_reason',
      key: 'exception_reason',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '最近处理结果',
      dataIndex: 'last_process_result',
      key: 'last_process_result',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '锁定',
      dataIndex: 'is_locked',
      key: 'is_locked',
      render: (locked) => locked ? <Tag color="red">处理中</Tag> : '-',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>工作台 - {ROLE_LABELS[user?.role]}</h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="我的待办" value={stats.my_tasks || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待扫码核验" value={stats.pending_scan || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待主管审核" value={stats.pending_revision || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待复核归档" value={stats.pending_approval || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待补正" value={stats.revision_required || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="扫码失败" value={stats.scan_failed || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成归档" value={stats.archived || 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已逾期" value={stats.overdue || 0} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Card title={`我的队列（最近10条）`} extra={
        <Button type="link" onClick={() => navigate('/applications')}>查看全部</Button>
      }>
        <Table
          dataSource={recentApps}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  )
}
