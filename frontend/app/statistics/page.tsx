'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, DatePicker, Button, Space } from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  PercentageOutlined,
  BarChartOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '@/lib/api';
import { SummaryStatistics, TrendData, ApiResponse, NODE_LABELS, STATUS_LABELS } from '@/types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryStatistics | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const [summaryRes, trendRes] = await Promise.all([
        api.get<ApiResponse<SummaryStatistics>>('/statistics/summary'),
        api.get<ApiResponse<TrendData[]>>('/statistics/trend'),
      ]);
      if (summaryRes.data.data) {
        setSummary(summaryRes.data.data);
      }
      if (trendRes.data.data) {
        setTrend(trendRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeoutRate = summary && summary.total_tasks > 0
    ? (summary.timeout_tasks / summary.total_tasks * 100)
    : 0;

  const getNodeBarChart = () => {
    if (!summary) return {};
    const data = [
      { name: '订单打样', value: summary.pending_tasks },
      { name: '样衣确认+大货排产', value: summary.processing_tasks },
      { name: '已完成', value: summary.completed_tasks },
      { name: '已超时', value: summary.timeout_tasks },
    ];
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.name),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '任务数',
          type: 'bar',
          data: data.map((item) => item.value),
          itemStyle: {
            color: (params: any) => {
              const colors = ['#1677ff', '#fa8c16', '#52c41a', '#ff4d4f'];
              return colors[params.dataIndex % colors.length];
            },
          },
        },
      ],
    };
  };

  const getStatusPieChart = () => {
    if (!summary) return {};
    const data = [
      { value: summary.pending_tasks, name: '待处理' },
      { value: summary.processing_tasks, name: '处理中' },
      { value: summary.completed_tasks, name: '已完成' },
      { value: summary.timeout_tasks, name: '已超时' },
    ].filter((item) => item.value > 0);
    return {
      tooltip: { trigger: 'item' },
      legend: { orient: 'vertical', left: 'left' },
      series: [
        {
          name: '任务状态',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false, position: 'center' },
          emphasis: {
            label: { show: true, fontSize: 20, fontWeight: 'bold' },
          },
          labelLine: { show: false },
          data,
          color: ['#1677ff', '#fa8c16', '#52c41a', '#ff4d4f'],
        },
      ],
    };
  };

  const getTrendLineChart = () => {
    if (!trend.length) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['新增任务', '完成任务', '超时任务'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trend.map((item) => item.date),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '新增任务',
          type: 'line',
          smooth: true,
          data: trend.map((item) => item.new_tasks),
          lineStyle: { color: '#1677ff', width: 2 },
          itemStyle: { color: '#1677ff' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 119, 255, 0.3)' },
                { offset: 1, color: 'rgba(22, 119, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: '完成任务',
          type: 'line',
          smooth: true,
          data: trend.map((item) => item.completed_tasks),
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
                { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
              ],
            },
          },
        },
        {
          name: '超时任务',
          type: 'line',
          smooth: true,
          data: trend.map((item) => item.timeout_tasks),
          lineStyle: { color: '#ff4d4f', width: 2 },
          itemStyle: { color: '#ff4d4f' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(255, 77, 79, 0.3)' },
                { offset: 1, color: 'rgba(255, 77, 79, 0.05)' },
              ],
            },
          },
        },
      ],
    };
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
          统计报表
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchStatistics}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="任务总数"
              value={summary?.total_tasks || 0}
              prefix={<FileTextOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="超时率"
              value={timeoutRate}
              precision={2}
              suffix="%"
              prefix={<PercentageOutlined className="text-red-500" />}
              valueStyle={{ color: timeoutRate > 20 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="平均处理时长"
              value={summary?.avg_processing_hours || 0}
              precision={1}
              suffix="小时"
              prefix={<ClockCircleOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="今日新增/完成"
              value={`${summary?.today_new_tasks || 0} / ${summary?.today_completed_tasks || 0}`}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="待处理"
              value={summary?.pending_tasks || 0}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="处理中"
              value={summary?.processing_tasks || 0}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={summary?.completed_tasks || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="已超时"
              value={summary?.timeout_tasks || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={12}>
          <Card title="节点任务分布">
            <ReactECharts option={getNodeBarChart()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="任务状态分布">
            <ReactECharts option={getStatusPieChart()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="近7天任务趋势">
        <ReactECharts option={getTrendLineChart()} style={{ height: 350 }} />
      </Card>
    </div>
  );
}
