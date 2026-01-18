import { GameAnalysis } from '../engine/postGameAnalysis';

export type PlayerColor = 'white' | 'black';
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type GameEndReason =
    | 'checkmate'
    | 'disconnect'
    | 'resign'
    | 'stalemate'
    | 'threefold'
    | 'fifty-move'
    | 'insufficient-material'
    | 'timeout';
export type GameStatus = 'waiting' | 'active' | 'ended';
export type BoardState = Square[];

export type MoveAnnotation = '!!' | '!' | '!?' | '?!' | '?' | '??' | null;

export interface GameClock {
    white: number; // milliseconds
    black: number; // milliseconds
    lastMoveAt: number; // timestamp
    increment: number; // ms
}

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
    from: number;
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

    spectators: any[];

    enPassantTarget: number | null;
    pendingPromotion: PendingPromotion | null;

    winner?: PlayerColor | null;
    endReason?: GameEndReason | null;

    // 🔁 Threefold repetition
    positionHistory: Record<string, number>;

    // 50 Move Rule
    halfMoveClock: number;

    // Disconnect handling
    disconnectTimer?: NodeJS.Timeout;
    disconnectedColor?: PlayerColor;
    disconnectDeadline?: number;

    analysis?: GameAnalysis;

    createdAt: number;

    moveHistory: MoveRecord[];

    // Clock
    clock?: GameClock;
}

export interface MoveRecord {
    from: number;
    to: number;
    piece: PieceType;
    color: PlayerColor;

    capture: boolean;
    capturedPiece?: PieceType;

    promotion?: PieceType;
    castle?: 'king' | 'queen';
    enPassant?: number;

    san?: string;

    boardHash: string;
    halfMoveClock: number;

    annotation?: MoveAnnotation;

    // 🧠 Stockfish analysis (post-game)
    evalBefore?: number;
    evalAfter?: number;
}
