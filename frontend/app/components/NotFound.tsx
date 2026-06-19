import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h2>页面不存在</h2>
      <Link to="/" style={{ color: '#2563eb' }}>返回苗种记录首页</Link>
    </div>
  )
}
