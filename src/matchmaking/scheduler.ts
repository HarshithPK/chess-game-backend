import { Server } from 'socket.io';
import { matchmakingTimeoutSweep } from './timeoutWorker';

export function startMatchmakingCleanup(io: Server) {
    setInterval(() => {
        matchmakingTimeoutSweep(io).catch(console.error);
    }, 5_000);
}
