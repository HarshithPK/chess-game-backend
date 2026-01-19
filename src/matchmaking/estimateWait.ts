import { redis } from '../redis/client';

export async function estimateWaitTime(timeControl: string) {
    const queueKey = `casual:queue:${timeControl}`;
    const matchKey = `mm:matches:${timeControl}`;

    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes

    const [queueSize, matches] = await Promise.all([
        redis.scard(queueKey),
        redis.zcount(matchKey, now - windowMs, now),
    ]);

    // Not enough data → fallback
    if (matches === 0 || queueSize < 2) {
        return {
            min: 10,
            max: 60,
            confidence: 'low',
        };
    }

    // matches per second
    const matchRate = matches / (windowMs / 1000);

    // players ahead / players consumed per match (2)
    const estimatedSeconds = Math.ceil(queueSize / 2 / matchRate);

    return {
        min: Math.max(5, Math.floor(estimatedSeconds * 0.7)),
        max: Math.ceil(estimatedSeconds * 1.3),
        confidence: 'medium',
    };
}
