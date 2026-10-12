import { fileURLToPath } from 'node:url';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import 'dotenv/config';

import { sequelize } from './models/index.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import { initSocket } from './sockets/socketManager.js';
import { initScheduler } from './jobs/scheduler.js';
import setupSwagger from './config/swagger.js';
import logger from './utils/logger.js';

const app = express();
const server = http.createServer(app);

// Security & Base Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static Uploads Folder
app.use('/uploads', express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')));

// Swagger API Docs
setupSwagger(app);

// API Routes
app.use('/api', routes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Centralized Error Handling
app.use(errorHandler);

// Initialize Socket.io
initSocket(server);

// Initialize Background Job Scheduler
initScheduler();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    // Sync models in development if needed
    await sequelize.sync();

    server.listen(PORT, () => {
      logger.info(`==================================================`);
      logger.info(` SDMAS Backend Server running on port ${PORT}`);
      logger.info(` API Documentation available at http://localhost:${PORT}/api/docs`);
      logger.info(`==================================================`);
    });
  } catch (error) {
    logger.error('Unable to connect to database or start server: ' + error.message);
    console.error(error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, server };
