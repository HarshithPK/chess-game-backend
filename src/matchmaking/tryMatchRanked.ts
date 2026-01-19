import { redis } from '../redis/client';

const BASE_WINDOW = 50;
const EXPAND_PER_SEC = 10;

export async function tryMatchRanked(timeControl: string) {
    const queueKey = `ranked:queue:${timeControl}`;
    const timeKey = `ranked:queue:${timeControl}:time`;

    const users = await redis.zrange(queueKey, 0, -1, 'WITHSCORES');
    if (users.length < 4) return null;

    for (let i = 0; i < users.length; i += 2) {
        const u1 = users[i];
        const u2 = users[i + 2];
        if (!u2) continue;

        const rating1 = Number(users[i + 1]);
        const rating2 = Number(users[i + 3]);

        const joinTime1 = Number(await redis.zscore(timeKey, u1));
        const waitSec = (Date.now() - joinTime1) / 1000;

        const window = BASE_WINDOW + waitSec * EXPAND_PER_SEC;

        if (Math.abs(rating1 - rating2) <= window) {
            await redis.multi().zrem(queueKey, u1, u2).zrem(timeKey, u1, u2).exec();

            return { p1: u1, p2: u2 };
        }
    }

    return null;
}
