<script>
  import { selectedReservationId } from '$lib/stores.js';

  function selectReservation(id) {
    selectedReservationId.set(id);
  }
</script>

<div class="evidence-panel">
  <div class="panel-header">
    <h3>证据材料概览</h3>
    <span class="subtitle">实验预约 · 耗材申领 · 安全确认</span>
  </div>

  <div class="panel-content">
    <div class="intro-section">
      <h4>三类关键证据</h4>
      <div class="evidence-types">
        <div class="ev-type-card">
          <div class="ev-icon experiment">📋</div>
          <div class="ev-info">
            <div class="ev-name">实验预约方案</div>
            <div class="ev-desc">实验目的、内容、流程</div>
          </div>
        </div>
        <div class="ev-type-card">
          <div class="ev-icon material">🧪</div>
          <div class="ev-info">
            <div class="ev-name">耗材申领单</div>
            <div class="ev-desc">试剂、器材、物料清单</div>
          </div>
        </div>
        <div class="ev-type-card">
          <div class="ev-icon safety">🛡️</div>
          <div class="ev-info">
            <div class="ev-name">安全确认书</div>
            <div class="ev-desc">安全责任、防护措施</div>
          </div>
        </div>
      </div>
    </div>

    <div class="flow-section">
      <h4>审批流程说明</h4>
      <div class="flow-steps">
        <div class="flow-step">
          <div class="step-num">1</div>
          <div class="step-info">
            <div class="step-title">实验助教</div>
            <div class="step-desc">创建预约单并提交</div>
          </div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">2</div>
          <div class="step-info">
            <div class="step-title">实验室管理员</div>
            <div class="step-desc">审核材料完整性</div>
          </div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">3</div>
          <div class="step-info">
            <div class="step-title">学院负责人</div>
            <div class="step-desc">最终确认批准</div>
          </div>
        </div>
      </div>
    </div>

    <div class="rules-section">
      <h4>补录与校验规则</h4>
      <ul class="rules-list">
        <li>后一个岗位不能替前一个岗位补流程</li>
        <li>证据不足不能提交，材料不齐不能通过审核</li>
        <li>补录记录独立保存，不覆盖原始提交记录</li>
        <li>每次操作均有版本号，防止并发冲突</li>
        <li>退回必须说明原因，通过必须有依据</li>
        <li>所有操作留痕，可追溯每一步历史</li>
      </ul>
    </div>

    <div class="tip-section">
      <div class="tip-icon">💡</div>
      <div class="tip-content">
        <strong>提示：</strong>点击左侧预约单可查看详情并办理。
        使用顶部切换角色可体验不同岗位的操作视角。
      </div>
    </div>
  </div>
</div>

<style>
  .evidence-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-header {
    padding: 16px 18px;
    border-bottom: 1px solid #eee;
    background: linear-gradient(135deg, #e8f0fe 0%, #f0f6ff 100%);
  }

  .panel-header h3 {
    margin: 0 0 4px;
    font-size: 16px;
    color: #1e3a5f;
  }

  .subtitle {
    font-size: 12px;
    color: #666;
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px;
  }

  .intro-section,
  .flow-section,
  .rules-section {
    margin-bottom: 22px;
  }

  .intro-section h4,
  .flow-section h4,
  .rules-section h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: #1e3a5f;
    padding-bottom: 6px;
    border-bottom: 2px solid #e8f0fe;
  }

  .evidence-types {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ev-type-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #f8f9fb;
    border-radius: 6px;
    border-left: 3px solid #2d5a87;
  }

  .ev-type-card:nth-child(2) {
    border-left-color: #27ae60;
  }

  .ev-type-card:nth-child(3) {
    border-left-color: #e74c3c;
  }

  .ev-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .ev-info {
    flex: 1;
  }

  .ev-name {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
  }

  .ev-desc {
    font-size: 12px;
    color: #888;
  }

  .flow-steps {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .flow-step {
    flex: 1;
    text-align: center;
    padding: 12px 8px;
    background: #f8f9fb;
    border-radius: 6px;
  }

  .step-num {
    width: 26px;
    height: 26px;
    line-height: 26px;
    border-radius: 50%;
    background: #2d5a87;
    color: white;
    font-size: 14px;
    font-weight: 600;
    margin: 0 auto 8px;
  }

  .flow-step:nth-child(3) .step-num {
    background: #27ae60;
  }

  .flow-step:nth-child(5) .step-num {
    background: #8e44ad;
  }

  .step-title {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
  }

  .step-desc {
    font-size: 11px;
    color: #888;
  }

  .flow-arrow {
    color: #ccc;
    font-size: 14px;
  }

  .rules-list {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #555;
    line-height: 1.8;
  }

  .rules-list li {
    margin-bottom: 2px;
  }

  .tip-section {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: #fff8e1;
    border-radius: 6px;
    border-left: 3px solid #f57c00;
  }

  .tip-icon {
    font-size: 22px;
    flex-shrink: 0;
  }

  .tip-content {
    font-size: 12px;
    color: #e65100;
    line-height: 1.6;
  }

  .tip-content strong {
    color: #bf360c;
  }
</style>
