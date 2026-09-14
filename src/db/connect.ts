import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);

  // 2019 logged the connection error and carried on serving traffic against a
  // database that was not there. Let it throw; the caller decides.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  logger.info('MongoDB connected');

  mongoose.connection.on('error', (error) => logger.error({ err: error }, 'MongoDB error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
