export type PlayerColor = 'white' | 'black';
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type GameEndReason = 'checkmate' | 'disconnect' | 'resign';
export type GameStatus = 'waiting' | 'active' | 'ended';
export type BoardState = Square[];

export interface Player {
    socketId: string;
    playerId: string;
    color: PlayerColor;
}

export interface Piece {
    type: PieceType;
    color: PlayerColor;
    hasMoved: boolean;
}

export interface Square {
    piece: Piece | null;
}

export interface PendingPromotion {
    index: number;
    color: PlayerColor;
}

export interface Game {
    id: string;
    status: GameStatus;

    players: {
        white?: Player;
        black?: Player;
    };

    board: BoardState;
    turn: PlayerColor;

    enPassantTarget: number | null;
    pendingPromotion: PendingPromotion | null;

    winner?: PlayerColor;
    endReason?: GameEndReason;

    // Disconnect handling
    disconnectTimer?: NodeJS.Timeout;

    createdAt: number;
}
