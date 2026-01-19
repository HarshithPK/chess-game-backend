import { redis } from '../redis/client';

export async function recordMatch(timeControl: string) {
    const key = `mm:matches:${timeControl}`;
    const now = Date.now();

    // store timestamps of matches
    await redis.zadd(key, now, String(now));

    // keep last 10 minutes only
    await redis.zremrangebyscore(key, 0, now - 10 * 60 * 1000);
}
