import mongoose from 'mongoose';

const dailyStockSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    itemName: { type: String, required: true },
    category: { type: String, required: true },
    size: { type: String, required: true },
    unitsPerBox: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    openingBoxes: { type: Number, required: true, min: 0 },
    openingLoose: { type: Number, required: true, min: 0 },
    receivedBoxes: { type: Number, required: true, min: 0 },
    receivedLoose: { type: Number, required: true, min: 0 },
    closingBoxes: { type: Number, required: true, min: 0 },
    closingLoose: { type: Number, required: true, min: 0 },
    adjustmentBottles: { type: Number, default: 0 },
    openingTotal: { type: Number, required: true },
    receivedTotal: { type: Number, required: true },
    closingTotal: { type: Number, required: true },
    availableTotal: { type: Number, required: true },
    soldBottles: { type: Number, required: true, min: 0 },
    salesRevenue: { type: Number, required: true, min: 0 },
    flags: [{ type: String }],
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

dailyStockSchema.index({ date: 1, item: 1 }, { unique: true });
dailyStockSchema.index({ date: 1 });
dailyStockSchema.index({ item: 1, date: -1 });

export const DailyStock = mongoose.model('DailyStock', dailyStockSchema);
