import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (value === undefined) {
        throw new Error(`❌ Missing environment variable: ${name}`);
    }
    return value;
}

export const ENV = {
    /* ===== APP ===== */
    PORT: Number(requireEnv('PORT', '4000')),
    NODE_ENV: requireEnv('NODE_ENV', 'development'),
    CLIENT_URL: requireEnv('CLIENT_URL', '*'),
    DISCONNECT_TIMEOUT: Number(requireEnv('DISCONNECT_TIMEOUT', '30000')),

    /* ===== DATABASE (Postgres) ===== */
    DB: {
        NAME: requireEnv('DB_NAME'),
        USER: requireEnv('DB_USER'),
        PASSWORD: requireEnv('DB_PASSWORD'),
        HOST: requireEnv('DB_HOST', 'localhost'),
        PORT: Number(requireEnv('DB_PORT', '5432')),
    },

    /* ===== AUTH ===== */
    JWT: {
        SECRET: requireEnv('JWT_SECRET'),
        EXPIRES_IN: requireEnv('JWT_EXPIRES_IN', '7d'),
    },

    /* ===== REDIS ===== */
    REDIS: {
        HOST: requireEnv('REDIS_HOST', 'localhost'),
        PORT: Number(requireEnv('REDIS_PORT', '6379')),
        PASSWORD: requireEnv('REDIS_PASSWORD'),
    },

    /* ===== MATCHMAKING ===== */
    MATCHMAKING: {
        TIMEOUT: Number(requireEnv('MATCHMAKING_TIMEOUT_MS', '30_000')),
    },

    /* ===== STOCKFISH ===== */
    STOCKFISH: {
        WINDOWS_PATH: requireEnv(
            'STOCKFISH_WINDOWS_PATH',
            'src/engine/stockfish/stockfish-windows.exe'
        ),
        LINUX_PATH: requireEnv('STOCKFISH_LINUX_PATH', 'src/engine/stockfish/stockfish-linux'),
    },
};
