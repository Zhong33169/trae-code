import { useState } from 'react';
import type { AccountApplication, UserRole, RiskLevel } from '@/lib/types';
import { submitOperation } from '@/lib/api';
import UserSelector from './UserSelector';

interface OperationFormProps {
  application: AccountApplication;
  onSuccess: (updatedData?: AccountApplication) => void;
}

type ActionType = 'advance_stage' | 'sign_complete' | 'sign_receive' | 'return_back' | 'mark_abnormal';

const actionConfig: Record<ActionType, { label: string; description: string; btnClass: string }> = {
  advance_stage: {
    label: '推进到下一阶段',
    description: '将申请推进到下一个处理阶段（需校验证据完整性和角色权限）',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  sign_complete: {
    label: '最终审批完成',
    description: '支行行长完成账户启用的最终审批并归档（仅账户启用阶段）',
    btnClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  sign_receive: {
    label: '签收处理',
    description: '标记当前申请已签收，开始处理',
    btnClass: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  return_back: {
    label: '退回补正',
    description: '将申请退回上一阶段，要求补充资料或修改',
    btnClass: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  mark_abnormal: {
    label: '标记异常',
    description: '标记为异常回传状态，需特别说明原因',
    btnClass: 'bg-red-500 hover:bg-red-600 text-white',
  },
};

export default function OperationForm({ application, onSuccess }: OperationFormProps) {
  const [operator, setOperator] = useState<{ id: number; role: UserRole; name: string }>({
    id: 1,
    role: '客户经理',
    name: '王经理',
  });
  const [selectedAction, setSelectedAction] = useState<ActionType | ''>('');
  const [remark, setRemark] = useState('');
  const [returnedReason, setReturnedReason] = useState('');
  const [newRiskLevel, setNewRiskLevel] = useState<RiskLevel | ''>('');
  const [riskChangeReason, setRiskChangeReason] = useState('');
  const [evidenceIds, setEvidenceIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getAvailableActions = (): ActionType[] => {
    const actions: ActionType[] = ['sign_receive'];
    const { stage, status } = application;

    if (status !== '签收完成' || stage !== '账户启用') {
      actions.push('return_back');
      actions.push('mark_abnormal');
    }

    if (stage === '开户预约' && operator.role === '客户经理') {
      actions.push('advance_stage');
    } else if (stage === '资料审核' && operator.role === '运营主管') {
      actions.push('advance_stage');
    } else if (stage === '账户启用' && operator.role === '支行行长') {
      actions.push('sign_complete');
    }

    return actions;
  };

  const handleEvidenceToggle = (evId: number) => {
    setEvidenceIds((prev) =>
      prev.includes(evId) ? prev.filter((id) => id !== evId) : [...prev, evId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedAction) {
      setMessage({ type: 'error', text: '请选择操作类型' });
      return;
    }

    if (selectedAction === 'return_back' && !returnedReason.trim()) {
      setMessage({ type: 'error', text: '退回补正必须填写退回原因' });
      return;
    }

    if (selectedAction === 'mark_abnormal' && !returnedReason.trim()) {
      setMessage({ type: 'error', text: '标记异常必须填写原因' });
      return;
    }

    if (newRiskLevel && newRiskLevel !== application.risk_level && !riskChangeReason.trim()) {
      setMessage({ type: 'error', text: '风险等级变更必须填写变更原因' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await submitOperation({
        operator_id: operator.id,
        operator_role: operator.role,
        application_id: application.id,
        current_version: application.version,
        action: selectedAction,
        remark: remark || undefined,
        returned_reason: returnedReason || undefined,
        new_risk_level: newRiskLevel || undefined,
        risk_change_reason: riskChangeReason || undefined,
        evidence_ids_verified: evidenceIds.length > 0 ? evidenceIds : undefined,
      });

      if (res.code === 0) {
        const newVersion = res.data?.version || application.version + 1;
        const statusChanged = res.data?.status !== application.status;
        const stageChanged = res.data?.stage !== application.stage;
        const riskChanged = res.data?.risk_level !== application.risk_level;
        
        let successMsg = res.message || '操作成功';
        if (res.data) {
          const changes: string[] = [];
          if (statusChanged) changes.push(`状态: ${application.status} → ${res.data.status}`);
          if (stageChanged) changes.push(`阶段: ${application.stage} → ${res.data.stage}`);
          if (riskChanged) changes.push(`风险: ${application.risk_level} → ${res.data.risk_level}`);
          if (changes.length > 0) {
            successMsg += ` [${changes.join(', ')}]`;
          }
          successMsg += ` [版本 v${application.version} → v${newVersion}]`;
        }
        
        setMessage({ type: 'success', text: successMsg });
        setTimeout(() => {
          onSuccess(res.data);
        }, 1500);
      } else {
        setMessage({ type: 'error', text: res.message || '操作失败' });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || '操作失败，请重试',
      });
    } finally {
      setLoading(false);
    }
  };

  const availableActions = getAvailableActions();

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">处理操作</h3>

      <UserSelector
        value={{ id: operator.id, role: operator.role }}
        onChange={setOperator}
        className="mb-6 pb-6 border-b border-gray-200"
      />

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <span className="font-medium">提示：</span>
          当前以 <span className="font-bold">{operator.name}（{operator.role}）</span> 身份处理
        </p>
        {operator.role === '客户经理' && application.stage !== '开户预约' && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ 客户经理仅可处理「开户预约」阶段的申请
          </p>
        )}
        {operator.role === '运营主管' && application.stage !== '资料审核' && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ 运营主管仅可处理「资料审核」阶段的申请
          </p>
        )}
        {operator.role === '支行行长' && application.stage !== '账户启用' && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ 支行行长仅可处理「账户启用」阶段的申请
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">选择操作</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(Object.keys(actionConfig) as ActionType[]).map((action) => {
            const config = actionConfig[action];
            const isAvailable = availableActions.includes(action);
            return (
              <button
                key={action}
                type="button"
                onClick={() => setSelectedAction(action)}
                disabled={!isAvailable}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  selectedAction === action
                    ? 'border-blue-500 bg-blue-50'
                    : isAvailable
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="font-medium text-sm">{config.label}</div>
                <div className="text-xs text-gray-500 mt-1">{config.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {(selectedAction === 'return_back' || selectedAction === 'mark_abnormal') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {selectedAction === 'return_back' ? '退回原因' : '异常原因'} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={returnedReason}
            onChange={(e) => setReturnedReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="请详细说明原因..."
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          调整风险等级（可选）
        </label>
        <div className="flex gap-2 mb-2">
          {(['low', 'medium', 'high'] as RiskLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setNewRiskLevel(level)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                newRiskLevel === level
                  ? level === 'high'
                    ? 'bg-red-600 text-white'
                    : level === 'medium'
                    ? 'bg-amber-500 text-white'
                    : 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {level === 'low' ? '低风险' : level === 'medium' ? '中风险' : '高风险'}
            </button>
          ))}
        </div>
        {newRiskLevel && newRiskLevel !== application.risk_level && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              变更原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={riskChangeReason}
              onChange={(e) => setRiskChangeReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="请说明风险等级调整的原因..."
            />
          </div>
        )}
      </div>

      {application.evidences && application.evidences.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            证据核验（勾选表示已核验通过）
          </label>
          <div className="space-y-2">
            {application.evidences.map((ev) => (
              <label
                key={ev.id}
                className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                  evidenceIds.includes(ev.id)
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={evidenceIds.includes(ev.id)}
                  onChange={() => handleEvidenceToggle(ev.id)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm flex-1">{ev.evidence_name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    ev.is_required === 1 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {ev.is_required === 1 ? '必填' : '选填'}
                </span>
                <span
                  className={`text-xs ml-2 px-2 py-0.5 rounded ${
                    ev.is_provided === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {ev.is_provided === 1 ? '已提供' : '未提供'}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">备注（可选）</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="可填写处理备注..."
        />
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          当前版本: <span className="font-mono font-semibold">v{application.version}</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !selectedAction}
          className={`px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedAction ? actionConfig[selectedAction].btnClass : 'bg-gray-300 text-gray-500'
          }`}
        >
          {loading ? '处理中...' : '提交操作'}
        </button>
      </div>
    </div>
  );
}
