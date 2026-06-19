import { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <div style={{ padding: 24, color: '#dc2626' }}>
      <h3>操作出错了</h3>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{error instanceof Error ? error.message : String(error)}</pre>
    </div>
  )
}
