import mongoose from 'mongoose';

let transactionsSupported;

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri);
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
