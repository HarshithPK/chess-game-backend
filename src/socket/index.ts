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

import { socketAuth } from '../auth/socketAuth';

import { getEngine, releaseEngine } from '../engine/enginePool';
import { analyzeGame } from '../engine/postGameAnalysis';

import { ENV } from '../config/env';
import { applyClock, checkTimeout } from '../game/clockUtils';

const DISCONNECT_TIMEOUT = ENV.DISCONNECT_TIMEOUT;

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

            if (!player) return;

            player.socketId = socket.id;
            currentGameId = existingGame.id;

            socket.join(existingGame.id);
            socket.emit('game:reconnected', existingGame);
        }

        /* ========= STATE ========= */
        socket.on('game:state', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (game) socket.emit('game:state', game);
        });

        /* ========= CREATE ========= */
        socket.on('game:create', () => {
            const game = gameStore.create(socket.id, userId);
            game.clock = createClock('5+0'); // default for now
            currentGameId = game.id;

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = 1;

            socket.join(game.id);
            socket.emit('game:created', game);
        });

        /* ========= JOIN ========= */
        socket.on('game:join', (gameId: string) => {
            const game = gameStore.join(gameId, socket.id, userId);
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

            applyClock(game, player);

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

            if (result.type === 'invalid') {
                socket.emit('game:error', 'Invalid move');
                return;
            }

            if (result.type === 'promotion') {
                game.pendingPromotion = {
                    index: result.index,
                    color: player,
                    from,
                };
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
                capturedPiece: capturedPiece?.type,
                san,
                boardHash: getPositionHash(game.board, game.turn, game.enPassantTarget),
                halfMoveClock: game.halfMoveClock,
            });

            const nextPlayer = player === 'white' ? 'black' : 'white';
            game.turn = nextPlayer;

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = (game.positionHistory[hash] ?? 0) + 1;

            const endGame = async (winner: 'white' | 'black' | null, reason: any) => {
                game.status = 'ended';
                game.winner = winner;
                game.endReason = reason;

                releaseEngine(game.id);
                game.analysis = await analyzeGame(game);

                io.to(gameId).emit('game:update', game);
            };

            if (game.positionHistory[hash] >= 3) {
                endGame(null, 'threefold');
                return;
            }

            if (game.halfMoveClock >= 100) {
                endGame(null, 'fifty-move');
                return;
            }

            if (isInsufficientMaterial(game.board)) {
                endGame(null, 'insufficient-material');
                return;
            }

            const inCheck = isKingInCheck(game.board, nextPlayer);
            const hasMoves = hasAnyLegalMoves(game.board, nextPlayer, game.enPassantTarget);

            if (!hasMoves) {
                endGame(inCheck ? player : null, inCheck ? 'checkmate' : 'stalemate');
                return;
            }

            const fen = boardToFEN(game.board, game.turn, game.enPassantTarget);
            const engine = getEngine(game.id);

            engine.evaluate(fen).then((evalResult) => {
                io.to(game.id).emit('game:engineEval', evalResult);
            });

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

            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            game.board[index].piece = {
                type: piece,
                color,
                hasMoved: true,
            };

            game.pendingPromotion = null;

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

            const nextPlayer = color === 'white' ? 'black' : 'white';
            game.turn = nextPlayer;

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = (game.positionHistory[hash] ?? 0) + 1;

            const endGame = async (winner: 'white' | 'black' | null, reason: any) => {
                game.status = 'ended';
                game.winner = winner;
                game.endReason = reason;

                releaseEngine(game.id);
                game.analysis = await analyzeGame(game);

                io.to(gameId).emit('game:update', game);
            };

            if (game.positionHistory[hash] >= 3) {
                endGame(null, 'threefold');
                return;
            }

            if (game.halfMoveClock >= 100) {
                endGame(null, 'fifty-move');
                return;
            }

            if (isInsufficientMaterial(game.board)) {
                endGame(null, 'insufficient-material');
                return;
            }

            const inCheck = isKingInCheck(game.board, nextPlayer);
            const hasMoves = hasAnyLegalMoves(game.board, nextPlayer, game.enPassantTarget);

            if (!hasMoves) {
                endGame(inCheck ? color : null, inCheck ? 'checkmate' : 'stalemate');
                return;
            }

            const fen = boardToFEN(game.board, game.turn, game.enPassantTarget);
            const engine = getEngine(game.id);

            engine.evaluate(fen).then((evalResult) => {
                io.to(game.id).emit('game:engineEval', evalResult);
            });

            io.to(gameId).emit('game:update', game);
        });

        /* ========= RESIGN ========= */
        socket.on('game:resign', async ({ gameId }) => {
            const game = gameStore.get(gameId);
            if (!game || game.status !== 'active') return;

            const isWhite = game.players.white?.socketId === socket.id;
            const isBlack = game.players.black?.socketId === socket.id;
            if (!isWhite && !isBlack) return;

            game.status = 'ended';
            game.endReason = 'resign';
            game.winner = isWhite ? 'black' : 'white';

            releaseEngine(game.id);
            game.analysis = await analyzeGame(game);

            io.to(gameId).emit('game:update', game);
        });

        /* ========= PGN ========= */
        socket.on('game:pgn', (gameId: string) => {
            const game = gameStore.get(gameId);
            if (game) socket.emit('game:pgn', generatePGN(game));
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

            game.disconnectTimer = setTimeout(async () => {
                game.status = 'ended';
                game.endReason = 'disconnect';
                game.winner = disconnectedColor === 'white' ? 'black' : 'white';

                releaseEngine(game.id);
                game.analysis = await analyzeGame(game);

                io.to(currentGameId!).emit('game:update', game);
            }, DISCONNECT_TIMEOUT);
        });
    });
}
