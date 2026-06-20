import { useState, useEffect, useCallback } from 'react';
import { Table, Input, Select, DatePicker, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getAuditLogs } from '@/api/client';
import { ROLE_LABEL_MAP, Role } from '@/types';
import type { AuditLog } from '@/types';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const ACTION_OPTIONS = [
  { value: '', label: '全部动作' },
  { value: 'create', label: '创建' },
  { value: 'submit', label: '提交' },
  { value: 'approve', label: '审核通过' },
  { value: 'reject', label: '退回' },
  { value: 'review', label: '复核归档' },
  { value: 'review-reject', label: '复核退回' },
  { value: 'guest_confirm', label: '嘉宾确认' },
  { value: 'checkin_feedback', label: '签到反馈' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  review_rejected: '审核退回',
  pending_final: '待复核',
  final_rejected: '复核退回',
  archived: '已归档',
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  submit: '提交',
  approve: '审核通过',
  reject: '退回补正',
  review: '复核归档',
  'review-reject': '复核退回',
  guest_confirm: '嘉宾确认',
  checkin_feedback: '签到反馈',
};

const Audit = () => {
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({ page: 1, pageSize: 10 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '邀约单号',
      dataIndex: 'invitationId',
      key: 'invitationId',
      width: 120,
      render: (v: string) => v.slice(0, 8),
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 100,
    },
    {
      title: '岗位',
      dataIndex: 'operatorRole',
      key: 'operatorRole',
      width: 100,
      render: (v: string) => ROLE_LABEL_MAP[v as Role] || v,
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (v: string) => <Tag color="blue">{ACTION_LABELS[v] || v}</Tag>,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: '状态变更',
      key: 'statusChange',
      width: 200,
      render: (_: unknown, record: AuditLog) => (
        <span className="text-sm">
          <Tag>{STATUS_LABELS[record.beforeStatus ?? ''] || record.beforeStatus || '-'}</Tag>
          <span className="mx-1">→</span>
          <Tag color="blue">{STATUS_LABELS[record.afterStatus ?? ''] || record.afterStatus || '-'}</Tag>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white p-4 rounded-lg flex-wrap">
        <Input
          placeholder="邀约单号"
          allowClear
          style={{ width: 160 }}
          onChange={(e) => setParams({ ...params, invitationId: e.target.value || undefined, page: 1 })}
        />
        <Input
          placeholder="操作人"
          allowClear
          style={{ width: 120 }}
          onChange={(e) => setParams({ ...params, operatorName: e.target.value || undefined, page: 1 })}
        />
        <Select
          value={params.action || ''}
          options={ACTION_OPTIONS}
          onChange={(val) => setParams({ ...params, action: val || undefined, page: 1 })}
          style={{ width: 140 }}
        />
        <RangePicker
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setParams({
                ...params,
                startDate: dates[0].format('YYYY-MM-DD'),
                endDate: dates[1].format('YYYY-MM-DD'),
                page: 1,
              });
            } else {
              setParams({ ...params, startDate: undefined, endDate: undefined, page: 1 });
            }
          }}
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setParams({ ...params, page, pageSize }),
        }}
      />
    </div>
  );
};

export default Audit;
