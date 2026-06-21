import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { 
  getFormsByRole, getFormById, createForm, submitForm,
  approveForm, returnCorrection, rejectForm, archiveForm,
  addEvidence, removeEvidence, getStatsByRole, updateFormContent,
  markOverdue
} from '../services/contractService.js';
import { getUserById } from '../services/userService.js';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => origin,
  allowHeaders: ['Content-Type', 'X-User-Id', 'X-User-Role'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use('*', async (c, next) => {
  const userId = c.req.header('X-User-Id');
  const userRole = c.req.header('X-User-Role');
  
  if (userId) {
    const user = getUserById(parseInt(userId));
    if (user) {
      c.set('user', user);
    }
  }
  
  await next();
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/user/current', (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  return c.json(user);
});

app.get('/api/contracts', (c) => {
  const user = c.get('user');
  const role = c.req.query('role') || user?.role;
  const stage = c.req.query('stage');
  const status = c.req.query('status');
  const riskLevel = c.req.query('riskLevel');
  const keyword = c.req.query('keyword');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');

  const result = getFormsByRole(role, { stage, status, riskLevel, keyword, page, pageSize });
  return c.json(result);
});

app.get('/api/contracts/stats', (c) => {
  const user = c.get('user');
  const role = c.req.query('role') || user?.role;
  const stats = getStatsByRole(role);
  return c.json(stats);
});

app.get('/api/contracts/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const form = getFormById(id);
  if (!form) {
    return c.json({ error: '签约服务单不存在' }, 404);
  }
  return c.json(form);
});

app.post('/api/contracts', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const data = await c.req.json();
  const result = createForm(user, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form, 201);
});

app.put('/api/contracts/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = updateFormContent(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/submit', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = submitForm(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/approve', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = approveForm(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/return-correction', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = returnCorrection(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/reject', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = rejectForm(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/archive', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();
  const result = archiveForm(user, id, data);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json(result.form);
});

app.post('/api/contracts/:id/evidences', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const evidence = await c.req.json();
  const result = addEvidence(user, id, evidence);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ id: result.evidenceId, form: result.form }, 201);
});

app.delete('/api/evidences/:id', (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未登录' }, 401);
  }
  const id = parseInt(c.req.param('id'));
  const result = removeEvidence(user, id);
  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ success: true, form: result.form });
});

app.post('/api/maintenance/mark-overdue', (c) => {
  const result = markOverdue();
  return c.json(result);
});

export default app;
