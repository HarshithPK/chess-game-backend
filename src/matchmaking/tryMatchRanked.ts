import { redis } from '../redis/client';
import { ratingWindow } from './ratingWindow';

export async function tryMatchRanked(timeControl: string) {
    const base = `ranked:queue:${timeControl}`;
    const now = Date.now();

    /* ========= LOAD QUEUE ORDERED BY TIME ========= */

    const usersWithTime = await redis.zrange(`${base}:time`, 0, -1, 'WITHSCORES');

    if (usersWithTime.length < 4) return null; // need ≥ 2 players

    const queue: { userId: string; joinedAt: number }[] = [];
    for (let i = 0; i < usersWithTime.length; i += 2) {
        queue.push({
            userId: usersWithTime[i],
            joinedAt: Number(usersWithTime[i + 1]),
        });
    }

    /* ========= LOAD RATINGS ========= */

    const ratingsRaw = await redis.zrange(`${base}:rating`, 0, -1, 'WITHSCORES');

    const ratingMap = new Map<string, number>();
    for (let i = 0; i < ratingsRaw.length; i += 2) {
        ratingMap.set(ratingsRaw[i], Number(ratingsRaw[i + 1]));
    }

    /* ========= LOAD PLACEMENT FLAGS ========= */

    const placementSet = `${base}:placement`;
    const placementFlags = await redis.smismember(placementSet, ...queue.map((q) => q.userId));

    const isPlacement = new Map<string, boolean>();
    queue.forEach((q, i) => {
        isPlacement.set(q.userId, placementFlags[i] === 1);
    });

    /* ========= MATCHING LOGIC ========= */

    for (let i = 0; i < queue.length; i++) {
        const a = queue[i];
        const ratingA = ratingMap.get(a.userId);
        if (ratingA == null) continue;

        const windowA = ratingWindow(now - a.joinedAt);
        const aIsPlacement = isPlacement.get(a.userId) ?? false;

        for (let j = i + 1; j < queue.length; j++) {
            const b = queue[j];
            const ratingB = ratingMap.get(b.userId);
            if (ratingB == null) continue;

            const windowB = ratingWindow(now - b.joinedAt);
            const allowedDiff = Math.min(windowA, windowB);

            const bIsPlacement = isPlacement.get(b.userId) ?? false;

            // 🔒 Placement players match together FIRST
            if (aIsPlacement !== bIsPlacement) continue;

            if (Math.abs(ratingA - ratingB) <= allowedDiff) {
                return await finalizeMatch(base, a.userId, b.userId, aIsPlacement && bIsPlacement);
            }
        }
    }

    return null;
}

/* ========= FINALIZE MATCH ========= */

async function finalizeMatch(base: string, u1: string, u2: string, placementMatch: boolean) {
    const [s1, s2] = await redis.mget(`mm:socket:${u1}`, `mm:socket:${u2}`);

    const multi = redis.multi();

    for (const u of [u1, u2]) {
        multi.srem(base, u);
        multi.zrem(`${base}:rating`, u);
        multi.zrem(`${base}:time`, u);
        multi.srem(`${base}:placement`, u);
        multi.del(`mm:socket:${u}`);
    }

    await multi.exec();

    return {
        p1: s1!,
        p2: s2!,
        isPlacementMatch: placementMatch,
    };
}
