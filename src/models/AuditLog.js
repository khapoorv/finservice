const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  requestId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, default: Date.now },
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number },
  duration: { type: Number }, // milliseconds

  // Who performed the action
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  ip: { type: String },
  userAgent: { type: String },

  // What happened
  action: {
    type: String,
    enum: [
      'read', 'create', 'update', 'delete',
      'login', 'logout', 'register',
      'payment', 'refund',
      'data_export', 'data_deletion',
      'admin_action', 'unknown',
    ],
    required: true,
  },

  // Affected resource
  resource: { type: String },
  resourceId: { type: String },

  // Change details for write operations
  changes: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },

  // Additional context
  metadata: { type: Map, of: String },
}, {
  timestamps: false,
  capped: { size: 1073741824, max: 5000000 }, // 1GB cap, 5M docs max
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });

// Audit logs are immutable - prevent updates and deletes
auditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be modified');
});

auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
