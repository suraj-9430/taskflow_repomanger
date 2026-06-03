import app from './app';
import connectDB from './config/database';
import { config } from './config';

import http from 'http';
import { initSocket } from './utils/socket';

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.io
    initSocket(server);
    
    // Start the server
    server.listen(config.port, () => {
      console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}`);
    });

    // Start background email worker in the same process in production (Render)
    if (config.nodeEnv === 'production') {
      import('./workers/email.worker')
        .then(() => console.log('🏃 Background Email Worker started inline successfully'))
        .catch(err => console.error('❌ Failed to start inline Background Email Worker:', err));
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

startServer();
