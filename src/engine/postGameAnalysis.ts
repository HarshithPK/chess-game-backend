import { Game } from '../game/gameTypes';
import { createInitialBoard } from '../chess/createInitialBoard';
import { applyMove } from '../chess/applyMove';
import { boardToFEN } from '../chess/boardToFen';
import { StockfishEngine } from './stockfishEngine';

type Eval = { type: 'cp'; value: number } | { type: 'mate'; value: number };

type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

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

/* ---------- Helpers ---------- */

function classify(loss: number): MoveQuality {
    if (loss <= 20) return 'best';
    if (loss <= 50) return 'good';
    if (loss <= 100) return 'inaccuracy';
    if (loss <= 300) return 'mistake';
    return 'blunder';
}

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

/* ---------- Main Analysis ---------- */

export async function analyzeGame(game: Game): Promise<GameAnalysis> {
    const engine = new StockfishEngine();

    const stats = {
        white: emptyStats(),
        black: emptyStats(),
    };

    let board = createInitialBoard();
    let turn: 'white' | 'black' = 'white';
    let enPassantTarget: number | null = null;

    let prevEval: number | null = null;
    const lossSum = { white: 0, black: 0 };
    const moveCount = { white: 0, black: 0 };

    for (const move of game.moveHistory) {
        // Apply move to reconstructed board
        applyMove({ board, turn, enPassantTarget } as any, move.from, move.to);

        // Switch turn
        turn = turn === 'white' ? 'black' : 'white';

        const fen = boardToFEN(board, turn, enPassantTarget);
        const evalResult = await engine.evaluate(fen);

        if (evalResult.type !== 'cp') continue;

        if (prevEval !== null) {
            const loss =
                move.color === 'white' ? prevEval - evalResult.value : evalResult.value - prevEval;

            const absLoss = Math.max(0, loss);
            const quality = classify(absLoss);
            const player = stats[move.color];

            moveCount[move.color]++;
            lossSum[move.color] += absLoss;

            if (quality === 'best') player.best++;
            else if (quality === 'good') player.good++;
            else if (quality === 'inaccuracy') player.inaccuracies++;
            else if (quality === 'mistake') player.mistakes++;
            else player.blunders++;
        }

        prevEval = evalResult.value;
    }

    engine.destroy();

    for (const color of ['white', 'black'] as const) {
        if (moveCount[color] === 0) continue;

        const avgLoss = lossSum[color] / moveCount[color];
        stats[color].avgLoss = avgLoss;
        stats[color].accuracy = Math.max(0, Math.min(100, 100 - avgLoss / 10));
    }

    return stats;
}
