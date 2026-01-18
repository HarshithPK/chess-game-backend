import { Game } from '../game/gameTypes';
import { annotateMove } from '../engine/moveAnnotation';

/* ================= TYPES ================= */

export interface PlayerAnalysis {
    accuracy: number;
    best: number;
    good: number;
    inaccuracies: number;
    mistakes: number;
    blunders: number;
    avgLoss: number;
}

export interface GameAnalysis {
    white: PlayerAnalysis;
    black: PlayerAnalysis;
}

/* ================= HELPERS ================= */

function emptyStats(): PlayerAnalysis {
    return {
        accuracy: 0,
        best: 0,
        good: 0,
        inaccuracies: 0,
        mistakes: 0,
        blunders: 0,
        avgLoss: 0,
    };
}

function accuracyFromCPL(avgCPL: number): number {
    if (avgCPL <= 10) return 100;
    if (avgCPL <= 20) return 95;
    if (avgCPL <= 30) return 90;
    if (avgCPL <= 50) return 85;
    if (avgCPL <= 80) return 75;
    if (avgCPL <= 120) return 65;
    if (avgCPL <= 200) return 50;
    return 40;
}

/* ================= MAIN ANALYSIS ================= */

export async function analyzeGame(game: Game): Promise<GameAnalysis> {
    const white = emptyStats();
    const black = emptyStats();

    const whiteLosses: number[] = [];
    const blackLosses: number[] = [];

    for (const move of game.moveHistory) {
        if (move.evalBefore == null || move.evalAfter == null) continue;

        const loss = Math.abs(move.evalBefore - move.evalAfter);

        // 🏷️ Annotate move (FIXED)
        const annotation = annotateMove(loss);
        move.annotation = annotation;

        const stats = move.color === 'white' ? white : black;
        const losses = move.color === 'white' ? whiteLosses : blackLosses;

        losses.push(loss);

        // 📊 Count move quality
        switch (annotation) {
            case '!!':
                stats.best++;
                break;
            case '!':
            case '!?':
                stats.good++;
                break;
            case '?!':
                stats.inaccuracies++;
                break;
            case '?':
                stats.mistakes++;
                break;
            case '??':
                stats.blunders++;
                break;
        }
    }

    const avg = (arr: number[]) =>
        arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    white.avgLoss = Math.round(avg(whiteLosses));
    black.avgLoss = Math.round(avg(blackLosses));

    white.accuracy = accuracyFromCPL(white.avgLoss);
    black.accuracy = accuracyFromCPL(black.avgLoss);

    return {
        white,
        black,
    };
}
