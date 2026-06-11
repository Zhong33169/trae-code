'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Typography, Spin } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { isRegistrar } from '@/lib/auth';
import { ApiResponse, SummaryStatistics } from '@/types';

const { Title } = Typography;

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<SummaryStatistics>({
    total_tasks: 0,
    pending_tasks: 0,
    processing_tasks: 0,
    completed_tasks: 0,
    timeout_tasks: 0,
    today_new_tasks: 0,
    today_completed_tasks: 0,
    avg_processing_hours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    setCanCreate(isRegistrar());
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<SummaryStatistics>>('/statistics/summary');
      if (response.data.data) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    router.push('/tasks?action=create');
  };

  const handleViewTasks = () => {
    router.push('/tasks');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={3} className="!mb-0">
          首页概览
        </Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
            新建打样任务
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={handleViewTasks} className="cursor-pointer">
            <Statistic
              title="任务总数"
              value={stats.total_tasks}
              prefix={<FileTextOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={handleViewTasks} className="cursor-pointer">
            <Statistic
              title="待处理"
              value={stats.pending_tasks + stats.processing_tasks}
              prefix={<ClockCircleOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={handleViewTasks} className="cursor-pointer">
            <Statistic
              title="已超时"
              value={stats.timeout_tasks}
              prefix={<WarningOutlined className="text-red-500" />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={handleViewTasks} className="cursor-pointer">
            <Statistic
              title="已完成"
              value={stats.completed_tasks}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-6">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="今日新增"
              value={stats.today_new_tasks}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="今日完成"
              value={stats.today_completed_tasks}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="平均处理时长"
              value={stats.avg_processing_hours}
              precision={1}
              suffix="小时"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <div className="mt-8">
        <Card title="快捷操作">
          <div className="flex gap-4 flex-wrap">
            <Button type="primary" onClick={handleViewTasks}>
              查看所有任务
            </Button>
            {canCreate && (
              <Button onClick={handleCreateTask} icon={<PlusOutlined />}>
                新建打样任务
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
