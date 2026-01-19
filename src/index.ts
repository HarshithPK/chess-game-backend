import http from 'http';

import { app } from './app';
import { initSocket } from './socket';
import { initDB } from './db';
import { startMatchmakingCleanup } from './matchmaking/scheduler';

import { ENV } from './config/env';

const server = http.createServer(app);

async function start() {
    await initDB();

    const server = http.createServer(app);

    // 🔌 Attach Socket.IO
    const io = initSocket(server);

    startMatchmakingCleanup(io);

    server.listen(ENV.PORT, () => {
        console.log(`🚀 Backend running on http://localhost:${ENV.PORT}`);
    });
}

start();
