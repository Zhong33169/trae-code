import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Badge, Button, Spin } from 'antd';
import { Clock, AlertTriangle, CheckCircle, FileSearch } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getStats, getInvitations } from '@/api/client';
import { Role, InvitationStatus, UrgencyLevel, STATUS_LABEL_MAP, STATUS_COLOR_MAP } from '@/types';
import type { Stats, Invitation, UrgencyLevel as UrgencyLevelType } from '@/types';
import dayjs from 'dayjs';

function getRemainingHours(deadline: string): number {
  return dayjs(deadline).diff(dayjs(), 'hour');
}

function getUrgencyFromDeadline(deadline: string): UrgencyLevelType {
  const hours = getRemainingHours(deadline);
  if (hours <= 0) return UrgencyLevel.Overdue;
  if (hours <= 72) return UrgencyLevel.Urgent;
  return UrgencyLevel.Normal;
}

function formatRemaining(deadline: string): string {
  const hours = getRemainingHours(deadline);
  if (hours <= 0) return `已逾期 ${Math.abs(hours)}h`;
  return `剩余 ${hours}h`;
}

function urgencyBadgeColor(urgency: UrgencyLevelType): string {
  if (urgency === UrgencyLevel.Overdue) return '#dc2626';
  if (urgency === UrgencyLevel.Urgent) return '#d97706';
  return '#16a34a';
}

const Home = () => {
  const navigate = useNavigate();
  const { currentRole, currentUser } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [overdueItems, setOverdueItems] = useState<Invitation[]>([]);
  const [urgentItems, setUrgentItems] = useState<Invitation[]>([]);
  const [normalItems, setNormalItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [currentRole]);

  useEffect(() => {
    const onConflict = () => fetchData();
    window.addEventListener('version-conflict', onConflict);
    return () => window.removeEventListener('version-conflict', onConflict);
  }, [currentRole]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, overdueData, urgentData, normalData] = await Promise.all([
        getStats({ role: currentRole, operatorId: currentUser.id }),
        getInvitations({ page: 1, pageSize: 20, urgency: 'overdue', role: currentRole, operatorId: currentUser.id }),
        getInvitations({ page: 1, pageSize: 20, urgency: 'urgent', role: currentRole, operatorId: currentUser.id }),
        getInvitations({ page: 1, pageSize: 20, urgency: 'normal', role: currentRole, operatorId: currentUser.id }),
      ]);
      setStats(statsData);
      setOverdueItems(overdueData.items || []);
      setUrgentItems(urgentData.items || []);
      setNormalItems(normalData.items || []);
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  const pendingReview = stats?.byStatus?.['pending_review'] ?? 0;
  const pendingFinal = stats?.byStatus?.['pending_final'] ?? 0;
  const urgent = stats?.byUrgency?.['urgent'] ?? 0;
  const overdue = stats?.byUrgency?.['overdue'] ?? 0;

  const statCards = [
    { key: 'pendingReview', label: '待审核', value: pendingReview, icon: <FileSearch size={24} />, bg: '#1e3a5f' },
    { key: 'pendingFinal', label: '待复核', value: pendingFinal, icon: <CheckCircle size={24} />, bg: '#2a5082' },
    { key: 'urgent', label: '临期', value: urgent, icon: <AlertTriangle size={24} />, bg: '#d97706' },
    { key: 'overdue', label: '逾期', value: overdue, icon: <Clock size={24} />, bg: '#dc2626' },
  ];

  const renderItem = (item: Invitation, bgColor?: string) => {
    const urgency = item.urgency;
    return (
      <div
        key={item.id}
        className="flex items-center justify-between p-3 mb-2 rounded cursor-pointer hover:opacity-80"
        style={{ background: bgColor || '#fff', border: '1px solid #e5e7eb' }}
        onClick={() => navigate(`/invitations/${item.id}`)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-sm font-mono text-gray-600 shrink-0">{item.id.slice(0, 8)}</span>
          <span className="text-sm truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            count={formatRemaining(item.deadline)}
            style={{ backgroundColor: urgencyBadgeColor(urgency) }}
          />
          <Tag color={STATUS_COLOR_MAP[item.status]}>{STATUS_LABEL_MAP[item.status]}</Tag>
        </div>
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.key} styles={{ body: { padding: 20 } }}>
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-lg text-white"
                  style={{ background: card.bg }}
                >
                  {card.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-gray-500 text-sm">{card.label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/invitations')}
          >
            发起邀约单
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card
            title={
              <span className="text-red-600 font-bold">
                🔴 逾期待办 ({overdueItems.length})
              </span>
            }
            styles={{ body: { background: '#fef2f2', padding: 12 } }}
          >
            {overdueItems.length === 0 ? (
              <div className="text-center text-gray-400 py-4">暂无逾期事项</div>
            ) : (
              overdueItems.map((item) => renderItem(item, '#fee2e2'))
            )}
          </Card>

          <Card
            title={
              <span className="text-amber-600 font-bold">
                🟡 临期待办 ({urgentItems.length})
              </span>
            }
            styles={{ body: { background: '#fffbeb', padding: 12 } }}
          >
            {urgentItems.length === 0 ? (
              <div className="text-center text-gray-400 py-4">暂无临期事项</div>
            ) : (
              urgentItems.map((item) => renderItem(item, '#fef3c7'))
            )}
          </Card>

          <Card
            title={
              <span className="text-gray-700 font-bold">
                📋 普通待办 ({normalItems.length})
              </span>
            }
            styles={{ body: { padding: 12 } }}
          >
            {normalItems.length === 0 ? (
              <div className="text-center text-gray-400 py-4">暂无待办事项</div>
            ) : (
              normalItems.map((item) => renderItem(item))
            )}
          </Card>
        </div>
      </div>
    </Spin>
  );
};

export default Home;
