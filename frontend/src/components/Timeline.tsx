import { For } from 'solid-js';

interface Stage {
  label: string;
  completed: boolean;
  active: boolean;
}

interface TimelineProps {
  stages: Stage[];
}

export default function Timeline(props: TimelineProps) {
  return (
    <div style={{ padding: '8px 0' }}>
      <For each={props.stages}>
        {(stage, i) => (
          <div style={{
            display: 'flex',
            gap: '16px',
            position: 'relative',
            paddingBottom: i() < props.stages.length - 1 ? '32px' : '0',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '32px',
              flexShrink: 0,
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                background: stage.completed
                  ? 'var(--success)'
                  : stage.active
                    ? 'var(--primary)'
                    : '#e2e8f0',
                color: stage.completed || stage.active ? '#fff' : '#a0aec0',
                flexShrink: 0,
                zIndex: 1,
              }}>
                {stage.completed ? '✓' : i() + 1}
              </div>
              {i() < props.stages.length - 1 && (
                <div style={{
                  width: '2px',
                  flex: 1,
                  background: stage.completed ? 'var(--success)' : '#e2e8f0',
                  marginTop: '4px',
                }} />
              )}
            </div>
            <div style={{
              paddingTop: '5px',
              fontSize: '14px',
              fontWeight: stage.active ? 600 : 400,
              color: stage.completed
                ? 'var(--success)'
                : stage.active
                  ? 'var(--primary)'
                  : 'var(--text-light)',
            }}>
              {stage.label}
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
