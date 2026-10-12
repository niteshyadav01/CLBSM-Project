import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { createItem, listItems, removeItem, setItemStatus, updateItem } from '../services/itemService.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listItems({
      search: req.query.search || '',
      includeInactive: req.query.includeInactive !== 'false',
    });
    res.json({ items });
  })
);

router.post('/', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
  const item = await createItem(req.body, req.user);
  res.status(201).json({ item });
}));

router.put('/:id', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
  const item = await updateItem(req.params.id, req.body, req.user);
  res.json({ item });
}));

router.patch('/:id/status', requireRoles('admin', 'manager'), asyncHandler(async (req, res) => {
  const item = await setItemStatus(req.params.id, req.body, req.user);
  res.json({ item });
}));

router.delete('/:id', requireRoles('admin'), asyncHandler(async (req, res) => {
  await removeItem(req.params.id, req.user);
  res.json({ message: 'Item deleted.' });
}));

export default router;
