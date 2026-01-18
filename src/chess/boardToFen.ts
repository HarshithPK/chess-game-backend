import { BoardState, PlayerColor } from '../game/gameTypes';

const pieceMap: Record<string, string> = {
    pawn: 'p',
    rook: 'r',
    knight: 'n',
    bishop: 'b',
    queen: 'q',
    king: 'k',
};

export function boardToFEN(board: BoardState, turn: PlayerColor, enPassant: number | null): string {
    let fen = '';

    for (let row = 0; row < 8; row++) {
        let empty = 0;

        for (let col = 0; col < 8; col++) {
            const sq = board[row * 8 + col];
            if (!sq.piece) {
                empty++;
                continue;
            }

            if (empty > 0) {
                fen += empty;
                empty = 0;
            }

            const char = pieceMap[sq.piece.type];
            fen += sq.piece.color === 'white' ? char.toUpperCase() : char;
        }

        if (empty > 0) fen += empty;
        if (row !== 7) fen += '/';
    }

    fen += ` ${turn === 'white' ? 'w' : 'b'} - - `;
    fen += '0 1';

    return fen;
}
