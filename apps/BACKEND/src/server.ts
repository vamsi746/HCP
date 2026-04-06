import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import cron from 'node-cron';
import { config } from './config';
import { connectDB } from './config/database';
import { logger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { checkMissedAction, checkInactiveSIs } from './services/escalation';

import authRoutes from './routes/auth.routes';
import officerRoutes from './routes/officers.routes';
import dsrRoutes from './routes/dsr.routes';
import caseRoutes from './routes/cases.routes';
import violationRoutes from './routes/violations.routes';
import actionRoutes from './routes/actions.routes';
import appealRoutes from './routes/appeals.routes';
import zoneRoutes from './routes/zones.routes';
import reportRoutes from './routes/reports.routes';
import mappingRoutes from './routes/mapping.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use('/api', apiLimiter);

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/dsr', dsrRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/violations', violationRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/appeals', appealRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/mapping', mappingRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Cron jobs: run escalation checks every hour
cron.schedule('0 * * * *', async () => {
  try {
    await checkMissedAction({});
    await checkInactiveSIs();
    logger.info('Escalation checks completed');
  } catch (err) {
    logger.error('Escalation cron error', err);
  }
});

// Start
const PORT = config.port;
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`API server running on port ${PORT}`);
  });
});

export default app;
