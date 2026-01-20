import { redis } from '../redis/client';
import { ratingWindow } from './ratingWindow';
import { isPlacementPlayer } from './isPlacement';
import { PLACEMENT_GRACE_MS } from './constants';

export async function tryMatchRanked(timeControl: string) {
    const queueKey = `ranked:queue:${timeControl}`;
    const ratingKey = `ranked:queue:${timeControl}:rating`;
    const timeKey = `ranked:queue:${timeControl}:time`;

    const userIds = await redis.zrange(ratingKey, 0, -1);
    if (userIds.length < 2) return null;

    const now = Date.now();

    for (const userId of userIds) {
        const [ratingStr, joinedAtStr] = await Promise.all([
            redis.zscore(ratingKey, userId),
            redis.zscore(timeKey, userId),
        ]);

        if (!ratingStr || !joinedAtStr) continue;

        const rating = Number(ratingStr);
        const joinedAt = Number(joinedAtStr);
        const waitMs = now - joinedAt;

        const delta = ratingWindow(waitMs);
        const isPlacement = await isPlacementPlayer(userId);
        const strictPlacement = isPlacement && waitMs < PLACEMENT_GRACE_MS;

        const candidates = await redis.zrangebyscore(ratingKey, rating - delta, rating + delta);

        for (const opponentId of candidates) {
            if (opponentId === userId) continue;

            const opponentIsPlacement = await isPlacementPlayer(opponentId);

            // 🔒 Rule 1: Placement-only phase
            if (strictPlacement && !opponentIsPlacement) continue;

            // 🔒 Rule 2: Non-placement prefers non-placement
            if (!isPlacement && opponentIsPlacement) continue;

            // ✅ Match found — CLEANUP
            await redis
                .multi()
                .zrem(ratingKey, userId, opponentId)
                .zrem(timeKey, userId, opponentId)
                .srem(queueKey, userId, opponentId)
                .del(`mm:socket:${userId}`, `mm:socket:${opponentId}`)
                .exec();

            return {
                p1: userId,
                p2: opponentId,
                timeControl,
                ranked: true,
            };
        }
    }

    return null;
}
