import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

import { gameStore } from '../game/gameStore';
import { applyMove } from '../chess/applyMove';
import { hasAnyLegalMoves, isKingInCheck } from '../chess/moveUtils';
import { getPositionHash } from '../chess/positionHash';
import { generateSAN } from '../chess/generateSan';
import { generatePGN } from '../chess/generatePGN';
import { isInsufficientMaterial } from '../chess/isInsufficientMaterial';
import { boardToFEN } from '../chess/boardToFen';

import { createClock } from '../game/timeControls';
import { applyClock, checkTimeout } from '../game/clockUtils';

import { socketAuth } from '../auth/socketAuth';

import { getEngine, releaseEngine } from '../engine/enginePool';
import { analyzeGame } from '../engine/postGameAnalysis';

import { Game, Move } from '../db/models';
import { ENV } from '../config/env';

/* 🔴 MATCHMAKING */
import { enqueue, dequeue, removeByUserId } from '../matchmaking/casualQueue';

const DISCONNECT_TIMEOUT = ENV.DISCONNECT_TIMEOUT;

/* ========= DB MOVE PERSIST ========= */
async function persistMove({
    game,
    moveNumber,
    from,
    to,
    piece,
    color,
    capture,
    promotion,
    san,
}: {
    game: any;
    moveNumber: number;
    from: number;
    to: number;
    piece: string;
    color: 'white' | 'black';
    capture: boolean;
    promotion?: string;
    san?: string;
}) {
    await Move.create({
        gameId: game.id,
        moveNumber,
        color,
        fromSquare: from,
        toSquare: to,
        piece,
        capture,
        promotion: promotion ?? null,
        san: san ?? null,
        annotation: null,
        evalBefore: null,
        evalAfter: null,
        clockWhite: game.clock.white,
        clockBlack: game.clock.black,
    });
}

export function initSocket(server: HttpServer) {
    const io = new Server(server, {
        cors: {
            origin: ENV.CLIENT_URL,
            methods: ['GET', 'POST'],
        },
    });

    io.use(socketAuth);

    io.on('connection', (socket) => {
        const userId = socket.data.userId as string;
        if (!userId) {
            socket.disconnect();
            return;
        }

        let currentGameId: string | null = null;

        /* ========= RECONNECT ========= */
        const existingGame = gameStore.findGameByPlayerId(userId);
        if (existingGame) {
            const player =
                existingGame.players.white?.playerId === userId
                    ? existingGame.players.white
                    : existingGame.players.black?.playerId === userId
                      ? existingGame.players.black
                      : null;

            if (player) {
                player.socketId = socket.id;
                currentGameId = existingGame.id;
                socket.join(existingGame.id);
                socket.emit('game:reconnected', existingGame);
            }
        }

        /* ========= MATCHMAKING JOIN ========= */
        socket.on('matchmaking:join', async ({ timeControl }) => {
            // Try to match immediately
            const opponent = await dequeue();

            if (opponent && opponent.userId !== userId) {
                // Create game
                const game = gameStore.create(opponent.socketId, opponent.userId);
                game.clock = createClock(timeControl);
                game.timeControl = timeControl;

                game.players.black = {
                    playerId: userId,
                    socketId: socket.id,
                    color: 'black',
                };

                game.status = 'active';
                currentGameId = game.id;

                await Game.create({
                    id: game.id,
                    whiteUserId: opponent.userId,
                    blackUserId: userId,
                    status: 'active',
                    timeControl,
                    clockLastTick: Date.now(),
                });

                io.to(opponent.socketId).emit('matchmaking:matched', {
                    gameId: game.id,
                    color: 'white',
                });

                socket.emit('matchmaking:matched', {
                    gameId: game.id,
                    color: 'black',
                });

                return;
            }

            // No opponent → enqueue
            await enqueue({
                userId,
                socketId: socket.id,
                timeControl,
                joinedAt: Date.now(),
            });

            socket.emit('matchmaking:queued');
        });

        /* ========= MATCHMAKING CANCEL ========= */
        socket.on('matchmaking:cancel', async () => {
            await removeByUserId(userId);
            socket.emit('matchmaking:cancelled');
        });

        /* ========= GAME STATE ========= */
        socket.on('game:state', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (game) socket.emit('game:state', game);
        });

        /* ========= GAME MOVE ========= */
        socket.on('game:move', async ({ gameId, from, to }) => {
            const game = gameStore.get(gameId);
            if (!game || game.status !== 'active' || game.pendingPromotion) return;

            const player =
                game.players.white?.socketId === socket.id
                    ? 'white'
                    : game.players.black?.socketId === socket.id
                      ? 'black'
                      : null;

            if (player !== game.turn) return;

            applyClock(game, player);

            await Game.update(
                { clockLastTick: game.clock!.lastMoveAt },
                { where: { id: game.id } }
            );

            const timedOut = checkTimeout(game);
            if (timedOut) {
                game.status = 'ended';
                game.endReason = 'timeout';
                game.winner = timedOut === 'white' ? 'black' : 'white';
                releaseEngine(game.id);
                io.to(gameId).emit('game:update', game);
                return;
            }

            const movingPiece = game.board[from].piece;
            const capturedPiece = game.board[to].piece ?? null;
            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            const result = applyMove(game, from, to);
            if (result.type === 'invalid') return;

            if (result.type === 'promotion') {
                game.pendingPromotion = { index: result.index, color: player, from };
                socket.emit('game:promotionRequired', { index: result.index });
                return;
            }

            const san = generateSAN(boardBefore, game.board, {
                from,
                to,
                piece: movingPiece!.type,
                color: player,
                capture: !!capturedPiece,
            });

            game.moveHistory.push({
                from,
                to,
                piece: movingPiece!.type,
                color: player,
                capture: !!capturedPiece,
                san,
                boardHash: getPositionHash(game.board, game.turn, game.enPassantTarget),
                halfMoveClock: game.halfMoveClock,
            });

            await persistMove({
                game,
                moveNumber: game.moveHistory.length,
                from,
                to,
                piece: movingPiece!.type,
                color: player,
                capture: !!capturedPiece,
                san,
            });

            game.turn = player === 'white' ? 'black' : 'white';
            io.to(gameId).emit('game:update', game);
        });

        /* ========= DISCONNECT ========= */
        socket.on('disconnect', async () => {
            await removeByUserId(userId);

            if (!currentGameId) return;
            const game = gameStore.get(currentGameId);
            if (!game || game.status !== 'active') return;

            const disconnectedColor =
                game.players.white?.socketId === socket.id ? 'white' : 'black';

            game.disconnectedColor = disconnectedColor;
            game.disconnectDeadline = Date.now() + DISCONNECT_TIMEOUT;

            game.disconnectTimer = setTimeout(async () => {
                game.status = 'ended';
                game.endReason = 'disconnect';
                game.winner = disconnectedColor === 'white' ? 'black' : 'white';

                releaseEngine(game.id);
                game.analysis = await analyzeGame(game);

                await Game.update(
                    {
                        status: 'ended',
                        winner: game.winner,
                        endReason: 'disconnect',
                        analysis: game.analysis,
                        pgn: generatePGN(game),
                    },
                    { where: { id: game.id } }
                );

                io.to(currentGameId!).emit('game:update', game);
            }, DISCONNECT_TIMEOUT);
        });
    });
}
