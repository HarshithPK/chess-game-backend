import { BoardState, Piece } from '../game/gameTypes';

function p(type: Piece['type'], color: Piece['color']): Piece {
    return { type, color, hasMoved: false };
}

export function createInitialBoard(): BoardState {
    return [
        // 8th rank (black)
        { piece: p('rook', 'black') },
        { piece: p('knight', 'black') },
        { piece: p('bishop', 'black') },
        { piece: p('queen', 'black') },
        { piece: p('king', 'black') },
        { piece: p('bishop', 'black') },
        { piece: p('knight', 'black') },
        { piece: p('rook', 'black') },

        // 7th rank
        ...Array(8)
            .fill(null)
            .map(() => ({ piece: p('pawn', 'black') })),

        // 6th → 3rd ranks
        ...Array(32)
            .fill(null)
            .map(() => ({ piece: null })),

        // 2nd rank
        ...Array(8)
            .fill(null)
            .map(() => ({ piece: p('pawn', 'white') })),

        // 1st rank (white)
        { piece: p('rook', 'white') },
        { piece: p('knight', 'white') },
        { piece: p('bishop', 'white') },
        { piece: p('queen', 'white') },
        { piece: p('king', 'white') },
        { piece: p('bishop', 'white') },
        { piece: p('knight', 'white') },
        { piece: p('rook', 'white') },
    ];
}
