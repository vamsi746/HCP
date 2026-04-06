import mongoose from 'mongoose';
import logger from './logger';
import { config } from './index';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}
