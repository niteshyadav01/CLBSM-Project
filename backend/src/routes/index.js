import { Router } from 'express';
import auth from './auth.js';
import items from './items.js';
import dailyStock from './dailyStock.js';
import sales from './sales.js';
import inventory from './inventory.js';
import reports from './reports.js';
import users from './users.js';
import settings from './settings.js';
import audit from './audit.js';
import dashboard from './dashboard.js';

const router = Router();
router.use('/auth', auth);
router.use('/items', items);
router.use('/daily-stock', dailyStock);
router.use('/sales', sales);
router.use('/inventory', inventory);
router.use('/reports', reports);
router.use('/users', users);
router.use('/settings', settings);
router.use('/audit', audit);
router.use('/dashboard', dashboard);

export default router;
