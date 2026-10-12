import { AuditLog } from '../models/AuditLog.js';

export async function logAudit(entry, session) {
  const doc = new AuditLog({
    user: entry.user?.id || entry.user || null,
    userName: entry.userName || entry.user?.name || 'System',
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ? String(entry.entityId) : '',
    summary: entry.summary,
    details: entry.details || {},
  });
  await doc.save(session ? { session } : undefined);
  return doc;
}
