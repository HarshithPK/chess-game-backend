import { redis } from '../redis/client';

export async function enqueueRanked({
    userId,
    rating,
    timeControl,
}: {
    userId: string;
    rating: number;
    timeControl: string;
}) {
    const queueKey = `ranked:queue:${timeControl}`;
    const timeKey = `ranked:queue:${timeControl}:time`;
    const now = Date.now();

    await redis.multi().zadd(queueKey, rating, userId).zadd(timeKey, now, userId).exec();
}
