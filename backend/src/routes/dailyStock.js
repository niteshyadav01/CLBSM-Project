import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { deleteDailyStock, getDailyStockSheet, saveDailyStock } from '../services/stockService.js';
import { formatDisplayDate } from '../utils/dates.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sheet = await getDailyStockSheet(req.query.date);
    res.json(sheet);
  })
);

router.put(
  '/',
  requireRoles('admin', 'manager', 'staff'),
  asyncHandler(async (req, res) => {
    const result = await saveDailyStock({ date: req.body.date, entries: req.body.entries, user: req.user });
    const sheet = await getDailyStockSheet(req.body.date);
    res.json({
      message: `Stock saved for ${formatDisplayDate(req.body.date)}.`,
      warnings: result.warnings,
      sheet,
    });
  })
);

router.delete(
  '/:id',
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const removed = await deleteDailyStock(req.params.id, req.user);
    res.json({ message: `Deleted the stock entry for ${removed.itemName}.`, removed });
  })
);

export default router;
