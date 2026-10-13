import { z } from 'zod';
import { AppError } from './AppError.js';

const count = z.number().int().min(0).max(1_000_000);
const money = z.number().min(0).max(1_000_000);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.');

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Enter a user name of at least 3 characters.')
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, 'User names can use letters, numbers, dots, and hyphens.');

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const itemSchema = z.object({
  name: z.string().trim().min(1, 'Enter the item name.').max(80),
  category: z.string().trim().min(1).max(40).default('Liquor'),
  size: z.string().trim().min(1, 'Enter the bottle size.').max(40),
  unitsPerBox: z.number().int().min(1, 'Units per box must be at least 1.').max(10000),
  buyingPrice: money.optional(),
  sellingPrice: money,
  active: z.boolean().optional(),
});

export const itemStatusSchema = z.object({
  active: z.boolean(),
});

export const stockEntrySchema = z.object({
  itemId: z.string().min(1),
  existingId: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  openingBoxes: count,
  openingLoose: count,
  receivedBoxes: count,
  receivedLoose: count,
  closingBoxes: count,
  closingLoose: count,
});

export const saveStockSchema = z.object({
  date: isoDate,
  entries: z.array(stockEntrySchema).min(1, 'Add at least one item.').max(500),
});

export const adjustmentSchema = z.object({
  itemId: z.string().min(1),
  date: isoDate,
  boxesDelta: z.number().int().min(-1_000_000).max(1_000_000),
  looseDelta: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().trim().min(3, 'Enter a reason of at least 3 characters.').max(500),
});

export const collectionSchema = z.object({
  date: isoDate,
  cash: money.default(0),
  upi: money.default(0),
  card: money.default(0),
  other: money.default(0),
  expense: money.default(0),
  notes: z.string().trim().max(500).optional().default(''),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters and include a letter and a number.')
  .regex(/[A-Za-z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.');

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'manager', 'staff']),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['admin', 'manager', 'staff']).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Choose a new password that is different from the current one.',
    path: ['newPassword'],
  });

export const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  lowStockThresholdBottles: z.number().int().min(0).max(1_000_000),
});

export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(issues[0]?.message || 'Please check the entered values.', 400, 'VALIDATION', issues);
  }
  return result.data;
}
