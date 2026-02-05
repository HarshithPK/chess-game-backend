export function ratingConfidence(games: number, isPlacement: boolean) {
    if (!isPlacement) return 40;

    // Fast collapse early, slower later
    if (games <= 3) return 400;
    if (games <= 5) return 300;
    if (games <= 7) return 200;
    if (games <= 10) return 120;

    return 80;
}
