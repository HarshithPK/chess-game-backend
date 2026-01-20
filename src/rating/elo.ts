function expected(rA: number, rB: number) {
    return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

export function updateElo(rA: number, rB: number, scoreA: 0 | 0.5 | 1, kFactor: number) {
    const eA = expected(rA, rB);
    return Math.round(rA + kFactor * (scoreA - eA));
}
