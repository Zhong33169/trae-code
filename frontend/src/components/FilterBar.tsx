import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { STATUS_NAMES, ROLE_NAMES } from '../types';
import './FilterBar.css';

interface FilterBarProps {
  status: string;
  patientName: string;
  onStatusChange: (status: string) => void;
  onPatientNameChange: (name: string) => void;
  onSearch: () => void;
  onReset: () => void;
  selectedCount: number;
  onBatchProcess: () => void;
  onBatchReject: () => void;
  canProcess: boolean;
  totalCount: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  status,
  patientName,
  onStatusChange,
  onPatientNameChange,
  onSearch,
  onReset,
  selectedCount,
  onBatchProcess,
  onBatchReject,
  canProcess,
  totalCount,
}) => {
  const { currentRole, roles } = useAuth();
  const [inputName, setInputName] = useState(patientName);

  const statusOptions = useMemo(() => {
    const allowed = roles[currentRole]?.allowed_statuses || [];
    return [
      { value: '', label: '全部待办' },
      ...allowed.map(s => ({ value: s, label: STATUS_NAMES[s] || s })),
    ];
  }, [currentRole, roles]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onPatientNameChange(inputName);
      onSearch();
    }
  };

  return (
    <div className="filter-bar">
      <div className="filter-left">
        <div className="filter-item">
          <label>状态：</label>
          <select value={status} onChange={e => onStatusChange(e.target.value)}>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>患者姓名：</label>
          <input
            type="text"
            placeholder="请输入患者姓名"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <button className="btn btn-primary" onClick={() => {
          onPatientNameChange(inputName);
          onSearch();
        }}>
          搜索
        </button>
        <button className="btn btn-default" onClick={() => {
          setInputName('');
          onPatientNameChange('');
          onReset();
        }}>
          重置
        </button>
      </div>

      <div className="filter-right">
        <span className="record-count">共 {totalCount} 条记录</span>
        {selectedCount > 0 && canProcess && (
          <div className="batch-actions">
            <span className="selected-count">已选 {selectedCount} 条</span>
            <button className="btn btn-success" onClick={onBatchProcess}>
              批量通过
            </button>
            <button className="btn btn-danger" onClick={onBatchReject}>
              批量驳回
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
