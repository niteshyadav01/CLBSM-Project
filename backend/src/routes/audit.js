import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { escapeRegex } from '../utils/money.js';
import { isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
router.use(requireAuth, requireRoles('admin', 'manager'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const query = {};
    if (req.query.action) query.action = String(req.query.action).slice(0, 40);
    if (req.query.q) query.summary = new RegExp(escapeRegex(String(req.query.q).slice(0, 80)), 'i');
    if (req.query.from || req.query.to) {
      if (req.query.from && !isISODate(req.query.from)) throw new AppError('Enter a valid from date.', 400, 'VALIDATION');
      if (req.query.to && !isISODate(req.query.to)) throw new AppError('Enter a valid to date.', 400, 'VALIDATION');
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000+05:30`);
      if (req.query.to) query.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
    }
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);
    res.json({
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      logs: logs.map((log) => ({
        id: String(log._id),
        action: log.action,
        entity: log.entity,
        summary: log.summary,
        userName: log.userName,
        createdAt: log.createdAt,
      })),
    });
  })
);

export default router;
