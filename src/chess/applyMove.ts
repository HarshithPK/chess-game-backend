import { getLegalMoves } from './moveUtils';
import type { Game } from '../game/gameTypes';

export type ApplyMoveResult =
    | { type: 'invalid' }
    | { type: 'normal' }
    | { type: 'promotion'; index: number };

export function applyMove(game: Game, from: number, to: number): ApplyMoveResult {
    const board = game.board;
    const piece = board[from]?.piece;

    if (!piece) return { type: 'invalid' };
    if (piece.color !== game.turn) return { type: 'invalid' };

    const legalMoves = getLegalMoves(board, from, game.enPassantTarget);
    const move = legalMoves.find((m) => m.index === to);

    if (!move) return { type: 'invalid' };

    // ─── En Passant ─────────────────────────────
    if (move.enPassant !== undefined) {
        board[move.enPassant].piece = null;
    }

    // ─── Castling ──────────────────────────────
    if (move.castle) {
        const row = Math.floor(from / 8);
        if (move.castle === 'king') {
            board[row * 8 + 5].piece = board[row * 8 + 7].piece;
            board[row * 8 + 7].piece = null;
        } else {
            board[row * 8 + 3].piece = board[row * 8 + 0].piece;
            board[row * 8 + 0].piece = null;
        }
    }

    // ─── Move piece ─────────────────────────────
    board[to].piece = {
        ...piece,
        hasMoved: true,
    };
    board[from].piece = null;

    // ─── En passant target ─────────────────────
    game.enPassantTarget =
        piece.type === 'pawn' && Math.abs(from - to) === 16 ? (from + to) / 2 : null;

    // ─── Promotion detection ───────────────────
    const row = Math.floor(to / 8);
    const isPromotion =
        piece.type === 'pawn' &&
        ((piece.color === 'white' && row === 0) || (piece.color === 'black' && row === 7));

    if (isPromotion) {
        return {
            type: 'promotion',
            index: to,
        };
    }

    // ─── Switch turn ───────────────────────────
    game.turn = game.turn === 'white' ? 'black' : 'white';

    return { type: 'normal' };
}
