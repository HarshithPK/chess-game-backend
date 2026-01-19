import Redis from 'ioredis';
import { ENV } from '../config/env';

export const redis = new Redis({
    host: ENV.REDIS.HOST,
    port: ENV.REDIS.PORT,
    maxRetriesPerRequest: 5,
    retryStrategy: (times) => Math.min(times * 100, 2000),
});

redis.on('connect', () => {
    console.log('✅ Redis connected');
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
});
