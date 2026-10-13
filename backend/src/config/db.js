import mongoose from 'mongoose';

let transactionsSupported;

export function normalizeMongoUri(uri) {
  const parsed = new URL(uri);
  if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = '/clbsm';
  return parsed.toString();
}

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }
  const target = normalizeMongoUri(uri);
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(target, { serverSelectionTimeoutMS: 10_000 });
  return mongoose.connection;
}

export async function withTransaction(work) {
  if (transactionsSupported === false) return work(null);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await work(session);
    await session.commitTransaction();
    transactionsSupported = true;
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    const message = String(error?.message || '');
    const unsupported = message.includes('Transaction numbers are only allowed') || message.includes('replica set');
    if (unsupported && transactionsSupported !== true) {
      transactionsSupported = false;
      return work(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
}

export function q(query, session) {
  if (session) query.session(session);
  return query;
}
