import { redis } from '../redis/client';

export async function enqueueRanked({
    userId,
    socketId,
    rating,
    timeControl,
    isPlacement,
}: {
    userId: string;
    socketId: string;
    rating: number;
    timeControl: string;
    isPlacement: boolean;
}) {
    const base = `ranked:queue:${timeControl}`;

    const multi = redis.multi();

    multi.sadd(base, userId);
    multi.zadd(`${base}:rating`, rating, userId);
    multi.zadd(`${base}:time`, Date.now(), userId);
    multi.set(`mm:socket:${userId}`, socketId);

    if (isPlacement) {
        multi.sadd(`${base}:placement`, userId);
    }

    await multi.exec();
}
