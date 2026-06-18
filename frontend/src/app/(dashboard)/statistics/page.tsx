'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Tag,
  message,
  Empty,
} from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { statisticsApi } from '@/services/api';
import { useAuthStore } from '@/store';
import type { Statistics } from '@/types';
import { STATUS_MAP } from '@/types';

export default function StatisticsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<Statistics | null>(null);
  const [byDepartment, setByDepartment] = useState<Record<string, Record<string, number>>>({});
  const [overdueReport, setOverdueReport] = useState<{ total: number; items: any[] }>({ total: 0, items: [] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overviewData, deptData, overdueData] = await Promise.all([
        statisticsApi.getOverview(),
        user?.role !== 'DEPARTMENT_SECRETARY' ? statisticsApi.getByDepartment() : Promise.resolve({}),
        statisticsApi.getOverdueReport(),
      ]);
      setOverview(overviewData);
      setByDepartment(deptData);
      setOverdueReport(overdueData);
    } catch (error: any) {
      message.error(error.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const statusOrder = [
    'PENDING_SUBMIT', 'SUBMITTED', 'REJECTED', 'RESUBMITTED',
    'QUALITY_CHECKED', 'NOTICE_SENT', 'REVIEWED', 'ARCHIVED', 'CONFIRMED',
  ];

  const statusDistribution = statusOrder.map((status) => ({
    status,
    status_cn: STATUS_MAP[status],
    count: overview?.by_status?.[status] || 0,
    percent: overview?.total ? Math.round(((overview.by_status[status] || 0) / overview.total) * 100) : 0,
  })).filter((s) => s.count > 0);

  const deptColumns = [
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '总数',
      dataIndex: 'total',
      key: 'total',
      width: 80,
      sorter: (a: any, b: any) => a.total - b.total,
    },
    ...statusOrder.slice(0, 5).map((status) => ({
      title: STATUS_MAP[status],
      dataIndex: status,
      key: status,
      width: 80,
      render: (val: number) => val || 0,
    })),
  ];

  const deptTableData = Object.entries(byDepartment).map(([dept, data]) => ({
    department: dept,
    ...data,
  }));

  const overdueColumns = [
    {
      title: '整改单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 130,
    },
    {
      title: '患者姓名',
      dataIndex: 'patient_name',
      key: 'patient_name',
      width: 100,
    },
    {
      title: '科室',
      dataIndex: 'department',
      key: 'department',
      width: 100,
    },
    {
      title: '当前状态',
      key: 'status',
      render: (_: any, record: any) => (
        <Tag color="red">{record.status_cn}</Tag>
      ),
    },
    {
      title: '超时节点',
      dataIndex: 'overdue_node_cn',
      key: 'overdue_node_cn',
      width: 120,
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 160,
    },
    {
      title: '超时原因',
      dataIndex: 'overdue_reason',
      key: 'overdue_reason',
      render: (text: string) => text || <span style={{ color: '#999' }}>未填写</span>,
    },
    {
      title: '处理人',
      dataIndex: 'handler_name',
      key: 'handler_name',
      width: 100,
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <BarChartOutlined /> 数据统计
      </h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="整改单总数"
              value={overview?.total || 0}
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="待我处理"
              value={overview?.pending_my_action || 0}
              valueStyle={{ color: '#1677ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="已超时"
              value={overview?.overdue_count || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" loading={loading}>
            <Statistic
              title="已完成"
              value={overview?.by_status?.CONFIRMED || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span>
            <FileTextOutlined /> 状态分布
          </span>
        }
        style={{ marginBottom: 24 }}
        loading={loading}
      >
        {statusDistribution.length > 0 ? (
          <Row gutter={[16, 16]}>
            {statusDistribution.map((item) => (
              <Col xs={24} sm={12} md={8} key={item.status}>
                <Card size="small">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#666' }}>{item.status_cn}</span>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>{item.count}</span>
                  </div>
                  <Progress percent={item.percent} showInfo={false} size="small" />
                  <div style={{ textAlign: 'right', color: '#999', fontSize: 12 }}>
                    {item.percent}%
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      {user?.role !== 'DEPARTMENT_SECRETARY' && Object.keys(byDepartment).length > 0 && (
        <Card
          title={
            <span>
              <TeamOutlined /> 科室统计
            </span>
          }
          style={{ marginBottom: 24 }}
          loading={loading}
        >
          <Table
            rowKey="department"
            columns={deptColumns}
            dataSource={deptTableData}
            pagination={false}
            size="middle"
          />
        </Card>
      )}

      <Card
        title={
          <span>
            <WarningOutlined style={{ color: '#ff4d4f' }} /> 超时整改单 ({overdueReport.total})
          </span>
        }
        loading={loading}
      >
        <Table
          rowKey="order_id"
          columns={overdueColumns}
          dataSource={overdueReport.items}
          pagination={{ pageSize: 10 }}
          size="middle"
          locale={{ emptyText: '暂无超时整改单' }}
        />
      </Card>
    </div>
  );
}
