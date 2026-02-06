const { v4: uuidv4 } = require('uuid');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// Audit logging middleware - records all API requests
const auditMiddleware = async (req, res, next) => {
  const requestId = uuidv4();
  req.requestId = requestId;

  const startTime = Date.now();

  // Capture response finish
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    const auditEntry = {
      requestId,
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      action: determineAction(req.method, req.path),
    };

    try {
      await AuditLog.create(auditEntry);
    } catch (error) {
      logger.error('Failed to write audit log', { error: error.message, requestId });
    }

    // Log to structured logger as well
    logger.info('API request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });
  });

  next();
};

function determineAction(method, path) {
  const actionMap = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  let action = actionMap[method] || 'unknown';

  if (path.includes('/auth/login')) action = 'login';
  if (path.includes('/auth/register')) action = 'register';
  if (path.includes('/payments')) action = 'payment';
  if (path.includes('/gdpr/export')) action = 'data_export';
  if (path.includes('/gdpr/delete')) action = 'data_deletion';

  return action;
}

module.exports = auditMiddleware;
