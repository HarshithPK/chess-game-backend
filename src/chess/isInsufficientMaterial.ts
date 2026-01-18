import { BoardState } from '../game/gameTypes';

type PieceInfo = {
    type: string;
    color: 'white' | 'black';
    squareColor?: 'light' | 'dark';
};

function squareColor(index: number): 'light' | 'dark' {
    const row = Math.floor(index / 8);
    const col = index % 8;
    return (row + col) % 2 === 0 ? 'light' : 'dark';
}

export function isInsufficientMaterial(board: BoardState): boolean {
    const pieces: PieceInfo[] = [];

    board.forEach((sq, i) => {
        if (!sq.piece) return;

        const { type, color } = sq.piece;

        // Any pawn, rook, or queen => sufficient material
        if (type === 'pawn' || type === 'rook' || type === 'queen') {
            pieces.push({ type, color });
            return;
        }

        if (type === 'bishop') {
            pieces.push({
                type,
                color,
                squareColor: squareColor(i),
            });
            return;
        }

        pieces.push({ type, color });
    });

    // Only kings
    if (pieces.length === 2) return true;

    // King + minor vs king
    if (pieces.length === 3) {
        return pieces.some((p) => p.type === 'bishop' || p.type === 'knight');
    }

    // King + bishop vs king + bishop (same square color)
    if (pieces.length === 4) {
        const bishops = pieces.filter((p) => p.type === 'bishop');
        if (bishops.length === 2) {
            return bishops[0].squareColor === bishops[1].squareColor;
        }
    }

    return false;
}
