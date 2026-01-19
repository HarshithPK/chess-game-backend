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

        // ⏱️ CLOCK SNAPSHOT (CRITICAL)
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
        socket.on('game:create', async () => {
            const game = gameStore.create(socket.id, userId);
            game.clock = createClock('5+0');
            currentGameId = game.id;

            await Game.create({
                id: game.id,
                whiteUserId: userId,
                status: 'waiting',
                timeControl: '5+0',
                clockLastTick: Date.now(),
            });

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = 1;

            socket.join(game.id);
            socket.emit('game:created', game);
        });

        /* ========= JOIN ========= */
        socket.on('game:join', async (gameId: string) => {
            const game = gameStore.join(gameId, socket.id, userId);
            if (!game) {
                socket.emit('game:error', 'Unable to join game');
                return;
            }

            game.status = 'active';
            currentGameId = game.id;

            await Game.update(
                { blackUserId: userId, status: 'active' },
                { where: { id: game.id } }
            );

            const hash = getPositionHash(game.board, game.turn, game.enPassantTarget);
            game.positionHistory[hash] = 1;

            socket.join(game.id);
            io.to(game.id).emit('game:joined', game);
        });

        /* ========= MAKE MOVE ========= */
        socket.on('game:move', async ({ gameId, from, to }) => {
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

            // Persist lastMoveAt into DB clock_last_tick
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
            if (result.type === 'invalid') {
                socket.emit('game:error', 'Invalid move');
                return;
            }

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
                capturedPiece: capturedPiece?.type,
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

                await Game.update(
                    {
                        status: 'ended',
                        winner,
                        endReason: reason,
                        pgn: generatePGN(game),
                        analysis: game.analysis,
                    },
                    { where: { id: game.id } }
                );

                io.to(gameId).emit('game:update', game);
            };

            if (game.positionHistory[hash] >= 3) return endGame(null, 'threefold');
            if (game.halfMoveClock >= 100) return endGame(null, 'fifty-move');
            if (isInsufficientMaterial(game.board)) return endGame(null, 'insufficient-material');

            const inCheck = isKingInCheck(game.board, nextPlayer);
            const hasMoves = hasAnyLegalMoves(game.board, nextPlayer, game.enPassantTarget);
            if (!hasMoves)
                return endGame(inCheck ? player : null, inCheck ? 'checkmate' : 'stalemate');

            const fen = boardToFEN(game.board, game.turn, game.enPassantTarget);
            getEngine(game.id)
                .evaluate(fen)
                .then((evalResult) => {
                    io.to(game.id).emit('game:engineEval', evalResult);
                });

            io.to(gameId).emit('game:update', game);
        });

        /* ========= PROMOTION ========= */
        socket.on('game:promote', async ({ gameId, piece }) => {
            const game = gameStore.get(gameId);
            if (!game || !game.pendingPromotion) return;

            const { index, color, from } = game.pendingPromotion;

            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            game.board[index].piece = { type: piece, color, hasMoved: true };
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

            await persistMove({
                game,
                moveNumber: game.moveHistory.length,
                from,
                to: index,
                piece: 'pawn',
                color,
                capture: false,
                promotion: piece,
                san,
            });

            game.turn = color === 'white' ? 'black' : 'white';
            io.to(gameId).emit('game:update', game);
        });
    });
}
