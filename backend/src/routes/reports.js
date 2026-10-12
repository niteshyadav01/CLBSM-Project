import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { createReport } from '../services/reportService.js';
import { exportReport } from '../services/exportService.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
router.use(requireAuth, requireRoles('admin', 'manager'));

router.get(
  '/:type/export',
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || '');
    if (!['xlsx', 'csv', 'pdf'].includes(format)) throw new AppError('Choose an Excel, CSV, or PDF export.', 400, 'VALIDATION');
    const report = await createReport(req.params.type, req.query);
    const file = await exportReport(report, format);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  })
);

router.get(
  '/:type',
  asyncHandler(async (req, res) => {
    res.json(await createReport(req.params.type, req.query));
  })
);

export default router;
