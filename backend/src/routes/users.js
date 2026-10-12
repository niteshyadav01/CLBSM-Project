import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { parseOrThrow, userCreateSchema, userUpdateSchema } from '../utils/validate.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../services/auditService.js';

const router = Router();
router.use(requireAuth, requireRoles('admin'));

function present(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ role: 1, name: 1 });
    res.json({ users: users.map(present) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(userCreateSchema, req.body);
    const password = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      name: data.name,
      username: data.username.toLowerCase(),
      password,
      role: data.role,
      active: true,
    });
    await logAudit({
      user: req.user,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user._id,
      summary: `Created ${user.role} account for ${user.name}.`,
    });
    res.status(201).json({ user: present(user) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = parseOrThrow(userUpdateSchema, req.body);
    const user = await User.findById(req.params.id).select('+password');
    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
    const nextRole = data.role || user.role;
    const nextActive = data.active == null ? user.active : data.active;
    if (user.role === 'admin' && (nextRole !== 'admin' || nextActive === false)) {
      const others = await User.countDocuments({ role: 'admin', active: true, _id: { $ne: user._id } });
      if (others === 0) throw new AppError('At least one active admin is required.', 400, 'LAST_ADMIN');
    }
    if (String(user._id) === req.user.id && nextActive === false) {
      throw new AppError('You cannot deactivate your own account.', 400, 'VALIDATION');
    }
    if (data.name) user.name = data.name;
    if (data.role) user.role = data.role;
    if (data.active != null) user.active = data.active;
    if (data.password) user.password = await bcrypt.hash(data.password, 10);
    await user.save();
    await logAudit({
      user: req.user,
      action: 'USER_UPDATE',
      entity: 'User',
      entityId: user._id,
      summary: `Updated the account for ${user.name}.`,
    });
    res.json({ user: present(user) });
  })
);

export default router;
