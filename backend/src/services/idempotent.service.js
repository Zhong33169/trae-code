const db = require('../db');

const IDEMPOTENT_ACTIONS = [
  'create',
  'submit',
  'audit',
  'review',
  'batchReview',
  'addEvidence',
  'deleteEvidence'
];

function isValidIdempotentAction(action) {
  return IDEMPOTENT_ACTIONS.includes(action);
}

function findIdempotentRequest(requestId) {
  return db.prepare('SELECT * FROM idempotent_requests WHERE request_id = ?').get(requestId);
}

function saveIdempotentRequest(ctx) {
  const {
    requestId, userId, orderId, action, version,
    requestPayload, responseCode, responseBody
  } = ctx;
  db.prepare(`
    INSERT INTO idempotent_requests (
      request_id, user_id, order_id, action, version,
      request_payload, response_code, response_body
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    requestId, userId, orderId ?? null, action, version ?? null,
    requestPayload ? JSON.stringify(requestPayload) : null,
    responseCode, JSON.stringify(responseBody)
  );
}

function buildIdempotentResponse(row) {
  return {
    idempotent: true,
    cachedAt: row.created_at,
    ...JSON.parse(row.response_body)
  };
}

function idempotent(requestId, ctx, fn) {
  const { userId, orderId, action, version, payload } = ctx;

  if (!requestId || !isValidIdempotentAction(action)) {
    throw new Error(`无效的幂等上下文: requestId=${requestId}, action=${action}`);
  }

  const existing = findIdempotentRequest(requestId);
  if (existing) {
    return { hit: true, response: buildIdempotentResponse(existing) };
  }

  let result;
  let tx;
  let status = { status: 'pending' };
  try {
    tx = db.transaction(() => {
      result = fn();
      if (result && result.ok === false && !result.data) {
        saveIdempotentRequest({
          requestId, userId, orderId, action, version,
          requestPayload: payload,
          responseCode: result.code || 400,
          responseBody: {
            code: result.code || 400,
            message: result.message,
            failureReason: result.failureReason || null,
            ok: false
          }
        });
        status.status = 'failed';
        return status;
      }
      saveIdempotentRequest({
        requestId, userId, orderId, action, version,
        requestPayload: payload,
        responseCode: 200,
        responseBody: {
          code: 0,
          message: result.message || 'success',
          data: result.data || null,
          ok: true
        }
      });
      status.status = 'ok';
      return status;
    });
    tx();
    return { hit: false, response: result };
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed: idempotent_requests')) {
      const race = findIdempotentRequest(requestId);
      if (race) return { hit: true, response: buildIdempotentResponse(race) };
    }
    throw e;
  }
}

module.exports = {
  idempotent,
  findIdempotentRequest,
  saveIdempotentRequest,
  isValidIdempotentAction
};
