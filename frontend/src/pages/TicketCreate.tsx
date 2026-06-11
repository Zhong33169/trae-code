import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Paperclip, XCircle } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { RiskLevel, EvidenceCreate } from '@/types';
import { cn } from '@/lib/utils';

const riskOptions: { value: RiskLevel; label: string; desc: string }[] = [
  { value: 'high', label: '高风险', desc: '涉及核心业务、金额大、安全要求高，需优先处理' },
  { value: 'medium', label: '中风险', desc: '常规业务系统，中等复杂度，标准流程处理' },
  { value: 'low', label: '低风险', desc: '简单需求、内部工具，可延后处理' },
];

export default function TicketCreate() {
  const navigate = useNavigate();
  const { createTicket, loading, error, setError } = useAppStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [deadline, setDeadline] = useState('');
  const [evidences, setEvidences] = useState<EvidenceCreate[]>([]);
  const [evName, setEvName] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [evType, setEvType] = useState('doc');

  const addEvidence = () => {
    if (!evName || !evUrl) return;
    setEvidences([...evidences, { name: evName, type: evType, url: evUrl }]);
    setEvName('');
    setEvUrl('');
  };

  const removeEvidence = (index: number) => {
    setEvidences(evidences.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('请输入需求标题');
      return;
    }
    if (!description.trim()) {
      setError('请输入需求描述');
      return;
    }

    try {
      const id = await createTicket({
        title,
        description,
        risk_level: riskLevel,
        deadline: deadline || undefined,
        evidences,
      });
      navigate(`/tickets/${id}`);
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tickets')}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">发起需求交付单</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              需求标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入需求标题"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              需求描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述需求内容、背景、目标等..."
              rows={5}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              风险等级 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {riskOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all',
                    riskLevel === opt.value
                      ? opt.value === 'high'
                        ? 'border-red-300 bg-red-50'
                        : opt.value === 'medium'
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <input
                    type="radio"
                    name="riskLevel"
                    value={opt.value}
                    checked={riskLevel === opt.value}
                    onChange={() => setRiskLevel(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        opt.value === 'high' && 'text-red-700',
                        opt.value === 'medium' && 'text-amber-700',
                        opt.value === 'low' && 'text-emerald-700'
                      )}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              期望完成时间
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              不填则按风险等级自动设置截止时间
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              证据材料
              <span className="text-slate-400 font-normal ml-1">
                (高风险需至少3份，中风险需至少2份，低风险需至少1份)
              </span>
            </label>
            {evidences.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {evidences.map((ev, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700 flex-1 truncate">{ev.name}</span>
                    <span className="text-xs text-slate-400">
                      {ev.type === 'doc' ? '文档' : ev.type === 'link' ? '链接' : ev.type === 'image' ? '图片' : '其他'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEvidence(idx)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                placeholder="证据名称"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={evType}
                onChange={(e) => setEvType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="doc">文档</option>
                <option value="link">链接</option>
                <option value="image">图片</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={evUrl}
                onChange={(e) => setEvUrl(e.target.value)}
                placeholder="证据链接/URL"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addEvidence}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
              >
                添加
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <Link
              to="/tickets"
              className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              取消
            </Link>
            <button
              type="submit"
              disabled={loading.createTicket}
              className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.createTicket ? '提交中...' : '提交需求'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
