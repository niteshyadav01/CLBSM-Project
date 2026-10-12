import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { runSeed } from './seedData.js';

if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI in backend/.env before seeding.');
  process.exit(1);
}

await connectDB();
await runSeed();
await mongoose.disconnect();
console.log('Seed complete.');
