import mongoose from 'mongoose';

const stockAdjustmentSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    itemName: { type: String, required: true },
    unitsPerBox: { type: Number, required: true },
    boxesDelta: { type: Number, required: true },
    looseDelta: { type: Number, required: true },
    bottleDelta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
  },
  { timestamps: true }
);

stockAdjustmentSchema.index({ item: 1, date: 1 });
stockAdjustmentSchema.index({ date: 1 });

export const StockAdjustment = mongoose.model('StockAdjustment', stockAdjustmentSchema);
