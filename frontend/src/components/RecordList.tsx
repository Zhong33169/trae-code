import React from 'react';
import { FollowUpRecord, STATUS_NAMES, STATUS_COLORS } from '../types';
import './RecordList.css';

interface RecordListProps {
  records: FollowUpRecord[];
  selectedIds: number[];
  onSelectChange: (ids: number[]) => void;
  onRecordClick: (record: FollowUpRecord) => void;
  loading: boolean;
}

const RecordList: React.FC<RecordListProps> = ({
  records,
  selectedIds,
  onSelectChange,
  onRecordClick,
  loading,
}) => {
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectChange(records.map(r => r.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>, id: number) => {
    e.stopPropagation();
    if (e.target.checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter(i => i !== id));
    }
  };

  const hasEvidence = (record: FollowUpRecord) => {
    return record.appointment_id && record.visit_id && record.follow_up_visit_id;
  };

  if (loading) {
    return (
      <div className="record-list-loading">
        <div className="loading-spinner"></div>
        <span>加载中...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="record-list-empty">
        暂无随访记录
      </div>
    );
  }

  return (
    <div className="record-list">
      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}>
              <input
                type="checkbox"
                checked={records.length > 0 && selectedIds.length === records.length}
                onChange={handleSelectAll}
              />
            </th>
            <th style={{ width: '140px' }}>记录编号</th>
            <th>患者姓名</th>
            <th>随访类型</th>
            <th style={{ width: '100px' }}>状态</th>
            <th style={{ width: '60px' }}>版本</th>
            <th style={{ width: '100px' }}>证据</th>
            <th style={{ width: '100px' }}>创建人</th>
            <th style={{ width: '160px' }}>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map(record => (
            <tr
              key={record.id}
              className={`record-row ${selectedIds.includes(record.id) ? 'selected' : ''}`}
              onClick={() => onRecordClick(record)}
            >
              <td onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(record.id)}
                  onChange={e => handleSelect(e, record.id)}
                />
              </td>
              <td className="record-no">{record.record_no}</td>
              <td className="patient-name">
                {record.patient?.name || `患者${record.patient_id}`}
              </td>
              <td>{record.follow_up_type || '-'}</td>
              <td>
                <span
                  className="status-tag"
                  style={{
                    backgroundColor: STATUS_COLORS[record.status] + '20',
                    color: STATUS_COLORS[record.status],
                    border: `1px solid ${STATUS_COLORS[record.status]}`,
                  }}
                >
                  {STATUS_NAMES[record.status] || record.status}
                </span>
              </td>
              <td>v{record.version}</td>
              <td>
                {hasEvidence(record) ? (
                  <span className="evidence-badge complete">齐全</span>
                ) : (
                  <span className="evidence-badge incomplete">缺失</span>
                )}
              </td>
              <td>{record.created_by}</td>
              <td className="time-cell">
                {new Date(record.created_at).toLocaleString('zh-CN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecordList;
