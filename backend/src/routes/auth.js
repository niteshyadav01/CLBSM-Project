import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { parseOrThrow, loginSchema, changePasswordSchema } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many sign-in attempts. Try again shortly.', code: 'RATE_LIMIT' },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = parseOrThrow(loginSchema, req.body);
    const user = await User.findOne({ username: username.toLowerCase() }).select('+password');
    if (!user || !user.active) throw new AppError('User name or password is incorrect.', 401, 'UNAUTHORIZED');
    const matches = await bcrypt.compare(password, user.password);
    if (!matches) throw new AppError('User name or password is incorrect.', 401, 'UNAUTHORIZED');
    const token = jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });
    await logAudit({
      user: { id: user._id, name: user.name },
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id,
      summary: `${user.name} signed in.`,
    });
    res.json({
      token,
      user: { id: String(user._id), name: user.name, username: user.username, role: user.role },
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.post(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parseOrThrow(changePasswordSchema, req.body);
    const user = await User.findById(req.user.id).select('+password');
    if (!user || !user.active) throw new AppError('Sign in again to change the password.', 401, 'UNAUTHORIZED');
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) throw new AppError('The current password is incorrect.', 400, 'VALIDATION');
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await logAudit({
      user: req.user,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: user._id,
      summary: `${user.name} changed the sign-in password.`,
    });
    res.json({ message: 'Password changed.' });
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await logAudit({
      user: req.user,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user.id,
      summary: `${req.user.name} signed out.`,
    });
    res.json({ message: 'Signed out.' });
  })
);

export default router;
