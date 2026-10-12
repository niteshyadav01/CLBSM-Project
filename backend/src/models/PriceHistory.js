import mongoose from 'mongoose';

const priceHistorySchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    itemName: { type: String, required: true },
    price: { type: Number, required: true },
    previousPrice: { type: Number, default: null },
    effectiveFrom: { type: Date, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

priceHistorySchema.index({ item: 1, effectiveFrom: -1 });

export const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
