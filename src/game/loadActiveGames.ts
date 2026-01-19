import { gameStore } from './gameStore';
import { applyMove } from '../chess/applyMove';
import { createInitialBoard } from '../chess/createInitialBoard';
import { parseBaseTime, parseIncrement } from './clockUtils';

import { MoveAnnotation, PieceType } from './gameTypes';
import { Game as GameModel, Move as MoveModel } from '../db/models';

export async function loadActiveGames() {
    const games = await GameModel.findAll({
        where: { status: 'active' },
        include: [
            {
                model: MoveModel,
                as: 'moves',
                order: [['moveNumber', 'ASC']],
            },
        ],
    });

    console.log(`♻️ Restoring ${games.length} active games`);

    for (const dbGame of games) {
        const moves = dbGame.moves ?? [];

        // 🕒 Restore clock from LAST move or initial
        const lastMove = moves[moves.length - 1];

        const clock = {
            white: lastMove?.clockWhite ?? parseBaseTime(dbGame.timeControl),
            black: lastMove?.clockBlack ?? parseBaseTime(dbGame.timeControl),
            lastMoveAt: dbGame.clockLastTick ?? Date.now(),
            increment: parseIncrement(dbGame.timeControl),
        };

        // 🧠 Restore game shell
        const game = gameStore.restore({
            id: dbGame.id,
            whiteUserId: dbGame.whiteUserId,
            blackUserId: dbGame.blackUserId,
            timeControl: dbGame.timeControl,
            clock,
        });

        // ♟️ Reset board explicitly
        game.board = createInitialBoard();
        game.moveHistory = [];
        game.positionHistory = {};
        game.pendingPromotion = null;
        game.enPassantTarget = null;
        game.halfMoveClock = 0;

        const now = Date.now();
        const elapsed = now - game.clock!.lastMoveAt;

        if (game.turn === 'white') {
            game.clock!.white = Math.max(0, game.clock!.white - elapsed);
        } else {
            game.clock!.black = Math.max(0, game.clock!.black - elapsed);
        }

        game.clock!.lastMoveAt = now;

        // ▶️ Replay moves
        for (const move of moves) {
            const result = applyMove(game, move.fromSquare, move.toSquare);

            // Handle promotion AFTER move
            if (move.promotion) {
                game.board[move.toSquare].piece = {
                    type: move.promotion as any,
                    color: move.color,
                    hasMoved: true,
                };
            }

            game.moveHistory.push({
                from: move.fromSquare,
                to: move.toSquare,
                piece: move.piece as any,
                color: move.color,
                capture: move.capture,
                promotion: (move.promotion as PieceType) ?? undefined,
                san: move.san ?? undefined,
                annotation: (move.annotation as MoveAnnotation) ?? null,
                boardHash: '',
                halfMoveClock: game.halfMoveClock,
            });
        }

        // 🔄 Restore turn
        game.turn = moves.length % 2 === 0 ? 'white' : 'black';

        console.log(`✅ Restored game ${dbGame.id} (${moves.length} moves)`);
    }
}
