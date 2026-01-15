import { BoardState, Piece, PlayerColor as Color } from '../game/gameTypes';

const isInsideBoard = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;

const indexToRC = (index: number) => ({
    row: Math.floor(index / 8),
    col: index % 8,
});

const rcToIndex = (row: number, col: number) => row * 8 + col;

export type Move = {
    index: number;
    capture: boolean;
    castle?: 'king' | 'queen';
    enPassant?: number;
};

/* =====================================================
   LEGAL MOVES (FILTERED FOR CHECK)
===================================================== */

export function getLegalMoves(
    board: BoardState,
    fromIndex: number,
    enPassantTarget?: number | null
): Move[] {
    const square = board[fromIndex];
    if (!square.piece) return [];

    const piece = square.piece;
    const { row, col } = indexToRC(fromIndex);

    let rawMoves: Move[] = [];

    switch (piece.type) {
        case 'pawn':
            rawMoves = pawnMoves(board, piece, row, col, enPassantTarget);
            break;
        case 'rook':
            rawMoves = linearMoves(board, piece.color, row, col, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]);
            break;
        case 'bishop':
            rawMoves = linearMoves(board, piece.color, row, col, [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
            ]);
            break;
        case 'queen':
            rawMoves = linearMoves(board, piece.color, row, col, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
            ]);
            break;
        case 'knight':
            rawMoves = knightMoves(board, piece.color, row, col);
            break;
        case 'king':
            rawMoves = kingMoves(board, piece.color, row, col);
            break;
    }

    // 🔒 FILTER OUT MOVES THAT LEAVE KING IN CHECK
    return rawMoves.filter((move) => {
        const simulated = simulateMove(board, fromIndex, move.index, move.castle);
        return !isKingInCheck(simulated, piece.color);
    });
}

/* =====================================================
   CHECK DETECTION
===================================================== */

export function isKingInCheck(board: BoardState, color: Color): boolean {
    let kingIndex = -1;

    for (let i = 0; i < board.length; i++) {
        const piece = board[i].piece;
        if (piece?.type === 'king' && piece.color === color) {
            kingIndex = i;
            break;
        }
    }

    if (kingIndex === -1) return false;

    for (let i = 0; i < board.length; i++) {
        const piece = board[i].piece;
        if (!piece || piece.color === color) continue;

        const moves = getPseudoMoves(board, i);
        if (moves.some((m) => m.index === kingIndex)) {
            return true;
        }
    }

    return false;
}

/* =====================================================
   CHECKMATE / STALEMATE HELPERS
===================================================== */

export function hasAnyLegalMoves(board: BoardState, color: Color): boolean {
    for (let i = 0; i < board.length; i++) {
        const piece = board[i].piece;
        if (!piece || piece.color !== color) continue;

        if (getLegalMoves(board, i).length > 0) {
            return true;
        }
    }
    return false;
}

/* =====================================================
   PSEUDO MOVES (NO CHECK FILTERING)
===================================================== */

function getPseudoMoves(board: BoardState, fromIndex: number): Move[] {
    const square = board[fromIndex];
    if (!square.piece) return [];

    const piece = square.piece;
    const { row, col } = indexToRC(fromIndex);

    switch (piece.type) {
        case 'pawn':
            return pawnMoves(board, piece, row, col);
        case 'rook':
            return linearMoves(board, piece.color, row, col, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]);
        case 'bishop':
            return linearMoves(board, piece.color, row, col, [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
            ]);
        case 'queen':
            return linearMoves(board, piece.color, row, col, [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
            ]);
        case 'knight':
            return knightMoves(board, piece.color, row, col);
        case 'king':
            return kingMoves(board, piece.color, row, col, true);
        default:
            return [];
    }
}

/* =====================================================
   PIECE MOVES
===================================================== */

function pawnMoves(
    board: BoardState,
    piece: Piece,
    row: number,
    col: number,
    enPassantTarget?: number | null
): Move[] {
    const dir = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    const moves: Move[] = [];

    // ─── Single move ─────────────────────────────
    const oneForward = row + dir;
    if (isInsideBoard(oneForward, col)) {
        const idx = rcToIndex(oneForward, col);
        if (!board[idx].piece) {
            moves.push({ index: idx, capture: false });

            // ─── Double move (first move only) ──────
            if (row === startRow) {
                const twoForward = row + dir * 2;
                const idx2 = rcToIndex(twoForward, col);
                if (!board[idx2].piece) {
                    moves.push({
                        index: idx2,
                        capture: false,
                        enPassant: rcToIndex(oneForward, col),
                    });
                }
            }
        }
    }

    // ─── Normal captures ─────────────────────────
    for (const dc of [-1, 1]) {
        const r = row + dir;
        const c = col + dc;
        if (!isInsideBoard(r, c)) continue;

        const idx = rcToIndex(r, c);
        const target = board[idx].piece;
        if (target && target.color !== piece.color) {
            moves.push({ index: idx, capture: true });
        }
    }

    // ─── En Passant capture ──────────────────────
    if (enPassantTarget !== null) {
        for (const dc of [-1, 1]) {
            const sideCol = col + dc;
            if (!isInsideBoard(row, sideCol)) continue;

            const sideIdx = rcToIndex(row, sideCol);
            const target = board[sideIdx].piece;

            if (
                target &&
                target.type === 'pawn' &&
                target.color !== piece.color &&
                rcToIndex(row + dir, sideCol) === enPassantTarget
            ) {
                moves.push({
                    index: enPassantTarget,
                    capture: true,
                    enPassant: sideIdx,
                });
            }
        }
    }

    return moves;
}

function linearMoves(
    board: BoardState,
    color: Color,
    row: number,
    col: number,
    directions: number[][]
): Move[] {
    const moves: Move[] = [];

    for (const [dr, dc] of directions) {
        let r = row + dr;
        let c = col + dc;

        while (isInsideBoard(r, c)) {
            const idx = rcToIndex(r, c);
            const target = board[idx].piece;

            if (!target) {
                moves.push({ index: idx, capture: false });
            } else {
                if (target.color !== color) {
                    moves.push({ index: idx, capture: true });
                }
                break;
            }

            r += dr;
            c += dc;
        }
    }

    return moves;
}

function knightMoves(board: BoardState, color: Color, row: number, col: number): Move[] {
    const offsets = [
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
    ];

    return offsets
        .map(([dr, dc]) => [row + dr, col + dc])
        .filter(([r, c]) => isInsideBoard(r, c))
        .map(([r, c]) => {
            const idx = rcToIndex(r, c);
            const target = board[idx].piece;
            if (!target || target.color !== color) {
                return { index: idx, capture: !!target };
            }
            return null;
        })
        .filter(Boolean) as Move[];
}

/* =====================================================
   KING + CASTLING (WITH CHECK RULES)
===================================================== */

function kingMoves(
    board: BoardState,
    color: Color,
    row: number,
    col: number,
    ignoreCheck = false
): Move[] {
    const moves: Move[] = [];

    // Normal moves
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const r = row + dr;
            const c = col + dc;
            if (!isInsideBoard(r, c)) continue;

            const idx = rcToIndex(r, c);
            const target = board[idx].piece;

            if (!target || target.color !== color) {
                moves.push({ index: idx, capture: !!target });
            }
        }
    }

    const kingIndex = rcToIndex(row, col);
    const king = board[kingIndex].piece;
    if (!king || king.hasMoved) return moves;

    if (!ignoreCheck && isKingInCheck(board, color)) return moves;

    // King-side castling
    if (canCastleThrough(board, color, row, [5, 6])) {
        moves.push({ index: rcToIndex(row, 6), capture: false, castle: 'king' });
    }

    // Queen-side castling
    if (canCastleThrough(board, color, row, [3, 2])) {
        moves.push({ index: rcToIndex(row, 2), capture: false, castle: 'queen' });
    }

    return moves;
}

function canCastleThrough(board: BoardState, color: Color, row: number, cols: number[]): boolean {
    const rookCol = cols[1] === 6 ? 7 : 0;
    const rook = board[rcToIndex(row, rookCol)].piece;

    if (!rook || rook.type !== 'rook' || rook.hasMoved) return false;

    for (const c of cols) {
        if (board[rcToIndex(row, c)].piece) return false;
        const testBoard = simulateMove(board, rcToIndex(row, 4), rcToIndex(row, c));
        if (isKingInCheck(testBoard, color)) return false;
    }

    return true;
}

/* =====================================================
   SIMULATION
===================================================== */

function simulateMove(
    board: BoardState,
    from: number,
    to: number,
    castle?: 'king' | 'queen'
): BoardState {
    const newBoard = board.map((sq) => ({ piece: sq.piece }));

    newBoard[to].piece = newBoard[from].piece;
    newBoard[from].piece = null;

    if (castle) {
        const row = Math.floor(from / 8);
        if (castle === 'king') {
            newBoard[rcToIndex(row, 5)].piece = newBoard[rcToIndex(row, 7)].piece;
            newBoard[rcToIndex(row, 7)].piece = null;
        } else {
            newBoard[rcToIndex(row, 3)].piece = newBoard[rcToIndex(row, 0)].piece;
            newBoard[rcToIndex(row, 0)].piece = null;
        }
    }

    return newBoard;
}
