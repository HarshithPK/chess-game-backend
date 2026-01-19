import { redis } from '../redis/client';

const TIME_CONTROLS = ['5+0', '3+2', '10+0']; // expand later

export async function removeUserFromAllQueues(userId: string) {
    const pipeline = redis.multi();

    for (const tc of TIME_CONTROLS) {
        pipeline.srem(`casual:queue:${tc}`, userId);
        pipeline.zrem(`casual:queue:${tc}:time`, userId);
    }

    await pipeline.exec();
}
