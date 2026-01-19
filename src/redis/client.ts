import Redis from 'ioredis';
import { ENV } from '../config/env';

export const redis = new Redis({
    host: ENV.REDIS.HOST,
    port: ENV.REDIS.PORT,
    password: ENV.REDIS.PASSWORD || undefined,
});
