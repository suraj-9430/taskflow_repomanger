import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';

let io: SocketIOServer;

// Map of userId to a Set of socketIds
const userSockets = new Map<string, Set<string>>();

export const initSocket = (server: HttpServer) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4200',
    'http://localhost:5173',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
  ];

  if (config.corsOrigin) {
    const origins = config.corsOrigin.split(',').map(o => o.trim());
    allowedOrigins.push(...origins);
  }

  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (config.nodeEnv === 'development') return callback(null, true);
        
        const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
        const isAllowed = allowedOrigins.some(allowed => {
          const cleanAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
          return cleanAllowed === cleanOrigin || cleanAllowed === '*';
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_me';
      const decoded = jwt.verify(token, secret) as { user: { id: string; role: string } };
      socket.data.userId = decoded.user.id;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`🔌 Socket connected: ${socket.id} (User: ${userId})`);

    // Register user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)?.add(socket.id);

    socket.on('join_task', (taskId: string) => {
      socket.join(`task_${taskId}`);
      console.log(`📡 User ${userId} joined room task_${taskId}`);
    });

    socket.on('leave_task', (taskId: string) => {
      socket.leave(`task_${taskId}`);
      console.log(`📡 User ${userId} left room task_${taskId}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id} (User: ${userId})`);
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  console.log('✅ Socket.io initialized');
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) return; // Do not throw if io is not initialized to avoid breaking logic if socket is disabled
  const userSocketSet = userSockets.get(userId.toString());
  if (userSocketSet) {
    userSocketSet.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
    console.log(`📡 Emitted '${event}' to user ${userId} (sockets: ${userSocketSet.size})`);
  }
};
