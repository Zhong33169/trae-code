import Router from 'koa-router';
import * as expenseController from '../controllers/expenseController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';

const router = new Router({ prefix: '/api/expenses' });

router.get('/users', optionalAuthMiddleware, expenseController.getUsers);

router.use(authMiddleware);

router.get('/', expenseController.getList);
router.get('/stats', expenseController.getStats);
router.get('/:id/audit-logs', expenseController.getAuditLogs);
router.get('/:id', expenseController.getDetail);

router.post('/', expenseController.create);

router.post('/batch/start-verify', expenseController.batchStartVerify);
router.post('/batch/pass-review', expenseController.batchPassReview);
router.post('/batch/reject-review', expenseController.batchRejectReview);

router.post('/:id/submit', expenseController.submit);
router.post('/:id/start-verify', expenseController.startVerify);
router.post('/:id/pass-verify', expenseController.passVerify);
router.post('/:id/reject-verify', expenseController.rejectVerify);
router.post('/:id/request-supplement', expenseController.requestSupplement);
router.post('/:id/pass-review', expenseController.passReview);
router.post('/:id/reject-review', expenseController.rejectReview);
router.post('/:id/update-deadline', expenseController.updateDeadline);

export default router;
