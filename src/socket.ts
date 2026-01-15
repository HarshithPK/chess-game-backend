import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

import { gameStore } from './game/gameStore';
import { applyMove } from './chess/applyMove';
import { hasAnyLegalMoves, isKingInCheck } from './chess/moveUtils';

import { ENV } from './config/env';

const DISCONNECT_TIMEOUT = 30_000; // 30 seconds

export function initSocket(server: HttpServer) {
    const io = new Server(server, {
        cors: {
            origin: ENV.CLIENT_URL,
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        const playerId = socket.handshake.auth.playerId as string;

        if (!playerId) {
            socket.disconnect();
            return;
        }

        console.log('[SOCKET CONNECT]', socket.id, playerId);

        let currentGameId: string | null = null;

        /* ========= RECONNECT SUPPORT ========= */
        const existingGame = gameStore.findGameByPlayerId(playerId);

        if (existingGame) {
            const player =
                existingGame.players.white?.playerId === playerId
                    ? existingGame.players.white
                    : existingGame.players.black;

            if (player) {
                player.socketId = socket.id;
                currentGameId = existingGame.id;

                socket.join(existingGame.id);

                // 🛑 Cancel disconnect forfeit
                if (existingGame.disconnectTimer) {
                    clearTimeout(existingGame.disconnectTimer);
                    existingGame.disconnectTimer = undefined;
                }

                socket.emit('game:reconnected', existingGame);

                console.log('[RECONNECTED]', existingGame.id, player.color);
            }
        }

        /* ========= CREATE PRIVATE GAME ========= */
        socket.on('game:create', () => {
            const game = gameStore.create(socket.id, playerId);

            currentGameId = game.id;
            socket.join(game.id);

            socket.emit('game:created', game);
            console.log('[GAME CREATED]', game.id);
        });

        /* ========= JOIN PRIVATE GAME ========= */
        socket.on('game:join', (gameId: string) => {
            const game = gameStore.join(gameId, socket.id, playerId);

            if (!game) {
                socket.emit('game:error', 'Unable to join game');
                return;
            }

            game.status = 'active';
            currentGameId = game.id;

            socket.join(game.id);
            io.to(game.id).emit('game:joined', game);

            console.log('[GAME JOINED]', game.id);
        });

        /* ========= MAKE MOVE ========= */
        socket.on('game:move', ({ gameId, from, to }) => {
            const game = gameStore.get(gameId);
            if (!game || game.status !== 'active') return;

            if (game.pendingPromotion) return;

            const player =
                game.players.white?.socketId === socket.id
                    ? 'white'
                    : game.players.black?.socketId === socket.id
                      ? 'black'
                      : null;

            if (player !== game.turn) return;

            const result = applyMove(game, from, to);

            if (result.type === 'invalid') {
                socket.emit('game:error', 'Invalid move');
                return;
            }

            if (result.type === 'promotion') {
                game.pendingPromotion = {
                    index: result.index,
                    color: player,
                };

                socket.emit('game:promotionRequired', {
                    index: result.index,
                });
                return;
            }

            // NORMAL MOVE
            const nextPlayer = game.turn;

            if (
                isKingInCheck(game.board, nextPlayer) &&
                !hasAnyLegalMoves(game.board, nextPlayer)
            ) {
                game.status = 'ended';
                game.winner = nextPlayer === 'white' ? 'black' : 'white';
                game.endReason = 'checkmate';
            }

            io.to(gameId).emit('game:update', game);
        });

        /* ========= PROMOTION ========= */
        socket.on('game:promote', ({ gameId, piece }) => {
            const game = gameStore.get(gameId);
            if (!game || !game.pendingPromotion) return;

            const { index, color } = game.pendingPromotion;

            const isCorrectPlayer =
                (color === 'white' && game.players.white?.socketId === socket.id) ||
                (color === 'black' && game.players.black?.socketId === socket.id);

            if (!isCorrectPlayer) return;

            game.board[index].piece = {
                type: piece,
                color,
                hasMoved: true,
            };

            game.pendingPromotion = null;
            game.turn = color === 'white' ? 'black' : 'white';

            io.to(gameId).emit('game:update', game);
        });

        /* ========= RESIGN ========= */
        socket.on('game:resign', ({ gameId }) => {
            const game = gameStore.get(gameId);
            if (!game || game.status !== 'active') return;

            const isWhite = game.players.white?.socketId === socket.id;
            const isBlack = game.players.black?.socketId === socket.id;

            if (!isWhite && !isBlack) return;

            game.status = 'ended';
            game.endReason = 'resign';
            game.winner = isWhite ? 'black' : 'white';

            io.to(gameId).emit('game:update', game);
        });

        /* ========= DISCONNECT (GRACEFUL) ========= */
        socket.on('disconnect', () => {
            console.log('[SOCKET DISCONNECT]', socket.id);

            if (!currentGameId) return;

            const game = gameStore.get(currentGameId);
            if (!game || game.status !== 'active') return;

            const disconnectedColor =
                game.players.white?.socketId === socket.id ? 'white' : 'black';

            console.log(`[DISCONNECT] ${disconnectedColor} disconnected from ${currentGameId}`);

            // ⏱ Start forfeit timer
            game.disconnectTimer = setTimeout(() => {
                game.status = 'ended';
                game.endReason = 'disconnect';
                game.winner = disconnectedColor === 'white' ? 'black' : 'white';

                io.to(currentGameId!).emit('game:update', game);

                console.log('[FORFEIT]', currentGameId);
            }, DISCONNECT_TIMEOUT);
        });
    });
}
