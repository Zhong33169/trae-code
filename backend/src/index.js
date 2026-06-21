import { serve } from '@hono/node-server';
import app from './routes/api.js';

const port = parseInt(process.env.PORT || '8005');

console.log(`Contract Service Backend starting on port ${port}...`);
console.log(`Health check: http://localhost:${port}/api/health`);

serve({
  fetch: app.fetch,
  port
});

export { app, port };
