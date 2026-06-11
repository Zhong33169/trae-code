import * as expenseService from '../services/expenseService.js';

const handleService = (ctx, fn) => {
  try {
    const result = fn();
    ctx.body = { success: true, data: result };
  } catch (err) {
    ctx.status = 400;
    ctx.body = { success: false, error: err.message };
  }
};

export const getList = async (ctx) => {
  const { status, warningLevel, keyword } = ctx.query;
  const userId = ctx.state.userId;
  const role = ctx.state.userRole;

  const list = expenseService.getExpenseList({
    userId,
    role,
    status,
    warningLevel,
    keyword,
  });

  ctx.body = { success: true, data: list };
};

export const getDetail = async (ctx) => {
  const { id } = ctx.params;
  const exp = expenseService.getExpenseDetail(id);
  if (!exp) {
    ctx.status = 404;
    ctx.body = { success: false, error: '报销申请不存在' };
    return;
  }
  ctx.body = { success: true, data: exp };
};

export const create = async (ctx) => {
  handleService(ctx, () => {
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.createExpense(data, userId);
  });
};

export const submit = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const { version } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.submitExpense(id, userId, version);
  });
};

export const startVerify = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const { version } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.startVerify(id, userId, version);
  });
};

export const passVerify = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.passVerify(id, userId, data, data.version);
  });
};

export const rejectVerify = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.rejectVerify(id, userId, data, data.version);
  });
};

export const requestSupplement = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.requestSupplement(id, userId, data, data.version);
  });
};

export const passReview = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.passReview(id, userId, data, data.version);
  });
};

export const rejectReview = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const data = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.rejectReview(id, userId, data, data.version);
  });
};

export const batchPassReview = async (ctx) => {
  handleService(ctx, () => {
    const { ids, opinion } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.batchPassReview(ids, userId, { opinion });
  });
};

export const batchRejectReview = async (ctx) => {
  handleService(ctx, () => {
    const { ids, reason } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.batchRejectReview(ids, userId, { reason });
  });
};

export const batchStartVerify = async (ctx) => {
  handleService(ctx, () => {
    const { ids } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.batchStartVerify(ids, userId);
  });
};

export const getStats = async (ctx) => {
  const userId = ctx.state.userId;
  const role = ctx.state.userRole;
  const stats = expenseService.getStats({ userId, role });
  ctx.body = { success: true, data: stats };
};

export const getAuditLogs = async (ctx) => {
  const { id } = ctx.params;
  const logs = expenseService.getAuditLogs(id);
  if (!logs) {
    ctx.status = 404;
    ctx.body = { success: false, error: '报销申请不存在' };
    return;
  }
  ctx.body = { success: true, data: logs };
};

export const getUsers = async (ctx) => {
  const users = expenseService.getUsers();
  ctx.body = { success: true, data: users };
};

export const updateDeadline = async (ctx) => {
  handleService(ctx, () => {
    const { id } = ctx.params;
    const { deadline } = ctx.request.body;
    const userId = ctx.state.userId;
    return expenseService.updateExpenseDeadline(id, deadline, userId);
  });
};
