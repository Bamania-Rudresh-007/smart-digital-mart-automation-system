import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  if (!socket && token) {
    socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });
  }
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
