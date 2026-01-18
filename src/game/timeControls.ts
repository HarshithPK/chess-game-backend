export type TimeControl = '3+2' | '5+0' | '10+0' | '15+10';

export function createClock(tc: TimeControl) {
    const [base, inc] = tc.split('+').map(Number);

    return {
        white: base * 60_000,
        black: base * 60_000,
        increment: inc * 1000,
        lastMoveAt: Date.now(),
    };
}
