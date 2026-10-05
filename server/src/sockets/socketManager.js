const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io = null;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_sdmas_access_token_key_2026');
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid socket authentication token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User ID: ${socket.user.id}, Store ID: ${socket.user.store_id})`);

    // Join store room
    if (socket.user.store_id) {
      socket.join(`store_${socket.user.store_id}`);
    }
    // Global admin room
    socket.join('all_stores');

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    logger.warn('Socket.io not initialized yet');
  }
  return io;
};

const broadcastStockUpdate = (storeId, data) => {
  if (io) {
    io.to(`store_${storeId}`).to('all_stores').emit('stock:updated', data);
  }
};

const broadcastAlert = (storeId, alertData) => {
  if (io) {
    io.to(`store_${storeId}`).to('all_stores').emit('alert:new', alertData);
  }
};

module.exports = {
  initSocket,
  getIO,
  broadcastStockUpdate,
  broadcastAlert
};
