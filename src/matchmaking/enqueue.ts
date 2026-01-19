import { redis } from '../redis/client';
import { ENV } from '../config/env';

export async function enqueueCasual({
    userId,
    socketId,
    timeControl,
}: {
    userId: string;
    socketId: string;
    timeControl: string;
}) {
    const queueKey = `casual:queue:${timeControl}`;
    const timeKey = `casual:queue:${timeControl}:time`;
    const socketKey = `mm:socket:${userId}`;

    const now = Date.now();

    await redis
        .multi()
        // queue membership
        .sadd(queueKey, userId)
        // enqueue timestamp
        .zadd(timeKey, now, userId)
        // socket mapping (used by timeout worker)
        .set(socketKey, socketId, 'PX', ENV.MATCHMAKING.TIMEOUT)
        .exec();
}
