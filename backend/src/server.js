import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { ensureUsernames, runSeed } from './seedData.js';

const port = Number(process.env.PORT || 5000);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.error('JWT_SECRET must be set to a random string of at least 20 characters.');
  process.exit(1);
}

try {
  await connectDB();
  await ensureUsernames();
  if (process.env.SEED_ON_START === 'true') await runSeed();
  const app = createApp();
  app.listen(port, () => {
    console.log(`CLBSM API listening on port ${port}`);
  });
} catch (error) {
  console.error('Failed to start the API:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}
