import { nanoid } from 'nanoid';

import { createInitialBoard } from '../chess/createInitialBoard';
import { Game } from './gameTypes';
import { createClock, TimeControl } from './timeControls';

export function createGame(
    socketId: string,
    playerId: string,
    timeControl: TimeControl = '5+0'
): Game {
    return {
        id: nanoid(6),
        board: createInitialBoard(),
        turn: 'white',
        status: 'waiting',

        players: {
            white: {
                socketId,
                playerId, // 🔑 THIS IS CRITICAL
                color: 'white',
            },
            black: undefined,
        },

        spectators: [],
        pendingPromotion: null,

        // game-end state
        winner: null,
        endReason: null,

        // threefold stalemate
        positionHistory: {},

        // 50 Move Rule
        halfMoveClock: 0,

        // disconnect handling
        disconnectTimer: undefined,
        disconnectedColor: undefined,
        disconnectDeadline: undefined,

        // additional game state
        enPassantTarget: null,
        createdAt: Date.now(),

        clock: createClock(timeControl),
        timeControl, // ✅

        moveHistory: [],
    };
}
