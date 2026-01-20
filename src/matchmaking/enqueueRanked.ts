import { redis } from '../redis/client';

export async function enqueueRanked({
    userId,
    socketId,
    rating,
    timeControl,
}: {
    userId: string;
    socketId: string;
    rating: number;
    timeControl: string;
}) {
    const queueKey = `ranked:queue:${timeControl}`;
    const ratingKey = `ranked:queue:${timeControl}:rating`;
    const timeKey = `ranked:queue:${timeControl}:time`;

    const now = Date.now();

    await redis
        .multi()
        .sadd(queueKey, userId) // O(1) membership
        .zadd(ratingKey, rating, userId) // rating ordering
        .zadd(timeKey, now, userId) // TTL tracking
        .set(`mm:socket:${userId}`, socketId) // timeout notify
        .exec();
}
