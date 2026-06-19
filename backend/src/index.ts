import { serve } from '@hono/node-server';
import app from './app';

const PORT = Number(process.env.PORT) || 8004;

console.log(`🚀 Server running on http://localhost:${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
});
