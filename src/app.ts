import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';

// Import routes
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import notificationRoutes from './routes/notification.routes';
import attendanceRoutes from './routes/attendance.routes';
import aiRoutes from './routes/ai.routes';
import leaveRoutes from './routes/leave.routes';

const app: Application = express();



const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost:5173',
  // Capacitor Android & iOS origins
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  // LAN access for mobile testing
];

if (config.corsOrigin) {
  // Support single origin or multiple comma-separated origins
  const origins = config.corsOrigin.split(',').map(o => o.trim());
  allowedOrigins.push(...origins);
}


app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow ALL origins (Capacitor WebView origins vary)
    if (config.nodeEnv === 'development') return callback(null, true);
    
    // Normalize both incoming origin and allowed origins to strip trailing slash
    const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const isAllowed = allowedOrigins.some(allowed => {
      const cleanAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
      return cleanAllowed === cleanOrigin || cleanAllowed === '*';
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from origin: "${origin}". Allowed origins:`, allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/leaves', leaveRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

export default app;
