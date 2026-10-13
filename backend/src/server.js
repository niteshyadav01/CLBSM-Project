import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { validateRuntimeConfig } from './config/runtimeConfig.js';
import { bootstrapProduction } from './seedData.js';

const port = Number(process.env.PORT || 5000);

try {
  validateRuntimeConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

let server;
try {
  await connectDB();
  await bootstrapProduction();
  const app = createApp();
  server = app.listen(port, '0.0.0.0', () => {
    console.log(`CLBSM API listening on port ${port}`);
  });
} catch (error) {
  const reason = String(error.message || 'Unknown error').replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[database]');
  console.error('Failed to start the API:', reason);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing the API.`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();
  server.close(async (error) => {
    if (error) {
      console.error('Failed to close the HTTP server cleanly.');
      process.exitCode = 1;
    }
    await mongoose.disconnect().catch(() => {});
    clearTimeout(forceExit);
    process.exit(process.exitCode || 0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
