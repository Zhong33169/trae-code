import { useState, useEffect } from 'react';
import { getConsultations } from '../lib/api';
import { formatDate } from '../lib/types';

interface Props {
  title: string;
  type: 'recent' | 'todo';
}

export default function RecentList({ title, type }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getConsultations();
      let list = res.data || [];
      if (type === 'recent') {
        list = list.slice(0, 6);
      } else if (type === 'todo') {
        const todoStatuses = ['submitted', 'resubmitted', 'correction_requested', 'evidence_missing', 'review_passed', 'under_final_review', 'appeal_submitted', 'status_conflict'];
        list = list.filter(item => todoStatuses.includes(item.status)).slice(0, 6);
      }
      setItems(list);
    } catch (err) {
      console.error('加载失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUserChange = () => loadData();
    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, [type]);

  const goToDetail = (id: string) => {
    window.location.href = `/consultation?id=${id}`;
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <a href="/consultations" className="btn btn-sm">查看全部</a>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div>暂无数据</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>申请单</th>
                <th>状态</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="list-item" onClick={() => goToDetail(item.id)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.patient_name} · {item.dept}</div>
                  </td>
                  <td>
                    <span className={`status-tag status-${item.status}`}>
                      {item.status_name}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280', fontSize: '12px' }}>
                    {formatDate(item.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
