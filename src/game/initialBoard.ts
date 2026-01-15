import { Square } from './gameTypes';

const B = 'black' as const;
const W = 'white' as const;

export const initialBoard: Square[] = [
    { piece: { type: 'rook', color: B, hasMoved: false } },
    { piece: { type: 'knight', color: B } },
    { piece: { type: 'bishop', color: B } },
    { piece: { type: 'queen', color: B } },
    { piece: { type: 'king', color: B, hasMoved: false } },
    { piece: { type: 'bishop', color: B } },
    { piece: { type: 'knight', color: B } },
    { piece: { type: 'rook', color: B, hasMoved: false } },

    ...Array(8)
        .fill(null)
        .map(() => ({ piece: { type: 'pawn', color: B } })),
    ...Array(32).fill({ piece: null }),
    ...Array(8)
        .fill(null)
        .map(() => ({ piece: { type: 'pawn', color: W } })),

    { piece: { type: 'rook', color: W, hasMoved: false } },
    { piece: { type: 'knight', color: W } },
    { piece: { type: 'bishop', color: W } },
    { piece: { type: 'queen', color: W } },
    { piece: { type: 'king', color: W, hasMoved: false } },
    { piece: { type: 'bishop', color: W } },
    { piece: { type: 'knight', color: W } },
    { piece: { type: 'rook', color: W, hasMoved: false } },
];
