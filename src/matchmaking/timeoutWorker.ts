import { redis } from '../redis/client';
import { ENV } from '../config/env';
import { Server } from 'socket.io';

const MATCHMAKING_TIMEOUT_MS = ENV.MATCHMAKING.TIMEOUT;
const TIME_CONTROLS = ['5+0', '3+2', '10+0'];

export async function matchmakingTimeoutSweep(io: Server) {
    const now = Date.now();

    for (const tc of TIME_CONTROLS) {
        const queueKey = `casual:queue:${tc}`;
        const timeKey = `casual:queue:${tc}:time`;

        // Users whose queue time expired
        const expiredUserIds = await redis.zrangebyscore(timeKey, 0, now - MATCHMAKING_TIMEOUT_MS);

        if (expiredUserIds.length === 0) continue;

        const pipeline = redis.multi();

        for (const userId of expiredUserIds) {
            pipeline.srem(queueKey, userId);
            pipeline.zrem(timeKey, userId);

            // Lookup socketId
            const socketKey = `mm:socket:${userId}`;
            const socketId = await redis.get(socketKey);

            if (socketId) {
                io.to(socketId).emit('matchmaking:timeout', {
                    timeControl: tc,
                });
            }

            pipeline.del(socketKey);
        }

        await pipeline.exec();
    }
}
