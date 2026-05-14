import { createClient } from 'redis';
import type { DirectoryNode } from '../types.js';

let redisClient: ReturnType<typeof createClient> | null = null;
let isConnected = false;

async function connect(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️  Redis cache disabled: REDIS_URL environment variable not set');
    return;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err);
      isConnected = false;
    });

    await redisClient.connect();
    isConnected = true;
    console.log('Connected to Redis cache');
  } catch (error) {
    console.warn('Failed to connect to Redis:', error instanceof Error ? error.message : error);
    redisClient = null;
    isConnected = false;
  }
}

async function getCached(jobId: string): Promise<DirectoryNode | null> {
  if (!isConnected || !redisClient) {
    return null;
  }

  try {
    const cached = await redisClient.get(`job:${jobId}:result`);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as DirectoryNode;
  } catch (error) {
    console.warn('Redis get error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function setCached(jobId: string, result: DirectoryNode): Promise<void> {
  if (!isConnected || !redisClient) {
    return;
  }

  try {
    await redisClient.set(`job:${jobId}:result`, JSON.stringify(result), {
      EX: 86400, // 24 hours
    });
  } catch (error) {
    console.warn('Redis set error:', error instanceof Error ? error.message : error);
  }
}

async function disconnect(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}

export const redisCache = {
  connect,
  getCached,
  setCached,
  disconnect,
};
