import { Settings, SETTINGS_DEFAULTS } from '../models/Settings.js';
import { parseOrThrow, settingsSchema } from '../utils/validate.js';
import { logAudit } from './auditService.js';

export async function getSettings() {
  const doc = await Settings.findOne({ key: 'app' }).lean();
  return {
    businessName: doc?.businessName || SETTINGS_DEFAULTS.businessName,
    address: doc?.address || '',
    phone: doc?.phone || '',
    lowStockThresholdBottles: doc?.lowStockThresholdBottles ?? SETTINGS_DEFAULTS.lowStockThresholdBottles,
  };
}

export async function updateSettings(body, user) {
  const data = parseOrThrow(settingsSchema, body);
  const settings = await Settings.findOneAndUpdate({ key: 'app' }, { key: 'app', ...data }, { upsert: true, new: true });
  await logAudit({
    user,
    action: 'SETTINGS_UPDATE',
    entity: 'Settings',
    entityId: settings._id,
    summary: `Updated business settings for ${settings.businessName}.`,
  });
  return getSettings();
}
