import { redis } from '../redis/client';

const QUEUE_KEY = 'casual:queue';

export interface QueueEntry {
    userId: string;
    socketId: string;
    timeControl: string;
    joinedAt: number;
}

export async function enqueue(entry: QueueEntry) {
    await redis.rpush(QUEUE_KEY, JSON.stringify(entry));
}

export async function dequeue(): Promise<QueueEntry | null> {
    const raw = await redis.lpop(QUEUE_KEY);
    return raw ? JSON.parse(raw) : null;
}

export async function peek(): Promise<QueueEntry | null> {
    const raw = await redis.lindex(QUEUE_KEY, 0);
    return raw ? JSON.parse(raw) : null;
}

export async function removeByUserId(userId: string) {
    const entries = await redis.lrange(QUEUE_KEY, 0, -1);

    for (const entry of entries) {
        const parsed = JSON.parse(entry);

        if (parsed.userId === userId) {
            await redis.lrem(QUEUE_KEY, 1, entry);
            break;
        }
    }
}
