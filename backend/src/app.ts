import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sampleService } from './services';
import { initSchema } from './schema';
import type { UserRole } from './types';

initSchema();

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3004',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['Content-Type'],
  })
);

app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/users', (c) => {
  return c.json([
    { id: 'u1', username: 'zhangsan', name: '张三(登记员)', role: 'clerk' },
    { id: 'u2', username: 'lisupervisor', name: '李主管', role: 'qc_supervisor' },
    { id: 'u3', username: 'wangmanager', name: '王经理', role: 'production_manager' },
  ]);
});

app.get('/api/samples/stats', (c) => {
  return c.json(sampleService.stats());
});

app.get('/api/samples', (c) => {
  const group = c.req.query('group') || 'pending';
  const role = (c.req.query('role') as UserRole) || undefined;
  return c.json(sampleService.listByStatusGroup(group, role));
});

app.get('/api/samples/:id', (c) => {
  const id = c.req.param('id');
  const record = sampleService.getById(id);
  if (!record) return c.json({ error: 'not found' }, 404);
  return c.json({
    record,
    evidences: sampleService.listEvidences(id),
    appeals: sampleService.listAppeals(id),
    logs: sampleService.listLogs(id),
    temperatures: sampleService.listTemperatures(id),
  });
});

app.post('/api/samples', async (c) => {
  const body = await c.req.json();
  const record = sampleService.create(body);
  return c.json(record, 201);
});

app.post('/api/samples/:id/submit', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.submitForReview(id, body.handler, body.role, body.version, body.evidences || []);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/qc-review', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.qcReview(id, body.handler, body.role, body.version, body.decision, body.opinion);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/manager-review', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.managerReview(id, body.handler, body.role, body.version, body.decision, body.opinion);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/appeal', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.submitAppeal(id, body.handler, body.role, body.reason, body.version);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/appeal-review', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.reviewAppeal(id, body.handler, body.role, body.version, body.decision, body.opinion, body.rejectReason);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/appeal-resubmit', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const result = sampleService.resubmitAppeal(id, body.handler, body.role, body.reason, body.version);
  if (!result.ok) return c.json({ ok: false, errors: result.errors }, 400);
  return c.json({ ok: true, record: result.record });
});

app.post('/api/samples/:id/temperature', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const record = sampleService.addTemperature(id, body);
  return c.json(record, 201);
});

export default app;
