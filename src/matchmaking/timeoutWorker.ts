import { redis } from '../redis/client';
import { ENV } from '../config/env';
import { Server } from 'socket.io';

const MATCHMAKING_TIMEOUT_MS = ENV.MATCHMAKING.TIMEOUT;
const TIME_CONTROLS = ['5+0', '3+2', '10+0'];

export async function matchmakingTimeoutSweep(io: Server) {
    if (!Number.isFinite(MATCHMAKING_TIMEOUT_MS)) {
        console.error('❌ MATCHMAKING_TIMEOUT_MS is invalid:', MATCHMAKING_TIMEOUT_MS);
        return;
    }

    const now = Date.now();
    const cutoff = now - MATCHMAKING_TIMEOUT_MS;

    for (const tc of TIME_CONTROLS) {
        const queueKey = `casual:queue:${tc}`;
        const timeKey = `casual:queue:${tc}:time`;

        const expiredUserIds = await redis.zrangebyscore(timeKey, 0, cutoff);
        if (expiredUserIds.length === 0) continue;

        // 🔍 Fetch socketIds first
        const socketKeys = expiredUserIds.map((u) => `mm:socket:${u}`);
        const socketIds = await redis.mget(...socketKeys);

        const pipeline = redis.multi();

        expiredUserIds.forEach((userId) => {
            pipeline.srem(queueKey, userId);
            pipeline.zrem(timeKey, userId);
            pipeline.del(`mm:socket:${userId}`);
        });

        const result = await pipeline.exec();
        if (!result) continue; // Redis failure safety

        // 📡 Notify clients AFTER cleanup
        socketIds.forEach((socketId) => {
            if (socketId) {
                io.to(socketId).emit('matchmaking:timeout', {
                    timeControl: tc,
                });
            }
        });
    }
}
