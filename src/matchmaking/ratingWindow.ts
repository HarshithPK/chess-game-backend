const BASE_WINDOW = 100;
const MAX_WINDOW = 400;
const EXPAND_PER_SEC = 3.33; // ~+100 every 30s

export function ratingWindow(waitMs: number) {
    const waitSeconds = waitMs / 1000;
    const expanded = BASE_WINDOW + waitSeconds * EXPAND_PER_SEC;
    return Math.min(MAX_WINDOW, Math.floor(expanded));
}
