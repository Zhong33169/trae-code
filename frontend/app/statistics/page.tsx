'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, DatePicker, Button, Space } from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  PercentageOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '@/lib/api';
import { StatisticsData, ApiResponse, NODE_LABELS, STATUS_LABELS } from '@/types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, [dateRange]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (dateRange) {
        params.startDate = dateRange[0];
        params.endDate = dateRange[1];
      }
      const response = await api.get<ApiResponse<StatisticsData>>('/statistics', { params });
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
    } else {
      setDateRange(null);
    }
  };

  const handleReset = () => {
    setDateRange(null);
  };

  const getNodeBarChart = () => {
    if (!data) return {};
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: data.taskCountByNode.map((item) => NODE_LABELS[item.node as keyof typeof NODE_LABELS] || item.node),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '任务数',
          type: 'bar',
          data: data.taskCountByNode.map((item) => item.count),
          itemStyle: {
            color: (params: any) => {
              const colors = ['#1677ff', '#13c2c2', '#722ed1', '#52c41a'];
              return colors[params.dataIndex % colors.length];
            },
          },
        },
      ],
    };
  };

  const getStatusPieChart = () => {
    if (!data) return {};
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
          data: data.taskCountByStatus.map((item) => ({
            value: item.count,
            name: STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] || item.status,
          })),
          color: ['#1677ff', '#52c41a', '#ff4d4f', '#fa8c16', '#8c8c8c', '#722ed1'],
        },
      ],
    };
  };

  const getTrendLineChart = () => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['任务数量'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.taskTrend.map((item) => item.date),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '任务数量',
          type: 'line',
          smooth: true,
          data: data.taskTrend.map((item) => item.count),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22, 119, 255, 0.5)' },
                { offset: 1, color: 'rgba(22, 119, 255, 0.05)' },
              ],
            },
          },
          lineStyle: { color: '#1677ff', width: 2 },
          itemStyle: { color: '#1677ff' },
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
          <RangePicker
            value={
              dateRange
                ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                : undefined
            }
            onChange={handleDateChange}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={8}>
          <Card size="small">
            <Statistic
              title="超时率"
              value={data?.timeoutRate || 0}
              precision={2}
              suffix="%"
              prefix={<PercentageOutlined className="text-red-500" />}
              valueStyle={{ color: data && data.timeoutRate > 20 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small">
            <Statistic
              title="平均处理时长"
              value={data?.avgProcessingTime || 0}
              precision={1}
              suffix="小时"
              prefix={<ClockCircleOutlined className="text-blue-500" />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card size="small">
            <Statistic
              title="总任务数"
              value={
                data?.taskCountByNode.reduce((sum, item) => sum + item.count, 0) || 0
              }
              prefix={<BarChartOutlined className="text-purple-500" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={12}>
          <Card title="各节点任务分布">
            <ReactECharts option={getNodeBarChart()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="任务状态分布">
            <ReactECharts option={getStatusPieChart()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Card title="任务趋势">
        <ReactECharts option={getTrendLineChart()} style={{ height: 350 }} />
      </Card>
    </div>
  );
}
