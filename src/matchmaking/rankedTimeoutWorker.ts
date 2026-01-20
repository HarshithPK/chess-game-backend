import { Server } from 'socket.io';

import { redis } from '../redis/client';
import { RANKED_MATCHMAKING_TIMEOUTS } from './timeouts';

export async function rankedMatchmakingTimeoutSweep(io: Server) {
    const now = Date.now();

    for (const [timeControl, timeoutMs] of Object.entries(RANKED_MATCHMAKING_TIMEOUTS)) {
        if (!Number.isFinite(timeoutMs)) {
            console.error(`❌ Invalid ranked TTL for ${timeControl}`);
            continue;
        }

        const queueKey = `ranked:queue:${timeControl}`;
        const ratingKey = `ranked:queue:${timeControl}:rating`;
        const timeKey = `ranked:queue:${timeControl}:time`;

        const cutoff = now - timeoutMs;

        const expiredUserIds = await redis.zrangebyscore(timeKey, 0, cutoff);
        if (expiredUserIds.length === 0) continue;

        // Resolve socket IDs first
        const socketKeys = expiredUserIds.map((u) => `mm:socket:${u}`);
        const socketIds = await redis.mget(...socketKeys);

        const pipeline = redis.multi();

        for (const userId of expiredUserIds) {
            pipeline.srem(queueKey, userId);
            pipeline.zrem(ratingKey, userId);
            pipeline.zrem(timeKey, userId);
            pipeline.del(`mm:socket:${userId}`);
        }

        const result = await pipeline.exec();
        if (!result) continue;

        // Notify AFTER cleanup
        socketIds.forEach((socketId) => {
            if (socketId) {
                io.to(socketId).emit('matchmaking:timeout', {
                    ranked: true,
                    timeControl,
                });
            }
        });
    }
}
