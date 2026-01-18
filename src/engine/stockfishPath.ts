import path from 'path';
import os from 'os';

export function getStockfishPath(): string {
    const platform = os.platform();

    if (platform === 'win32') {
        return path.join(__dirname, 'stockfish', 'stockfish-windows.exe');
    }

    if (platform === 'linux') {
        return path.join(__dirname, 'stockfish', 'stockfish-linux');
    }

    throw new Error(`Unsupported platform: ${platform}`);
}
