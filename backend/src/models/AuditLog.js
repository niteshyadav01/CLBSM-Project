import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: 'System' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    summary: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
