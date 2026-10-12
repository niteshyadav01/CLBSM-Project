import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getSalesDay, saveCollection } from '../services/salesService.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getSalesDay(req.query.date));
  })
);

router.put(
  '/collection',
  requireRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    const sales = await saveCollection(req.body, req.user);
    res.json({ message: 'Collections saved.', ...sales });
  })
);

export default router;
