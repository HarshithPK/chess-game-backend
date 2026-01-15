import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

import { gameStore } from './game/gameStore';
import { applyMove } from './chess/applyMove';
import { hasAnyLegalMoves, isKingInCheck } from './chess/moveUtils';

import { ENV } from './config/env';

export function initSocket(server: HttpServer) {
    const io = new Server(server, {
        cors: {
            origin: ENV.CLIENT_URL,
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('[SOCKET CONNECT]', socket.id);
        const playerId = socket.handshake.auth.playerId as string;

        if (!playerId) {
            socket.disconnect();
            return;
        }

        console.log('[SOCKET CONNECT]', socket.id, playerId);

        let currentGameId: string | null = null;

        const existingGame = gameStore.findGameByPlayerId(playerId);

        if (existingGame) {
            // Rebind socket
            const player =
                existingGame.players.white?.playerId === playerId
                    ? existingGame.players.white
                    : existingGame.players.black;

            if (player) {
                player.socketId = socket.id;

                socket.join(existingGame.id);
                socket.emit('game:reconnected', existingGame);

                console.log('[RECONNECTED]', existingGame.id, player.color);
            }
        }

        /* ============ CREATE PRIVATE GAME ============ */
        socket.on('game:create', () => {
            const game = gameStore.create(socket.id, playerId);

            currentGameId = game.id;

            socket.join(game.id);
            socket.emit('game:created', game);

            console.log('[GAME CREATED]', game.id);
        });

        /* ============ JOIN PRIVATE GAME ============ */
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

        /* ============ MAKE MOVE ============ */
        socket.on('game:move', ({ gameId, from, to }) => {
            const game = gameStore.get(gameId);
            if (!game || game.status !== 'active') return;

            // Block moves during promotion
            if (game.pendingPromotion) return;

            const player =
                game.players.white?.socketId === socket.id
                    ? 'white'
                    : game.players.black?.socketId === socket.id
                      ? 'black'
                      : null;

            if (player !== game.turn) return;

            //  Apply move using moveUtils (you already have this)
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

            if (result.type === 'normal') {
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
            }
        });

        /* ============ PROMOTION ============ */
        socket.on('game:promote', ({ gameId, piece }) => {
            const game = gameStore.get(gameId);
            if (!game || !game.pendingPromotion) return;

            // 🔒 Prevent double promotion
            if (game.turn !== game.pendingPromotion.color) return;

            const { index, color } = game.pendingPromotion;

            // Only correct player can promote
            const isCorrectPlayer =
                (color === 'white' && game.players.white?.socketId === socket.id) ||
                (color === 'black' && game.players.black?.socketId === socket.id);

            if (!isCorrectPlayer) return;

            // ✅ Apply promotion
            game.board[index].piece = {
                type: piece,
                color,
                hasMoved: true,
            };

            game.pendingPromotion = null;
            game.turn = color === 'white' ? 'black' : 'white';

            io.to(gameId).emit('game:update', game);
        });

        /* ============ RESIGN ============ */
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
            gameStore.remove(gameId);

            console.log('[GAME RESIGNED]', gameId);
        });

        /* ============ DISCONNECT ============ */
        socket.on('disconnect', () => {
            console.log('[SOCKET DISCONNECT]', socket.id);

            if (!currentGameId) return;
            const game = gameStore.get(currentGameId);
            if (!game) return;

            // If game never started → delete it
            if (game.status === 'waiting') {
                gameStore.remove(currentGameId);
                return;
            }

            // Active game → opponent wins
            game.status = 'ended';
            game.endReason = 'disconnect';

            if (game.players.white?.socketId === socket.id) {
                game.winner = 'black';
            } else {
                game.winner = 'white';
            }

            io.to(currentGameId).emit('game:update', game);
            gameStore.remove(currentGameId);
        });
    });
}
