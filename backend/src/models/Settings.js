import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    businessName: { type: String, required: true, default: 'Country Liquor Bar' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    lowStockThresholdBottles: { type: Number, default: 48, min: 0 },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);

export const SETTINGS_DEFAULTS = {
  businessName: 'Country Liquor Bar',
  address: '',
  phone: '',
  lowStockThresholdBottles: 48,
};
