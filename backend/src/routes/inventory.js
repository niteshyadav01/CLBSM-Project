import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getInventory, getItemHistory } from '../services/inventoryService.js';
import { createAdjustment } from '../services/stockService.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getInventory({ from: req.query.from, to: req.query.to }));
  })
);

router.get(
  '/:itemId/history',
  asyncHandler(async (req, res) => {
    res.json(await getItemHistory(req.params.itemId, { from: req.query.from, to: req.query.to }));
  })
);

router.post(
  '/adjustments',
  requireRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const adjustment = await createAdjustment({ ...req.body, user: req.user });
    res.status(201).json({
      message: 'Stock adjustment recorded.',
      adjustment: {
        id: String(adjustment._id),
        date: adjustment.date,
        bottleDelta: adjustment.bottleDelta,
        reason: adjustment.reason,
      },
    });
  })
);

export default router;
