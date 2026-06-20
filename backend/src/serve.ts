import { serve } from '@hono/node-server'
import app from './index.js'

serve({
  fetch: app.fetch,
  port: 8001
}, (info) => {
  console.log(`\n✅ 服务器运行中: http://localhost:${info.port}`)
})
