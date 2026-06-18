'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Select,
  Input,
  Button,
  Space,
  message,
  Tooltip,
} from 'antd';
import {
  HistoryOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { logsApi } from '@/services/api';
import { useAuthStore } from '@/store';
import type { OperationLog } from '@/types';
import { STATUS_COLORS } from '@/types';

export default function LogsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState({
    operation: undefined as string | undefined,
    operator_role: undefined as string | undefined,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await logsApi.getLogs({
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
      });

      let filtered = result.items;
      if (filters.operation) {
        filtered = filtered.filter((l: any) => l.operation === filters.operation);
      }
      if (filters.operator_role) {
        filtered = filtered.filter((l: any) => {
          const roleMap: Record<string, string> = {
            '科室秘书': 'DEPARTMENT_SECRETARY',
            '质控医生': 'QUALITY_DOCTOR',
            '医务部主任': 'MEDICAL_DIRECTOR',
          };
          return l.operator_role === filters.operator_role ||
            roleMap[l.operator_role] === filters.operator_role;
        });
      }

      setLogs(filtered);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [pagination]);

  const handleSearch = () => {
    setPagination((p) => ({ ...p, current: 1 }));
    fetchData();
  };

  const handleReset = () => {
    setFilters({ operation: undefined, operator_role: undefined });
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const operationOptions = [
    { value: 'CREATE', label: '创建整改单' },
    { value: 'SUBMIT', label: '提交整改单' },
    { value: 'APPROVE_QUALITY', label: '质控审核通过' },
    { value: 'REJECT', label: '退回整改单' },
    { value: 'RESUBMIT', label: '重新提交' },
    { value: 'SEND_NOTICE', label: '发送整改通知' },
    { value: 'COMPLETE_RECTIFICATION', label: '完成整改' },
    { value: 'APPROVE_ARCHIVE', label: '复核通过归档' },
    { value: 'REJECT_RECTIFICATION', label: '退回重新整改' },
    { value: 'CONFIRM', label: '医务部确认' },
  ];

  const roleOptions = [
    { value: 'DEPARTMENT_SECRETARY', label: '科室秘书' },
    { value: 'QUALITY_DOCTOR', label: '质控医生' },
    { value: 'MEDICAL_DIRECTOR', label: '医务部主任' },
  ];

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      fixed: 'left' as const,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: any, b: any) =>
        dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
    },
    {
      title: '整改单号',
      dataIndex: 'order_no',
      key: 'order_no',
      width: 130,
      render: (text: string, record: any) => (
        text ? (
          <Link href={`/orders/${record.order_id}`} style={{ color: '#1677ff' }}>
            {text}
          </Link>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      ),
    },
    {
      title: '操作人',
      key: 'operator',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <UserOutlined />
          <span>{record.operator_name}</span>
          <Tag color="blue">{record.operator_role}</Tag>
        </Space>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'operation_cn',
      key: 'operation_cn',
      width: 140,
      render: (text: string, record: any) => (
        <Tag color={record.operation.includes('REJECT') ? 'red' : 'blue'}>
          {text}
        </Tag>
      ),
    },
    {
      title: '状态变更',
      key: 'status',
      width: 200,
      render: (_: any, record: any) => {
        if (!record.old_status && !record.new_status) {
          return <span style={{ color: '#999' }}>无</span>;
        }
        return (
          <Space size={4}>
            {record.old_status_cn && (
              <Tag color={STATUS_COLORS[record.old_status]}>
                {record.old_status_cn}
              </Tag>
            )}
            {record.old_status && <span style={{ color: '#999' }}>→</span>}
            {record.new_status_cn && (
              <Tag color={STATUS_COLORS[record.new_status]}>
                {record.new_status_cn}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '附加信息',
      key: 'extra',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        if (!record.extra_data) return null;
        const data = record.extra_data;
        const hasContent = Object.values(data).some(
          (v) => v !== null && v !== undefined && v !== ''
        );
        if (!hasContent) return <span style={{ color: '#999' }}>-</span>;

        return (
          <Tooltip
            title={
              <div style={{ maxWidth: 300 }}>
                {Object.entries(data).map(([key, value]) => {
                  if (value === null || value === undefined || value === '') return null;
                  return (
                    <div key={key} style={{ marginBottom: 4, wordBreak: 'break-all' }}>
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  );
                })}
              </div>
            }
          >
            <Button type="link" size="small">
              查看详情
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <HistoryOutlined /> 操作日志
      </h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]}>
          <Select
            placeholder="操作类型"
            style={{ width: 180 }}
            value={filters.operation}
            onChange={(v) => setFilters({ ...filters, operation: v })}
            allowClear
            options={operationOptions}
          />
          <Select
            placeholder="操作人角色"
            style={{ width: 150 }}
            value={filters.operator_role}
            onChange={(v) => setFilters({ ...filters, operator_role: v })}
            allowClear
            options={roleOptions}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条记录`,
          }}
          onChange={(newPagination) => setPagination(newPagination)}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}
