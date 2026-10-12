import mongoose from 'mongoose';

const dailyCollectionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    cash: { type: Number, default: 0, min: 0 },
    upi: { type: Number, default: 0, min: 0 },
    card: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
    expense: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '', trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const DailyCollection = mongoose.model('DailyCollection', dailyCollectionSchema);
