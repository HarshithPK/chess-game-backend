import { redis } from '../redis/client';
import { removeUserFromAllQueues } from './removeUser';

export async function tryMatchCasual(timeControl: string) {
    const queueKey = `mm:queue:${timeControl}`;

    const users = await redis.smembers(queueKey);
    if (users.length < 2) return null;

    // randomize slightly
    const [u1, u2] = users.slice(0, 2);

    const [u1Data, u2Data] = await Promise.all([
        redis.hgetall(`mm:user:${u1}`),
        redis.hgetall(`mm:user:${u2}`),
    ]);

    if (!u1Data.socketId || !u2Data.socketId) {
        await removeUserFromAllQueues(u1);
        await removeUserFromAllQueues(u2);
        return null;
    }

    return {
        timeControl,
        p1: { userId: u1, socketId: u1Data.socketId },
        p2: { userId: u2, socketId: u2Data.socketId },
    };
}
