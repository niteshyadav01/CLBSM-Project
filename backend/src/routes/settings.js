import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../services/settingsService.js';

const router = Router();

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    res.json({ businessName: settings.businessName });
  })
);

router.get(
  '/',
  requireAuth,
  requireRoles('admin', 'manager'),
  asyncHandler(async (req, res) => {
    res.json(await getSettings());
  })
);

router.put(
  '/',
  requireAuth,
  requireRoles('admin'),
  asyncHandler(async (req, res) => {
    const settings = await updateSettings(req.body, req.user);
    res.json({ message: 'Settings saved.', settings });
  })
);

export default router;
