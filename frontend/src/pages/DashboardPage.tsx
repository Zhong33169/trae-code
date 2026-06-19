import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Space, message } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { harvestApi } from '../api';
import {
  Statistics,
  HarvestRecord,
  HarvestStatus,
  StatusLabelMap,
  StatusColorMap,
  Role,
} from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [recentRecords, setRecentRecords] = useState<HarvestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, recordsData] = await Promise.all([
        harvestApi.statistics(),
        harvestApi.findAll(),
      ]);
      setStats(statsData as Statistics);
      const records = recordsData as HarvestRecord[];
      setRecentRecords(records.slice(0, 5));
    } catch (e: any) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const handleStatClick = (statusFilter: string) => {
    navigate(`/harvest?status=${statusFilter}`);
  };

  const roleLabel = user?.role === Role.FIELD_ADMIN
    ? '田间管理员'
    : user?.role === Role.TECHNICIAN
    ? '农技员'
    : '合作社主任';

  const statCards = stats
    ? [
        {
          title: '待补正',
          value: stats.pending_correction,
          icon: <WarningOutlined style={{ color: '#faad14' }} />,
          color: '#faad14',
          onClick: () => handleStatClick(HarvestStatus.PENDING_CORRECTION),
        },
        {
          title: '待核验',
          value: stats.pending_verification,
          icon: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
          color: '#1890ff',
          onClick: () => handleStatClick(HarvestStatus.SUBMITTED),
        },
        {
          title: '待复核',
          value: stats.pending_review,
          icon: <FileTextOutlined style={{ color: '#722ed1' }} />,
          color: '#722ed1',
          onClick: () => handleStatClick(HarvestStatus.VERIFIED),
        },
        {
          title: '已归档',
          value: stats.archived,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          color: '#52c41a',
          onClick: () => handleStatClick(HarvestStatus.ARCHIVED),
        },
      ]
    : [];

  const columns = [
    {
      title: '记录编号',
      dataIndex: 'record_no',
      key: 'record_no',
      render: (text: string, record: HarvestRecord) => (
        <a onClick={() => navigate(`/harvest/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '作物名称',
      dataIndex: 'crop_name',
      key: 'crop_name',
    },
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
    },
    {
      title: '采收日期',
      dataIndex: 'harvest_date',
      key: 'harvest_date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: HarvestStatus) => (
        <Tag color={StatusColorMap[status]}>{StatusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HarvestRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => navigate(`/harvest/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="header-bar">
        <h2>工作台 - {user?.name}（{roleLabel}）</h2>
        <Button type="primary" onClick={loadData} loading={loading}>
          刷新数据
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, index) => (
          <Col span={6} key={index}>
            <Card
              className="stat-card"
              onClick={card.onClick}
              hoverable
              style={{ borderLeft: `4px solid ${card.color}` }}
            >
              <Statistic
                title={
                  <Space>
                    {card.icon}
                    <span>{card.title}</span>
                    <ArrowRightOutlined style={{ fontSize: 12, color: '#999' }} />
                  </Space>
                }
                value={card.value}
                valueStyle={{ color: card.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="最近采收记录" extra={<a onClick={() => navigate('/harvest')}>查看全部</a>}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={recentRecords}
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default DashboardPage;
