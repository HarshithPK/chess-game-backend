import { createInitialBoard } from '../chess/createInitialBoard';
import { generateGameId } from '../utils/generateId';
import { Game } from './gameTypes';
import { initialBoard } from './initialBoard';

export function createGame(socketId: string, playerId: string): Game {
    return {
        id: generateGameId(),
        status: 'waiting',

        players: {
            white: {
                socketId,
                playerId,
                color: 'white',
            },
        },

        // AUTHORITATIVE GAME STATE
        board: createInitialBoard(),
        turn: 'white',
        enPassantTarget: null,
        pendingPromotion: null,

        createdAt: Date.now(),
    };
}
