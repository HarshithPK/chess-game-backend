import { redis } from '../redis/client';
import { removeUserFromAllQueues } from './removeUser';

export async function cleanupExpiredUsers() {
    const keys = await redis.keys('mm:user:*');

    const now = Date.now();

    for (const key of keys) {
        const joinedAt = await redis.hget(key, 'joinedAt');
        if (!joinedAt) continue;

        if (now - Number(joinedAt) > 30_000) {
            const userId = key.split(':')[2];
            await removeUserFromAllQueues(userId);
        }
    }
}
