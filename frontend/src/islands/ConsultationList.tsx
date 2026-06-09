import { useState, useEffect } from 'react';
import { getConsultations, getStatusDict } from '../lib/api';
import { formatDate } from '../lib/types';

export default function ConsultationList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusDict, setStatusDict] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getConsultations(statusFilter || undefined);
      let list = res.data || [];
      if (keyword) {
        const kw = keyword.toLowerCase();
        list = list.filter(
          (item) =>
            item.title.toLowerCase().includes(kw) ||
            item.patient_name.toLowerCase().includes(kw) ||
            item.patient_id.toLowerCase().includes(kw)
        );
      }
      setItems(list);
    } catch (err) {
      console.error('加载列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDict = async () => {
    try {
      const data = await getStatusDict();
      setStatusDict(data);
    } catch (err) {
      console.error('加载字典失败', err);
    }
  };

  useEffect(() => {
    loadData();
    loadDict();
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      const statusMap: Record<string, string> = {
        pending: 'submitted',
        appeal: 'appeal_submitted',
        archived: 'archived',
      };
      setStatusFilter(statusMap[statusParam] || statusParam);
    }
    const handleUserChange = () => loadData();
    window.addEventListener('userChanged', handleUserChange);
    return () => window.removeEventListener('userChanged', handleUserChange);
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const goToDetail = (id: string) => {
    window.location.href = `/consultation?id=${id}`;
  };

  const goToCreate = () => {
    window.location.href = '/create';
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">申请单列表</div>
        <button className="btn btn-primary btn-sm" onClick={goToCreate}>
          ➕ 新建申请
        </button>
      </div>
      <div className="card-body">
        <div className="filter-bar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">全部状态</option>
            {statusDict.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="搜索标题、患者姓名、患者ID"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadData();
            }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button className="btn btn-sm" onClick={loadData}>
            🔍 搜索
          </button>
          <button className="btn btn-sm" onClick={() => {
            setStatusFilter('');
            setKeyword('');
            setTimeout(loadData, 0);
          }}>
            重置
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>加载中...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div>暂无申请单</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>申请单编号</th>
                <th>申请标题</th>
                <th>患者信息</th>
                <th>申请科室</th>
                <th>会诊类型</th>
                <th>状态</th>
                <th>登记人</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="list-item" onClick={() => goToDetail(item.id)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.id}</td>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td>
                    <div>{item.patient_name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{item.patient_id}</div>
                  </td>
                  <td>{item.dept}</td>
                  <td>{item.consult_type}</td>
                  <td>
                    <span className={`status-tag status-${item.status}`}>
                      {item.status_name}
                    </span>
                    {item.is_overdue && (
                      <span className="status-tag status-overdue" style={{ marginLeft: 4 }}>
                        逾期
                      </span>
                    )}
                  </td>
                  <td>{item.registrar_name}</td>
                  <td style={{ color: '#6b7280', fontSize: '12px' }}>
                    {formatDate(item.updated_at)}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToDetail(item.id);
                        }}
                      >
                        查看
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 12, textAlign: 'right', color: '#6b7280', fontSize: '13px' }}>
          共 {items.length} 条记录
        </div>
      </div>
    </div>
  );
}
