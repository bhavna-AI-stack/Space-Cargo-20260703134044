import { io } from 'socket.io-client';
import { useStore } from './useStore';

const SOCKET_URL = 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false // Connect after auth
});

export const initSocket = (userId: string) => {
  socket.auth = { userId };
  socket.connect();

  socket.on('connect', () => {
    console.log('Connected to socket server');
  });

  socket.on('scoreUpdated', (updatedUser) => {
    useStore.getState().setUser(updatedUser);
  });
};
