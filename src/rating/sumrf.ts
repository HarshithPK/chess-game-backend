export function computeSmurfScore({
    games,
    ratingDelta,
    winRate,
}: {
    games: number;
    ratingDelta: number;
    winRate: number;
}) {
    let score = 0;

    // Fast rating climb
    if (ratingDelta >= 200 && games <= 5) score += 3;
    if (ratingDelta >= 350 && games <= 8) score += 4;

    // High winrate early
    if (winRate >= 0.9 && games <= 6) score += 3;
    if (winRate >= 0.8 && games <= 10) score += 2;

    return score; // 0–10
}
