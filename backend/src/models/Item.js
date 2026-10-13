import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'Liquor' },
    size: { type: String, required: true, trim: true },
    unitsPerBox: { type: Number, required: true, min: 1 },
    buyingPrice: { type: Number, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    currentBoxes: { type: Number, default: 0, min: 0 },
    currentLoose: { type: Number, default: 0, min: 0 },
    stockAsOfDate: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Item = mongoose.model('Item', itemSchema);
