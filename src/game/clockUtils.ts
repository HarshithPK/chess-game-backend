import { Game } from './gameTypes';

export function applyClock(game: Game, mover: 'white' | 'black') {
    if (!game.clock) return;

    const now = Date.now();
    const elapsed = now - game.clock.lastMoveAt;

    game.clock[mover] -= elapsed;
    game.clock[mover] += game.clock.increment;
    game.clock.lastMoveAt = now;
}

export function checkTimeout(game: Game): 'white' | 'black' | null {
    if (!game.clock) return null;

    const now = Date.now();
    const elapsed = now - game.clock.lastMoveAt;
    const remaining = game.clock[game.turn] - elapsed;

    return remaining <= 0 ? game.turn : null;
}
