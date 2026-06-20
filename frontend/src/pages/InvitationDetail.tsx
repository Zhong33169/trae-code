import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Tag, Badge, Button, Input, Switch, message, Spin, Select } from 'antd';
import { useAppStore } from '@/store/useAppStore';
import {
  getInvitation,
  submitInvitation,
  approveInvitation,
  rejectInvitation,
  reviewInvitation,
  reviewRejectInvitation,
  reprocessInvitation,
  guestConfirm,
  checkinFeedback,
  getAuditLogs,
  updateInvitation,
} from '@/api/client';
import {
  Role,
  InvitationStatus,
  STATUS_LABEL_MAP,
  STATUS_COLOR_MAP,
} from '@/types';
import type { Invitation, AuditLog } from '@/types';
import { getUrgencyFromDeadline, formatRemaining } from '@/utils/urgency';
import MaterialsSection from '@/components/MaterialsSection';
import ProcessingOpinion from '@/components/ProcessingOpinion';
import AuditTimeline from '@/components/AuditTimeline';
import dayjs from 'dayjs';

const MEDIA_TYPE_OPTIONS = [
  { value: '电视', label: '电视' },
  { value: '报纸', label: '报纸' },
  { value: '网络', label: '网络' },
  { value: '自媒体', label: '自媒体' },
  { value: '其他', label: '其他' },
];

const InvitationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRole, currentUser } = useAppStore();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState('');
  const [editFields, setEditFields] = useState<Record<string, unknown>>({});
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const invData = await getInvitation(id);
      setInvitation(invData);
      const logsData = await getAuditLogs({ invitationId: id, page: 1, pageSize: 50 });
      setLogs(logsData.items || []);
      setEditFields({});
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onConflict = () => fetchData();
    window.addEventListener('version-conflict', onConflict);
    return () => window.removeEventListener('version-conflict', onConflict);
  }, [fetchData]);

  if (!invitation) {
    return <Spin spinning={loading} className="flex justify-center py-20" />;
  }

  const urgency = getUrgencyFromDeadline(invitation.deadline);

  const canEdit =
    currentRole === Role.Registrar &&
    (invitation.status === InvitationStatus.Draft || invitation.status === InvitationStatus.ReviewRejected);

  const bannerBg =
    urgency === 'overdue'
      ? '#dc2626'
      : urgency === 'urgent'
        ? '#d97706'
        : '#16a34a';

  const operatorContext = { operatorId: currentUser.id, operatorRole: currentRole };

  const handleAction = async (actionFn: (id: string, data: Record<string, unknown>) => Promise<unknown>, data: Record<string, unknown>, label: string) => {
    setActionLoading(true);
    try {
      await actionFn(invitation.id, { ...operatorContext, ...data, expectedVersion: invitation.version });
      message.success(`${label}成功`);
      fetchData();
      setOpinion('');
    } catch {
      // handled by interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!canEdit) return;
    setActionLoading(true);
    try {
      await updateInvitation(invitation.id, { ...editFields, ...operatorContext, expectedVersion: invitation.version });
      message.success('保存成功');
      fetchData();
    } catch {
      // handled by interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleGuestConfirm = async (confirmed: boolean) => {
    if (currentRole !== Role.Reviewer || invitation.status !== InvitationStatus.PendingReview) return;
    setActionLoading(true);
    try {
      await guestConfirm(invitation.id, { ...operatorContext, confirmed, expectedVersion: invitation.version });
      message.success(confirmed ? '已确认嘉宾出席' : '已取消嘉宾确认');
      fetchData();
    } catch {
      // handled by interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckinFeedback = async (completed: boolean) => {
    if (currentRole !== Role.FinalReviewer || invitation.status !== InvitationStatus.PendingFinal) return;
    setActionLoading(true);
    try {
      await checkinFeedback(invitation.id, { ...operatorContext, completed, expectedVersion: invitation.version });
      message.success(completed ? '已确认签到反馈' : '已取消签到确认');
      fetchData();
    } catch {
      // handled by interceptor
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!opinion.trim()) {
      message.warning('请输入处理意见');
      return;
    }
    handleAction(submitInvitation, {}, invitation.status === InvitationStatus.Draft ? '提交审核' : '重新提交');
  };

  const handleApprove = () => {
    if (!opinion.trim()) {
      message.warning('请输入处理意见');
      return;
    }
    if (!invitation.guestConfirmed) {
      message.warning('嘉宾未确认，无法审核通过');
      return;
    }
    if (!invitation.materialsComplete) {
      message.warning('材料不完整，无法审核通过');
      return;
    }
    handleAction(approveInvitation, { reviewComment: opinion.trim(), guestConfirmed: invitation.guestConfirmed }, '审核通过');
  };

  const handleReject = () => {
    if (!opinion.trim()) {
      message.warning('请输入退回原因');
      return;
    }
    handleAction(rejectInvitation, { reviewComment: opinion.trim() }, '退回补正');
  };

  const handleReview = () => {
    if (!opinion.trim()) {
      message.warning('请输入处理意见');
      return;
    }
    if (!invitation.guestConfirmed) {
      message.warning('嘉宾未确认，无法归档');
      return;
    }
    if (!invitation.checkinCompleted) {
      message.warning('签到未完成，无法归档');
      return;
    }
    if (!invitation.materialsComplete) {
      message.warning('材料不完整，无法归档');
      return;
    }
    handleAction(reviewInvitation, { finalComment: opinion.trim(), checkinCompleted: invitation.checkinCompleted }, '复核归档');
  };

  const handleReviewReject = () => {
    if (!opinion.trim()) {
      message.warning('请输入退回原因');
      return;
    }
    handleAction(reviewRejectInvitation, { finalComment: opinion.trim() }, '退回审核');
  };

  const handleReprocess = () => {
    if (!opinion.trim()) {
      message.warning('请输入处理意见');
      return;
    }
    if (!invitation?.guestConfirmed) {
      message.warning('嘉宾未确认，无法重新办理');
      return;
    }
    if (!invitation?.materialsComplete) {
      message.warning('材料不完整，无法重新办理');
      return;
    }
    handleAction(reprocessInvitation, { reviewComment: opinion.trim(), guestConfirmed: invitation.guestConfirmed }, '重新办理');
  };

  const canApprove = invitation.status === InvitationStatus.PendingReview && currentRole === Role.Reviewer;
  const canReject = invitation.status === InvitationStatus.PendingReview && currentRole === Role.Reviewer;
  const canReview = invitation.status === InvitationStatus.PendingFinal && currentRole === Role.FinalReviewer;
  const canReviewReject = invitation.status === InvitationStatus.PendingFinal && currentRole === Role.FinalReviewer;
  const canSubmit = (invitation.status === InvitationStatus.Draft || invitation.status === InvitationStatus.ReviewRejected) && currentRole === Role.Registrar;
  const canReprocess = invitation.status === InvitationStatus.FinalRejected && currentRole === Role.Reviewer;

  return (
    <Spin spinning={loading}>
      <div className="space-y-4">
        <div
          className={`p-4 rounded-lg text-white ${urgency === 'overdue' ? 'animate-pulse-urgent' : ''}`}
          style={{ background: bannerBg }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold">
                {urgency === 'overdue' ? '⚠️ 已逾期' : urgency === 'urgent' ? '⏰ 临期提醒' : '✅ 正常'}
              </span>
              <span className="ml-4 text-sm opacity-90">
                截止时间: {dayjs(invitation.deadline).format('YYYY-MM-DD HH:mm')}
              </span>
            </div>
            <Badge
              count={formatRemaining(invitation.deadline)}
              style={{ backgroundColor: '#fff', color: bannerBg }}
            />
          </div>
        </div>

        <Card title="基本信息">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="单号">{invitation.id.slice(0, 8)}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_COLOR_MAP[invitation.status]}>
                {STATUS_LABEL_MAP[invitation.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标题">
              {canEdit ? (
                <Input
                  value={(editFields.title as string) ?? invitation.title}
                  onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
                  size="small"
                />
              ) : (
                invitation.title
              )}
            </Descriptions.Item>
            <Descriptions.Item label="媒体类型">
              {canEdit ? (
                <Select
                  value={(editFields.mediaType as string) ?? invitation.mediaType}
                  onChange={(val) => setEditFields({ ...editFields, mediaType: val })}
                  options={MEDIA_TYPE_OPTIONS}
                  size="small"
                  style={{ width: '100%' }}
                />
              ) : (
                invitation.mediaType
              )}
            </Descriptions.Item>
            <Descriptions.Item label="活动名称">
              {canEdit ? (
                <Input
                  value={(editFields.eventName as string) ?? invitation.eventName}
                  onChange={(e) => setEditFields({ ...editFields, eventName: e.target.value })}
                  size="small"
                />
              ) : (
                invitation.eventName
              )}
            </Descriptions.Item>
            <Descriptions.Item label="活动日期">
              {canEdit ? (
                <Input
                  type="date"
                  value={(editFields.eventDate as string) ?? invitation.eventDate}
                  onChange={(e) => setEditFields({ ...editFields, eventDate: e.target.value })}
                  size="small"
                />
              ) : (
                dayjs(invitation.eventDate).format('YYYY-MM-DD')
              )}
            </Descriptions.Item>
            <Descriptions.Item label="活动地点">
              {canEdit ? (
                <Input
                  value={(editFields.eventLocation as string) ?? invitation.eventLocation}
                  onChange={(e) => setEditFields({ ...editFields, eventLocation: e.target.value })}
                  size="small"
                />
              ) : (
                invitation.eventLocation
              )}
            </Descriptions.Item>
            <Descriptions.Item label="截止时间">
              {canEdit ? (
                <Input
                  type="datetime-local"
                  value={(editFields.deadline as string) ?? invitation.deadline}
                  onChange={(e) => setEditFields({ ...editFields, deadline: e.target.value })}
                  size="small"
                />
              ) : (
                dayjs(invitation.deadline).format('YYYY-MM-DD HH:mm')
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">{invitation.creatorName}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(invitation.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          </Descriptions>
          {canEdit && (
            <div className="mt-3 flex justify-end">
              <Button onClick={handleSaveDraft} loading={actionLoading}>保存修改</Button>
            </div>
          )}
        </Card>

        <Card title="材料附件">
          <div className="flex items-center justify-between mb-3">
            <span>材料完整性：</span>
            <Badge
              status={invitation.materialsComplete ? 'success' : 'warning'}
              text={invitation.materialsComplete ? '材料齐全' : '材料不完整'}
            />
          </div>
          <MaterialsSection
            invitationId={invitation.id}
            materials={invitation.materials || []}
            canUpload={canEdit}
            operatorId={currentUser.id}
            version={invitation.version}
            onUploaded={fetchData}
          />
        </Card>

        <Card title="嘉宾确认">
          <div className="flex items-center justify-between">
            <div>
              <Badge
                status={invitation.guestConfirmed ? 'success' : 'default'}
                text={invitation.guestConfirmed ? '已确认出席' : '未确认'}
              />
            </div>
            {currentRole === Role.Reviewer && invitation.status === InvitationStatus.PendingReview && (
              <Switch
                checked={invitation.guestConfirmed}
                onChange={handleGuestConfirm}
                checkedChildren="已确认"
                unCheckedChildren="未确认"
              />
            )}
          </div>
        </Card>

        <Card title="签到反馈">
          <div className="flex items-center justify-between">
            <div>
              <Badge
                status={invitation.checkinCompleted ? 'success' : 'default'}
                text={invitation.checkinCompleted ? '已签到反馈' : '未反馈'}
              />
            </div>
            {currentRole === Role.FinalReviewer && invitation.status === InvitationStatus.PendingFinal && (
              <Switch
                checked={invitation.checkinCompleted}
                onChange={handleCheckinFeedback}
                checkedChildren="已反馈"
                unCheckedChildren="未反馈"
              />
            )}
          </div>
        </Card>

        <Card title="操作区域">
          <div className="space-y-4">
            <ProcessingOpinion value={opinion} onChange={setOpinion} />
            <div className="flex items-center gap-3 flex-wrap">
              {canSubmit && (
                <Button
                  type="primary"
                  loading={actionLoading}
                  onClick={handleSubmit}
                >
                  {invitation.status === InvitationStatus.Draft ? '提交审核' : '重新提交'}
                </Button>
              )}
              {canApprove && (
                <Button
                  type="primary"
                  loading={actionLoading}
                  onClick={handleApprove}
                  disabled={!invitation.guestConfirmed || !invitation.materialsComplete}
                >
                  审核通过
                </Button>
              )}
              {canReject && (
                <Button
                  danger
                  loading={actionLoading}
                  onClick={handleReject}
                >
                  退回补正
                </Button>
              )}
              {canReview && (
                <Button
                  type="primary"
                  loading={actionLoading}
                  onClick={handleReview}
                  disabled={!invitation.guestConfirmed || !invitation.checkinCompleted || !invitation.materialsComplete}
                >
                  复核归档
                </Button>
              )}
              {canReviewReject && (
                <Button
                  danger
                  loading={actionLoading}
                  onClick={handleReviewReject}
                >
                  退回审核
                </Button>
              )}
              {canReprocess && (
                <Button
                  type="primary"
                  loading={actionLoading}
                  onClick={handleReprocess}
                  disabled={!invitation.guestConfirmed || !invitation.materialsComplete}
                >
                  重新办理
                </Button>
              )}
              <Button onClick={() => navigate('/invitations')}>返回列表</Button>
            </div>
          </div>
        </Card>

        <AuditTimeline logs={logs} />
      </div>
    </Spin>
  );
};

export default InvitationDetail;
