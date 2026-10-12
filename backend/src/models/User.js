import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'manager', 'staff'], required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
