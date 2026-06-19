import { h } from 'preact';

const STAGES = [
  { key: 'refund', label: '售后退款' },
  { key: 'warehouse', label: '仓库核实' },
  { key: 'followup', label: '客服回访' },
];

const STEPS = [
  { key: 'initiate', label: '发起' },
  { key: 'process', label: '办理' },
  { key: 'review', label: '复核归档' },
];

export default function StageFlow({ currentStage, currentStep }) {
  const stageIdx = STAGES.findIndex((s) => s.key === currentStage);
  const stepIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div>
      <div class="stage-flow">
        {STAGES.map((stage, i) => (
          <>
            <div
              class={`stage-item ${
                i < stageIdx ? 'completed' : i === stageIdx ? 'active' : ''
              }`}
            >
              {i < stageIdx ? '✓ ' : ''}
              {stage.label}
            </div>
            {i < STAGES.length - 1 && <div class="stage-arrow" />}
          </>
        ))}
      </div>
      <div class="step-flow">
        {STEPS.map((step, i) => (
          <div
            class={`step-item ${
              i < stepIdx ? 'completed' : i === stepIdx ? 'active' : ''
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>
    </div>
  );
}
