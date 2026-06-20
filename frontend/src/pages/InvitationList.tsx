import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Badge, Input, Select, Button, Modal, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppStore } from '@/store/useAppStore';
import { getInvitations, batchAction } from '@/api/client';
import {
  Role,
  InvitationStatus,
  UrgencyLevel,
  STATUS_LABEL_MAP,
  STATUS_COLOR_MAP,
} from '@/types';
import type { Invitation } from '@/types';
import { getUrgencyFromDeadline, formatRemaining } from '@/utils/urgency';
import dayjs from 'dayjs';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: InvitationStatus.Draft, label: '草稿' },
  { value: InvitationStatus.PendingReview, label: '待审核' },
  { value: InvitationStatus.ReviewRejected, label: '审核退回' },
  { value: InvitationStatus.PendingFinal, label: '待复核' },
  { value: InvitationStatus.FinalRejected, label: '复核退回' },
  { value: InvitationStatus.Archived, label: '已归档' },
];

const URGENCY_OPTIONS = [
  { value: '', label: '全部紧急度' },
  { value: 'normal', label: '普通' },
  { value: 'urgent', label: '临期' },
  { value: 'overdue', label: '逾期' },
];

function getRoleStatusOptions(role: Role) {
  if (role === Role.Registrar) {
    return STATUS_OPTIONS.filter((o) =>
      ['', InvitationStatus.Draft, InvitationStatus.ReviewRejected, InvitationStatus.Archived].includes(o.value as InvitationStatus),
    );
  }
  if (role === Role.Reviewer) {
    return STATUS_OPTIONS.filter((o) =>
      ['', InvitationStatus.PendingReview, InvitationStatus.ReviewRejected, InvitationStatus.FinalRejected, InvitationStatus.Archived].includes(o.value as InvitationStatus),
    );
  }
  return STATUS_OPTIONS.filter((o) =>
    ['', InvitationStatus.PendingFinal, InvitationStatus.FinalRejected, InvitationStatus.Archived].includes(o.value as InvitationStatus),
  );
}

function urgencyBadgeStyle(urgency: string) {
  if (urgency === UrgencyLevel.Overdue) return { backgroundColor: '#dc2626' };
  if (urgency === UrgencyLevel.Urgent) return { backgroundColor: '#d97706' };
  return { backgroundColor: '#16a34a' };
}

const InvitationList = () => {
  const navigate = useNavigate();
  const { currentRole, currentUser } = useAppStore();
  const [data, setData] = useState<Invitation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<Record<string, unknown>>({ page: 1, pageSize: 10, role: currentRole, operatorId: currentUser.id });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const statusOptions = getRoleStatusOptions(currentRole);

  useEffect(() => {
    setParams((prev) => ({ ...prev, role: currentRole, operatorId: currentUser.id, page: 1 }));
  }, [currentRole, currentUser.id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvitations(params);
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBatchAction = async (action: string, actionLabel: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择邀约单');
      return;
    }
    Modal.confirm({
      title: `确认${actionLabel}`,
      content: `确定要对选中的 ${selectedRowKeys.length} 条记录执行"${actionLabel}"操作吗？`,
      onOk: async () => {
        try {
          const result = await batchAction({
            ids: selectedRowKeys,
            action,
            operatorId: currentUser.id,
            operatorRole: currentRole,
            comment: `批量${actionLabel}`,
          });
          message.success(`成功处理 ${result.success?.length ?? 0} 条`);
          if (result.failed?.length > 0) {
            Modal.error({
              title: '部分处理失败',
              content: (
                <div>
                  {result.failed.map((f: { id: string; reason: string }) => (
                    <div key={f.id}>
                      {f.id.slice(0, 8)}: {f.reason}
                    </div>
                  ))}
                </div>
              ),
            });
          }
          setSelectedRowKeys([]);
          fetchData();
        } catch {
          // handled by interceptor
        }
      },
    });
  };

  const columns: ColumnsType<Invitation> = [
    {
      title: '单号',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <a className="font-mono" onClick={() => navigate(`/invitations/${id}`)}>{id.slice(0, 8)}</a>
      ),
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '媒体类型', dataIndex: 'mediaType', key: 'mediaType', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLOR_MAP[status]}>{STATUS_LABEL_MAP[status]}</Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '剩余时间',
      key: 'remaining',
      width: 120,
      render: (_: unknown, record: Invitation) => {
        const urgency = getUrgencyFromDeadline(record.deadline);
        return (
          <Badge
            count={formatRemaining(record.deadline)}
            style={urgencyBadgeStyle(urgency)}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: Invitation) => (
        <Button type="link" size="small" onClick={() => navigate(`/invitations/${record.id}`)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-white p-4 rounded-lg">
        <Select
          value={(params.status as string) || ''}
          options={statusOptions}
          onChange={(val) => setParams({ ...params, status: val || undefined, page: 1 })}
          style={{ width: 140 }}
        />
        <Select
          value={(params.urgency as string) || ''}
          options={URGENCY_OPTIONS}
          onChange={(val) => setParams({ ...params, urgency: val || undefined, page: 1 })}
          style={{ width: 140 }}
        />
        <Input.Search
          placeholder="搜索关键词"
          allowClear
          onSearch={(val) => setParams({ ...params, keyword: val || undefined, page: 1 })}
          style={{ width: 240 }}
        />
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as string[]) }}
        pagination={{
          current: params.page as number,
          pageSize: params.pageSize as number,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (page, pageSize) => setParams({ ...params, page, pageSize }),
        }}
      />

      {selectedRowKeys.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-lg px-6 py-3 flex items-center gap-4 border z-50">
          <span>已选择 {selectedRowKeys.length} 项</span>
          {currentRole === Role.Reviewer && (
            <>
              <Button type="primary" onClick={() => handleBatchAction('approve', '批量通过')}>
                批量通过
              </Button>
              <Button danger onClick={() => handleBatchAction('reject', '批量退回')}>
                批量退回
              </Button>
              <Button onClick={() => handleBatchAction('reprocess', '批量重新办理')}>
                批量重新办理
              </Button>
            </>
          )}
          {currentRole === Role.FinalReviewer && (
            <>
              <Button type="primary" onClick={() => handleBatchAction('review', '批量归档')}>
                批量归档
              </Button>
              <Button danger onClick={() => handleBatchAction('review-reject', '批量退回审核')}>
                批量退回审核
              </Button>
            </>
          )}
          <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
        </div>
      )}
    </div>
  );
};

export default InvitationList;
