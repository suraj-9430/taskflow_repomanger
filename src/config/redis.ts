import { createClient } from 'redis';

let isRedisConnected = false;
const inMemoryStore = new Map<string, { value: string; expiresAt: number }>();

const realRedisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 2) {
        return false;
      }
      return 500;
    }
  }
});

let errorLogged = false;

realRedisClient.on('error', () => {
  isRedisConnected = false;
  if (!errorLogged) {
    console.warn('⚠️  Local Redis server not found. Switching to in-memory store.');
    errorLogged = true;
  }
});

realRedisClient.on('connect', () => {
  isRedisConnected = true;
  errorLogged = false;
  console.log('✅ Redis Client Connected');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await realRedisClient.connect();
  } catch (error) {
    isRedisConnected = false;
  }
};

class RedisService {
  async setEx(key: string, seconds: number, value: string): Promise<string> {
    if (isRedisConnected && realRedisClient.isOpen) {
      try {
        await realRedisClient.setEx(key, seconds, value);
        return 'OK';
      } catch (err) {
        console.warn('⚠️  Redis setEx error, falling back to in-memory store:', err);
      }
    }
    inMemoryStore.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (isRedisConnected && realRedisClient.isOpen) {
      try {
        return await realRedisClient.get(key);
      } catch (err) {
        console.warn('⚠️  Redis get error, falling back to in-memory store:', err);
      }
    }
    const item = inMemoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async del(key: string): Promise<number> {
    if (isRedisConnected && realRedisClient.isOpen) {
      try {
        return await realRedisClient.del(key);
      } catch (err) {
        console.warn('⚠️  Redis del error, falling back to in-memory store:', err);
      }
    }
    const existed = inMemoryStore.has(key);
    inMemoryStore.delete(key);
    return existed ? 1 : 0;
  }
}

export const redisClient = new RedisService();

