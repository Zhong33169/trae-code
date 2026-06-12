import { createSignal, createEffect } from 'solid-js'
import { useApi } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { roleNames } from '../utils/constants.js'

export default function StatisticsPage() {
  const api = useApi()
  const { currentUser } = useAuth()
  const [stats, setStats] = createSignal(null)

  const loadStats = async () => {
    try {
      const data = await api.get('/statistics')
      setStats(data)
    } catch (err) {
      console.error('加载统计失败:', err)
    }
  }

  createEffect(() => {
    loadStats()
  }, [currentUser().id])

  if (!stats()) {
    return <div class="empty-state">加载中...</div>
  }

  const s = stats().stats

  return (
    <div>
      <h2 class="page-title">统计分析</h2>

      <div class="detail-card">
        <h3>当前角色：{roleNames[currentUser().role]} - {currentUser().name}</h3>
      </div>

      <h3 style="margin-bottom: 0.75rem; color: #374151;">总体概览</h3>
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-value">{s.total}</div>
          <div class="stat-label">工单总数</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">{s.pending}</div>
          <div class="stat-label">待处理</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{s.in_progress}</div>
          <div class="stat-label">处理中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{s.completed}</div>
          <div class="stat-label">待复核</div>
        </div>
        <div class="stat-card low">
          <div class="stat-value">{s.archived}</div>
          <div class="stat-label">已归档</div>
        </div>
      </div>

      <h3 style="margin: 1.5rem 0 0.75rem; color: #374151;">风险分布</h3>
      <div class="stats-grid">
        <div class="stat-card high">
          <div class="stat-value">{s.high_risk}</div>
          <div class="stat-label">🔴 高风险</div>
        </div>
        <div class="stat-card medium">
          <div class="stat-value">{s.medium_risk}</div>
          <div class="stat-label">🟡 中风险</div>
        </div>
        <div class="stat-card low">
          <div class="stat-value">{s.low_risk}</div>
          <div class="stat-label">🟢 低风险</div>
        </div>
      </div>

      <h3 style="margin: 1.5rem 0 0.75rem; color: #374151;">异常工单</h3>
      <div class="stats-grid">
        <div class="stat-card red">
          <div class="stat-value">{s.overdue}</div>
          <div class="stat-label">⏰ 逾期工单</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">{s.returned}</div>
          <div class="stat-label">↩️ 退回补正</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-value">{s.missing_evidence}</div>
          <div class="stat-label">📎 缺证据</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-value">{s.conflict}</div>
          <div class="stat-label">⚠️ 状态冲突</div>
        </div>
      </div>

      <div class="detail-card" style="margin-top: 1.5rem;">
        <h3>风险分级说明</h3>
        <div style="font-size: 0.9rem; line-height: 2;">
          <p><span class="risk-tag risk-high">高风险</span> 优先级 90，需要 4 份证据，逾期 +30 → 120</p>
          <p><span class="risk-tag risk-medium">中风险</span> 优先级 50，需要 2 份证据，逾期 +30 → 80</p>
          <p><span class="risk-tag risk-low">低风险</span> 优先级 20，需要 1 份证据，逾期 +30 → 50</p>
        </div>
      </div>

      <div class="detail-card">
        <h3>处理流程说明</h3>
        <div style="font-size: 0.9rem; line-height: 2;">
          <p><strong>1. 报修登记</strong> - 维修登记员创建工单，流转至审核主管</p>
          <p><strong>2. 师傅派单</strong> - 维修审核主管派单给师傅，或退回补正</p>
          <p><strong>3. 完工验收</strong> - 维修审核主管验收，检查证据是否齐全</p>
          <p><strong>4. 复核归档</strong> - 复核负责人最终审核后归档</p>
          <p style="margin-top: 0.5rem; color: #6b7280;">
            每个环节提交时，后端会校验：当前处理人、角色权限、订单状态、版本号、必填证据数量。
            校验不通过则保留原状态并写入操作记录。
          </p>
        </div>
      </div>

      <div class="detail-card">
        <h3>演示账号说明</h3>
        <div style="font-size: 0.9rem; line-height: 2;">
          <p>切换右上角用户，体验不同角色的操作权限：</p>
          <p>👤 <strong>张登记 / 李登记</strong>（维修登记员）- 创建工单、补正重提</p>
          <p>👤 <strong>王主管 / 赵主管</strong>（维修审核主管）- 派单、验收、退回、标记异常</p>
          <p>👤 <strong>陈复核 / 刘复核</strong>（复核负责人）- 复核归档</p>
        </div>
      </div>
    </div>
  )
}
