import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

import { gameStore } from '../game/gameStore';
import { applyMove } from '../chess/applyMove';
import { hasAnyLegalMoves, isKingInCheck } from '../chess/moveUtils';
import { getPositionHash } from '../chess/positionHash';
import { generateSAN } from '../chess/generateSan';
import { generatePGN } from '../chess/generatePGN';
import { isInsufficientMaterial } from '../chess/insufficientMaterial';

import { ENV } from '../config/env';

const DISCONNECT_TIMEOUT = ENV.DISCONNECT_TIMEOUT;

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

        let currentGameId: string | null = null;

        /* ========= RECONNECT SUPPORT ========= */
        const existingGame = gameStore.findGameByPlayerId(playerId);
        if (existingGame) {
            const player =
                existingGame.players.white?.playerId === playerId
                    ? existingGame.players.white
                    : existingGame.players.black?.playerId === playerId
                      ? existingGame.players.black
                      : null;

            if (!player) return;

            player.socketId = socket.id;
            currentGameId = existingGame.id;
            socket.join(existingGame.id);
            socket.emit('game:reconnected', existingGame);
        }

        /* ========= GET GAME STATE ========= */
        socket.on('game:state', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (game) socket.emit('game:state', game);
        });

        /* ========= CREATE GAME ========= */
        socket.on('game:create', () => {
            const game = gameStore.create(socket.id, playerId);
            currentGameId = game.id;

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = 1;

            socket.join(game.id);
            socket.emit('game:created', game);
        });

        /* ========= JOIN GAME ========= */
        socket.on('game:join', (gameId: string) => {
            const game = gameStore.join(gameId, socket.id, playerId);
            if (!game) {
                socket.emit('game:error', 'Unable to join game');
                return;
            }

            game.status = 'active';
            currentGameId = game.id;

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = 1;

            socket.join(game.id);
            io.to(game.id).emit('game:joined', game);
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

            const movingPiece = game.board[from].piece;
            const capturedPiece = game.board[to].piece ?? null;

            // ✅ capture board BEFORE move
            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            const result = applyMove(game, from, to);

            if (result.type === 'invalid') {
                socket.emit('game:error', 'Invalid move');
                return;
            }

            if (result.type === 'promotion') {
                game.pendingPromotion = {
                    index: result.index,
                    color: player,
                    from, // ✅ store pawn origin
                };

                socket.emit('game:promotionRequired', { index: result.index });
                return;
            }

            /** ♟️ RECORD MOVE */
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
                capturedPiece: capturedPiece?.type,
                san,
                boardHash: getPositionHash(game.board, game.turn, game.enPassantTarget),
                halfMoveClock: game.halfMoveClock,
            });

            /** ✅ SWITCH TURN */
            const nextPlayer = player === 'white' ? 'black' : 'white';
            game.turn = nextPlayer;

            /** 🔁 THREEFOLD REPETITION */
            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = (game.positionHistory[hash] ?? 0) + 1;

            if (game.positionHistory[hash] >= 3) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'threefold';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ♟️ 50-MOVE RULE */
            if (game.halfMoveClock >= 100) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'fifty-move';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ♟️ INSUFFICIENT MATERIAL */
            if (isInsufficientMaterial(game.board)) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'insufficient-material';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ✅ CHECKMATE / STALEMATE */
            const inCheck = isKingInCheck(game.board, nextPlayer);
            const hasMoves = hasAnyLegalMoves(game.board, nextPlayer, game.enPassantTarget);

            if (!hasMoves) {
                game.status = 'ended';
                game.winner = inCheck ? player : null;
                game.endReason = inCheck ? 'checkmate' : 'stalemate';
            }

            io.to(gameId).emit('game:update', game);
        });

        /* ========= PROMOTION ========= */
        socket.on('game:promote', ({ gameId, piece }) => {
            const game = gameStore.get(gameId);
            if (!game || !game.pendingPromotion) return;

            const { index, color, from } = game.pendingPromotion;

            const isCorrectPlayer =
                (color === 'white' && game.players.white?.socketId === socket.id) ||
                (color === 'black' && game.players.black?.socketId === socket.id);

            if (!isCorrectPlayer) return;

            // board before promotion
            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            game.board[index].piece = {
                type: piece,
                color,
                hasMoved: true,
            };

            game.pendingPromotion = null;

            /** ♟️ RECORD PROMOTION */
            const san = generateSAN(boardBefore, game.board, {
                from,
                to: index,
                piece: 'pawn',
                color,
                capture: false,
                promotion: piece,
            });

            game.moveHistory.push({
                from,
                to: index,
                piece: 'pawn',
                color,
                capture: false,
                promotion: piece,
                san,
                boardHash: getPositionHash(game.board, game.turn, game.enPassantTarget),
                halfMoveClock: game.halfMoveClock,
            });

            /** ✅ SWITCH TURN */
            const nextPlayer = color === 'white' ? 'black' : 'white';
            game.turn = nextPlayer;

            /** 🔁 THREEFOLD REPETITION */
            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = (game.positionHistory[hash] ?? 0) + 1;

            if (game.positionHistory[hash] >= 3) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'threefold';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ♟️ 50-MOVE RULE */
            if (game.halfMoveClock >= 100) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'fifty-move';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ♟️ INSUFFICIENT MATERIAL */
            if (isInsufficientMaterial(game.board)) {
                game.status = 'ended';
                game.winner = null;
                game.endReason = 'insufficient-material';
                io.to(gameId).emit('game:update', game);
                return;
            }

            /** ✅ CHECKMATE / STALEMATE */
            const inCheck = isKingInCheck(game.board, nextPlayer);
            const hasMoves = hasAnyLegalMoves(game.board, nextPlayer, game.enPassantTarget);

            if (!hasMoves) {
                game.status = 'ended';
                game.winner = inCheck ? color : null;
                game.endReason = inCheck ? 'checkmate' : 'stalemate';
            }

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

        /* ========= SPECTATE ========= */
        socket.on('game:spectate', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (!game) return;

            socket.join(game.id);
            socket.emit('game:spectating', game);
        });

        /* ========= DISCONNECT ========= */
        socket.on('disconnect', () => {
            if (!currentGameId) return;

            const game = gameStore.get(currentGameId);
            if (!game || game.status !== 'active') return;

            const disconnectedColor =
                game.players.white?.socketId === socket.id ? 'white' : 'black';

            game.disconnectedColor = disconnectedColor;
            game.disconnectDeadline = Date.now() + DISCONNECT_TIMEOUT;

            io.to(currentGameId).emit('game:update', game);

            game.disconnectTimer = setTimeout(() => {
                game.status = 'ended';
                game.endReason = 'disconnect';
                game.winner = disconnectedColor === 'white' ? 'black' : 'white';
                io.to(currentGameId!).emit('game:update', game);
            }, DISCONNECT_TIMEOUT);
        });

        /* ========= EXPORT MOVES PNG ========= */
        socket.on('game:pgn', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (!game) return;

            const pgn = generatePGN(game);
            socket.emit('game:pgn', pgn);
        });
    });
}
