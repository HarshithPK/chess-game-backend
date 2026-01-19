import { Game } from './gameTypes';

export function applyClock(game: Game, mover: 'white' | 'black') {
    if (!game.clock) return;

    const now = Date.now();
    const elapsed = now - game.clock.lastMoveAt;

    // Subtract elapsed time
    game.clock[mover] = Math.max(0, game.clock[mover] - elapsed);

    // Apply increment AFTER move
    game.clock[mover] += game.clock.increment;

    // Update authoritative timestamp
    game.clock.lastMoveAt = now;
}

export function checkTimeout(game: Game): 'white' | 'black' | null {
    if (!game.clock) return null;

    const now = Date.now();
    const elapsed = now - game.clock.lastMoveAt;
    const remaining = game.clock[game.turn] - elapsed;

    return remaining <= 0 ? game.turn : null;
}

export function parseIncrement(timeControl: string): number {
    if (!timeControl) return 0;

    const match = timeControl.match(/^(\d+)\+(\d+)$/);
    if (!match) return 0;

    const incrementSeconds = Number(match[2]);

    if (Number.isNaN(incrementSeconds)) return 0;

    return incrementSeconds * 1000;
}

export function parseBaseTime(timeControl: string): number {
    if (!timeControl) return 5 * 60 * 1000;

    const match = timeControl.match(/^(\d+)\+(\d+)$/);
    if (!match) return 5 * 60 * 1000;

    const minutes = Number(match[1]);

    if (Number.isNaN(minutes)) return 5 * 60 * 1000;

    return minutes * 60 * 1000;
}
