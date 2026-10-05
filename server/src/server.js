const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./sockets/socketManager');
const { initScheduler } = require('./jobs/scheduler');
const setupSwagger = require('./config/swagger');
const logger = require('./utils/logger');

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
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

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

module.exports = { app, server };
