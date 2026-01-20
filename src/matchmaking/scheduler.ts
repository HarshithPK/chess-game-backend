import { Server } from 'socket.io';

import { matchmakingTimeoutSweep } from './timeoutWorker';
import { rankedMatchmakingTimeoutSweep } from './rankedTimeoutWorker';

export function startMatchmakingCleanup(io: Server) {
    setInterval(async () => {
        await matchmakingTimeoutSweep(io);
        await rankedMatchmakingTimeoutSweep(io);
    }, 2_000);
}
