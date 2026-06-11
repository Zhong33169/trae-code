const success = (ctx, data = null, message = '操作成功') => {
  ctx.body = {
    code: 200,
    message,
    data,
  };
};

const error = (ctx, message = '操作失败', code = 400) => {
  ctx.status = code;
  ctx.body = {
    code,
    message,
    data: null,
  };
};

const validationError = (ctx, errors, message = '参数校验失败') => {
  ctx.status = 400;
  ctx.body = {
    code: 400,
    message,
    data: { errors },
  };
};

const paginate = (ctx, list, total, page = 1, pageSize = 10, message = '查询成功') => {
  ctx.body = {
    code: 200,
    message,
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

module.exports = {
  success,
  error,
  validationError,
  paginate,
};
