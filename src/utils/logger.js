const winston = require('winston');
const path = require('path');

// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fincommerce-api' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File output - all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File output - errors only
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// BAD PRACTICE: Sensitive data logging (intentional for scanner detection)
// This middleware logs request bodies which may contain passwords, tokens, etc.
logger.logRequest = (req) => {
  // WARNING: This logs sensitive data like passwords and tokens
  logger.info('Request received', {
    method: req.method,
    path: req.path,
    body: req.body, // BAD: May contain passwords, credit card numbers, etc.
    headers: req.headers, // BAD: May contain authorization tokens
    cookies: req.cookies, // BAD: May contain session tokens
    ip: req.ip,
    query: req.query,
  });
};

// This logs user details including PII
logger.logUserAction = (user, action) => {
  logger.info('User action', {
    userId: user._id,
    email: user.email, // PII in logs
    phone: user.phone, // PII in logs
    action,
    ssn: user.socialSecurityNumber, // CRITICAL: SSN should NEVER be logged
  });
};

module.exports = logger;
