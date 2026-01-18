import { BoardState, Piece } from '../game/gameTypes';

function squareColor(index: number): 'light' | 'dark' {
    const row = Math.floor(index / 8);
    const col = index % 8;
    return (row + col) % 2 === 0 ? 'light' : 'dark';
}

export function isInsufficientMaterial(board: BoardState): boolean {
    const pieces: { piece: Piece; index: number }[] = [];

    for (let i = 0; i < board.length; i++) {
        const p = board[i].piece;
        if (p) pieces.push({ piece: p, index: i });
    }

    // Remove kings
    const nonKings = pieces.filter((p) => p.piece.type !== 'king');

    // King vs King
    if (nonKings.length === 0) return true;

    // King + minor vs King
    if (nonKings.length === 1) {
        const type = nonKings[0].piece.type;
        return type === 'bishop' || type === 'knight';
    }

    // King + bishop vs King + bishop (same color bishops)
    if (nonKings.length === 2) {
        const [a, b] = nonKings;

        if (
            a.piece.type === 'bishop' &&
            b.piece.type === 'bishop' &&
            a.piece.color !== b.piece.color
        ) {
            const colorA = squareColor(a.index);
            const colorB = squareColor(b.index);
            return colorA === colorB;
        }
    }

    return false;
}
