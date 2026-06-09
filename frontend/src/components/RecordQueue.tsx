import React, { useState, useEffect, useCallback } from 'react';
import { FollowUpRecord, ApiError, ROLE_NAMES } from '../types';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import FilterBar from './FilterBar';
import RecordList from './RecordList';
import EvidencePanel from './EvidencePanel';
import RecordDetailModal from './RecordDetailModal';
import CreateRecordModal from './CreateRecordModal';
import RoleSwitcher from './RoleSwitcher';
import './RecordQueue.css';

const RecordQueue: React.FC = () => {
  const { currentRole, currentUsername } = useAuth();
  const [records, setRecords] = useState<FollowUpRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<FollowUpRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [status, setStatus] = useState('');
  const [patientName, setPatientName] = useState('');

  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSuccess, setBatchSuccess] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectOpinion, setRejectOpinion] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setBatchError(null);
    try {
      const data = await api.getRecords({
        status: status || undefined,
        patient_name: patientName || undefined,
        limit: 50,
      });
      setRecords(data.items);
      setTotal(data.total);
      setSelectedIds([]);
    } catch (err) {
      console.error('加载记录失败:', err);
    } finally {
      setLoading(false);
    }
  }, [status, patientName, currentRole, currentUsername]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleRecordClick = (record: FollowUpRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleDetailClose = () => {
    setDetailVisible(false);
    setSelectedRecord(null);
  };

  const handleDetailSuccess = (updatedRecord?: FollowUpRecord) => {
    loadRecords();
    if (updatedRecord && selectedRecord?.id === updatedRecord.id) {
      setSelectedRecord(updatedRecord);
    }
  };

  const handleCreateSuccess = () => {
    loadRecords();
  };

  const handleSelectChange = (ids: number[]) => {
    setSelectedIds(ids);
    if (ids.length > 0 && records.length > 0) {
      const firstSelected = records.find(r => r.id === ids[0]);
      if (firstSelected) {
        setSelectedRecord(firstSelected);
      }
    } else {
      setSelectedRecord(null);
    }
  };

  const canProcess = selectedIds.length > 0 && (
    (currentRole === 'gp_doctor' && status === 'pending_doctor') ||
    (currentRole === 'gp_doctor' && status === '') ||
    (currentRole === 'medical_director' && status === 'pending_director') ||
    (currentRole === 'medical_director' && status === '')
  );

  const handleBatchProcess = async () => {
    if (selectedIds.length === 0) return;

    const versionMap: Record<string, number> = {};
    selectedIds.forEach(id => {
      const record = records.find(r => r.id === id);
      if (record) {
        versionMap[String(id)] = record.version;
      }
    });

    try {
      const result = await api.batchProcess(selectedIds, versionMap, '批量通过');
      if (result.failed.length > 0) {
        const failMsg = result.failed
          .map(f => `记录ID ${f.id}: ${f.error}`)
          .join('\n');
        setBatchError(`批量操作部分失败：\n${failMsg}`);
      }
      if (result.success.length > 0) {
        setBatchSuccess(`成功处理 ${result.success.length} 条记录`);
        setTimeout(() => setBatchSuccess(null), 3000);
      }
      loadRecords();
    } catch (err) {
      const apiErr = err as ApiError;
      setBatchError(`批量操作失败: ${apiErr.detail}`);
    }
  };

  const handleBatchReject = () => {
    if (selectedIds.length === 0) return;
    setRejectModalVisible(true);
    setRejectOpinion('');
  };

  const confirmBatchReject = async () => {
    if (!rejectOpinion.trim()) {
      setBatchError('驳回意见不能为空');
      return;
    }

    const versionMap: Record<string, number> = {};
    selectedIds.forEach(id => {
      const record = records.find(r => r.id === id);
      if (record) {
        versionMap[String(id)] = record.version;
      }
    });

    try {
      const result = await api.batchReject(selectedIds, versionMap, rejectOpinion);
      if (result.failed.length > 0) {
        const failMsg = result.failed
          .map(f => `记录ID ${f.id}: ${f.error}`)
          .join('\n');
        setBatchError(`批量驳回部分失败：\n${failMsg}`);
      }
      if (result.success.length > 0) {
        setBatchSuccess(`成功驳回 ${result.success.length} 条记录`);
        setTimeout(() => setBatchSuccess(null), 3000);
      }
      setRejectModalVisible(false);
      loadRecords();
    } catch (err) {
      const apiErr = err as ApiError;
      setBatchError(`批量驳回失败: ${apiErr.detail}`);
    }
  };

  return (
    <div className="record-queue-page">
      <header className="page-header">
        <div className="header-left">
          <h1>随访记录补录校验</h1>
          <span className="header-subtitle">
            当前角色：{ROLE_NAMES[currentRole]}
          </span>
        </div>
        <div className="header-right">
          {currentRole === 'triage_nurse' && (
            <button className="btn btn-primary create-btn" onClick={() => setCreateVisible(true)}>
              + 新建补录
            </button>
          )}
          <RoleSwitcher />
        </div>
      </header>

      {batchError && (
        <div className="alert alert-error" onClick={() => setBatchError(null)}>
          <pre>{batchError}</pre>
          <span className="close-x">点击关闭</span>
        </div>
      )}

      {batchSuccess && (
        <div className="alert alert-success">
          {batchSuccess}
        </div>
      )}

      <FilterBar
        status={status}
        patientName={patientName}
        onStatusChange={setStatus}
        onPatientNameChange={setPatientName}
        onSearch={loadRecords}
        onReset={() => {
          setStatus('');
          setPatientName('');
        }}
        selectedCount={selectedIds.length}
        onBatchProcess={handleBatchProcess}
        onBatchReject={handleBatchReject}
        canProcess={canProcess}
        totalCount={total}
      />

      <div className="main-content">
        <div className="list-section">
          <RecordList
            records={records}
            selectedIds={selectedIds}
            onSelectChange={handleSelectChange}
            onRecordClick={handleRecordClick}
            loading={loading}
          />
        </div>
        <div className="evidence-section">
          <EvidencePanel record={selectedRecord} />
        </div>
      </div>

      {detailVisible && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={handleDetailClose}
          onSuccess={handleDetailSuccess}
        />
      )}

      {rejectModalVisible && (
        <div className="modal-overlay" onClick={() => setRejectModalVisible(false)}>
          <div className="modal-content small-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>批量驳回</h2>
              <button className="close-btn" onClick={() => setRejectModalVisible(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>已选择 <strong>{selectedIds.length}</strong> 条记录进行驳回</p>
              <div className="form-item">
                <label>驳回意见 <span className="required">*</span></label>
                <textarea
                  value={rejectOpinion}
                  onChange={e => setRejectOpinion(e.target.value)}
                  placeholder="请输入驳回原因"
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setRejectModalVisible(false)}>
                取消
              </button>
              <button className="btn btn-danger" onClick={confirmBatchReject}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {createVisible && (
        <CreateRecordModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
};

export default RecordQueue;
