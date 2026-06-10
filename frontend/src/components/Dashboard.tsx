import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { STATUS_LABELS } from '../lib/types';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  const statCards = [
    { key: 'total', label: '全部报名单', value: stats?.total || 0, color: '#6b7280', icon: '📋' },
    { key: 'pending_verify', label: '待核验', value: stats?.pending_verify || 0, color: '#f59e0b', icon: '⏳' },
    { key: 'pending_correction', label: '待补正', value: stats?.pending_correction || 0, color: '#ef4444', icon: '⚠️' },
    { key: 'pending_review', label: '待复核', value: stats?.pending_review || 0, color: '#3b82f6', icon: '🔍' },
    { key: 'archived', label: '已归档', value: stats?.archived || 0, color: '#10b981', icon: '✅' },
    { key: 'rejected', label: '已退回', value: stats?.rejected || 0, color: '#6b7280', icon: '❌' },
  ];

  return (
    <div className="dashboard">
      <h2 className="page-title">工作台</h2>
      
      <div className="stat-grid">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="stat-card"
            style={{ borderLeftColor: card.color }}
            onClick={() => onNavigate('enrollments', { status: card.key })}
          >
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-content">
              <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-actions">
        <h3>快捷操作</h3>
        <div className="action-buttons">
          <button className="action-btn primary" onClick={() => onNavigate('create')}>
            ➕ 新建报名单
          </button>
          <button className="action-btn" onClick={() => onNavigate('enrollments', { status: 'pending_verify' })}>
            📝 处理待核验
          </button>
          <button className="action-btn" onClick={() => onNavigate('enrollments', { status: 'pending_correction' })}>
            🔧 处理待补正
          </button>
          <button className="action-btn" onClick={() => onNavigate('enrollments', { status: 'pending_review' })}>
            🔍 处理待复核
          </button>
        </div>
      </div>

      <style>{`
        .dashboard {
          padding: 24px;
        }
        .page-title {
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 24px 0;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          border-left: 4px solid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .stat-icon {
          font-size: 32px;
        }
        .stat-content { flex: 1; }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.2;
        }
        .stat-label {
          color: #6b7280;
          font-size: 14px;
          margin-top: 4px;
        }
        .quick-actions {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .quick-actions h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: #374151;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .action-btn {
          padding: 12px 20px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .action-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
        .action-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
        }
        .action-btn.primary:hover {
          opacity: 0.9;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
}
