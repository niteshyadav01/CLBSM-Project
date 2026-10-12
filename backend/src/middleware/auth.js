import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(new AppError('Please sign in to continue.', 401, 'UNAUTHORIZED'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (!user || !user.active) return next(new AppError('Your account is inactive or no longer exists.', 401, 'UNAUTHORIZED'));
    req.user = { id: String(user._id), role: user.role, name: user.name, username: user.username };
    return next();
  } catch {
    return next(new AppError('Your session has expired. Please sign in again.', 401, 'UNAUTHORIZED'));
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do that.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}
