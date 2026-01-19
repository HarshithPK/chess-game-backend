import http from 'http';

import { app } from './app';
import { initSocket } from './socket';
import { initDB } from './db';

import { ENV } from './config/env';

const server = http.createServer(app);

async function start() {
    await initDB();

    const server = http.createServer(app);

    // 🔌 Attach Socket.IO
    initSocket(server);

    server.listen(ENV.PORT, () => {
        console.log(`🚀 Backend running on http://localhost:${ENV.PORT}`);
    });
}

start();
