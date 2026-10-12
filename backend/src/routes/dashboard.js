import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { getDashboard } from '../services/dashboardService.js';
import { todayISO } from '../utils/dates.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const to = req.query.to || req.query.date || todayISO();
    const from = req.query.from || to;
    res.json(await getDashboard(from, to));
  })
);

export default router;
