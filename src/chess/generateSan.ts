import { BoardState, PlayerColor, PieceType } from '../game/gameTypes';
import { getLegalMoves, isKingInCheck, hasAnyLegalMoves } from './moveUtils';

const FILES = 'abcdefgh';

function idxToSquare(i: number) {
    return FILES[i % 8] + (8 - Math.floor(i / 8));
}

function fileOf(i: number) {
    return FILES[i % 8];
}

function rankOf(i: number) {
    return 8 - Math.floor(i / 8);
}

function pieceLetter(type: PieceType) {
    if (type === 'pawn') return '';
    return type[0].toUpperCase();
}

export function generateSAN(
    boardBefore: BoardState,
    boardAfter: BoardState,
    move: {
        from: number;
        to: number;
        piece: PieceType;
        color: PlayerColor;
        capture: boolean;
        promotion?: PieceType;
        castle?: 'king' | 'queen';
    }
): string {
    /* ========= CASTLING ========= */
    if (move.castle === 'king') return 'O-O';
    if (move.castle === 'queen') return 'O-O-O';

    const fromSq = idxToSquare(move.from);
    const toSq = idxToSquare(move.to);

    let san = '';

    /* ========= PIECE LETTER ========= */
    san += pieceLetter(move.piece);

    /* ========= DISAMBIGUATION ========= */
    if (move.piece !== 'pawn') {
        const competitors: number[] = [];

        for (let i = 0; i < boardBefore.length; i++) {
            const p = boardBefore[i].piece;
            if (p && p.type === move.piece && p.color === move.color && i !== move.from) {
                const legalMoves = getLegalMoves(boardBefore, i, null);
                if (legalMoves.some((m) => m.index === move.to)) {
                    competitors.push(i);
                }
            }
        }

        if (competitors.length > 0) {
            const sameFile = competitors.some((i) => fileOf(i) === fileOf(move.from));
            const sameRank = competitors.some((i) => rankOf(i) === rankOf(move.from));

            if (!sameFile) {
                san += fileOf(move.from);
            } else if (!sameRank) {
                san += rankOf(move.from);
            } else {
                san += fileOf(move.from) + rankOf(move.from);
            }
        }
    }

    /* ========= PAWN CAPTURE FILE ========= */
    if (move.piece === 'pawn' && move.capture) {
        san += fromSq[0];
    }

    /* ========= CAPTURE MARK ========= */
    if (move.capture) san += 'x';

    /* ========= DESTINATION ========= */
    san += toSq;

    /* ========= PROMOTION ========= */
    if (move.promotion) {
        san += '=' + pieceLetter(move.promotion);
    }

    /* ========= CHECK / CHECKMATE ========= */
    const opponent: PlayerColor = move.color === 'white' ? 'black' : 'white';
    const inCheck = isKingInCheck(boardAfter, opponent);
    const hasMoves = hasAnyLegalMoves(boardAfter, opponent, null);

    if (inCheck && !hasMoves) san += '#';
    else if (inCheck) san += '+';

    return san;
}
