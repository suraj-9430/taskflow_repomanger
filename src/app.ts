import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';

// Import routes
import userRoutes from './routes/user.routes';
import forwardContractRoutes from './routes/forwardContract.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';

const app: Application = express();



app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4200','http://localhost:5173'],
  credentials: true,
  // or for development: origin: '*'
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
app.use('/api/forward-contracts', forwardContractRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

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
