import { createClient } from 'redis';

// Create a Redis client
export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// Connect to Redis
export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Could not connect to Redis:', error);
  }
};
