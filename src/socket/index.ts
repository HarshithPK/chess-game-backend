import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

import { gameStore } from '../game/gameStore';
import { applyMove } from '../chess/applyMove';
import { getPositionHash } from '../chess/positionHash';
import { generateSAN } from '../chess/generateSan';
import { generatePGN } from '../chess/generatePGN';

import { applyClock, checkTimeout } from '../game/clockUtils';
import { socketAuth } from '../auth/socketAuth';

import { releaseEngine } from '../engine/enginePool';
import { analyzeGame } from '../engine/postGameAnalysis';

/* MATCHMAKING */
import { enqueueCasual } from '../matchmaking/enqueue';
import { tryMatchCasual } from '../matchmaking/tryMatch';
import { enqueueRanked } from '../matchmaking/enqueueRanked';
import { tryMatchRanked } from '../matchmaking/tryMatchRanked';
import { removeUserFromAllQueues } from '../matchmaking/removeUser';
import { estimateWaitTime } from '../matchmaking/estimateWait';

/* DB */
import { Game, Move, User } from '../db/models';
import { ENV } from '../config/env';

/* RATING */
import { updateElo } from '../rating/elo';

const DISCONNECT_TIMEOUT = ENV.DISCONNECT_TIMEOUT;

/* ================= DB MOVE PERSIST ================= */

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

/* ================= RANKED RATING ================= */

async function applyRankedRating(game: any) {
    if (!game.isRanked) return;

    const whiteId = game.players.white?.playerId;
    const blackId = game.players.black?.playerId;
    if (!whiteId || !blackId) return;

    const white = await User.findByPk(whiteId);
    const black = await User.findByPk(blackId);
    if (!white || !black) return;

    const whiteRating = (white as any).rating ?? 1200;
    const blackRating = (black as any).rating ?? 1200;

    const whiteScore = game.winner === 'white' ? 1 : game.winner === null ? 0.5 : 0;
    const blackScore = 1 - whiteScore;

    await white.update({
        rating: updateElo(whiteRating, blackRating, whiteScore),
        gamesPlayed: ((white as any).gamesPlayed ?? 0) + 1,
    } as any);

    await black.update({
        rating: updateElo(blackRating, whiteRating, blackScore as 0 | 0.5 | 1),
        gamesPlayed: ((black as any).gamesPlayed ?? 0) + 1,
    } as any);
}

/* ================= SOCKET ================= */

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
        if (!userId) return socket.disconnect();

        let currentGameId: string | null = null;

        /* ===== RECONNECT ===== */
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

        /* ===== RANKED MATCHMAKING ===== */
        socket.on('matchmaking:ranked:join', async ({ timeControl }) => {
            await removeUserFromAllQueues(userId);

            const user = await User.findByPk(userId);
            if (!user) return;

            await enqueueRanked({
                userId,
                rating: (user as any).rating ?? 1200,
                timeControl,
            });

            const match = await tryMatchRanked(timeControl);
            if (match) {
                io.to(match.p1).emit('matchmaking:matched', match);
                io.to(match.p2).emit('matchmaking:matched', match);
            } else {
                socket.emit('matchmaking:queued', { ranked: true });
            }
        });

        /* ===== CASUAL MATCHMAKING ===== */
        socket.on('matchmaking:join', async ({ timeControl }) => {
            await removeUserFromAllQueues(userId);

            await enqueueCasual({ userId, socketId: socket.id, timeControl });

            const estimate = await estimateWaitTime(timeControl);
            const match = await tryMatchCasual(timeControl);

            if (match) {
                io.to(match.p1.socketId).emit('matchmaking:matched', match);
                io.to(match.p2.socketId).emit('matchmaking:matched', match);
            } else {
                socket.emit('matchmaking:queued', {
                    timeControl,
                    estimatedWait: estimate,
                });
            }
        });

        socket.on('matchmaking:cancel', async () => {
            await removeUserFromAllQueues(userId);
            socket.emit('matchmaking:cancelled');
        });

        /* ===== GAME MOVE ===== */
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

            /* ⏱ CLOCK */
            applyClock(game, player);

            await Game.update(
                { clockLastTick: game.clock!.lastMoveAt },
                { where: { id: game.id } }
            );

            const timedOut = checkTimeout(game);
            if (timedOut) {
                await endGame(game, timedOut === 'white' ? 'black' : 'white', 'timeout', io);
                return;
            }

            const movingPiece = game.board[from].piece;
            const capturedPiece = game.board[to].piece ?? null;
            const boardBefore = game.board.map((sq) => ({ piece: sq.piece }));

            const result = applyMove(game, from, to);

            if (result.type === 'invalid') return;

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

        /* ===== DISCONNECT ===== */
        socket.on('disconnect', async () => {
            await removeUserFromAllQueues(userId);
            if (!currentGameId) return;

            const game = gameStore.get(currentGameId);
            if (!game || game.status !== 'active') return;

            const color = game.players.white?.socketId === socket.id ? 'white' : 'black';

            game.disconnectTimer = setTimeout(async () => {
                await endGame(game, color === 'white' ? 'black' : 'white', 'disconnect', io);
            }, DISCONNECT_TIMEOUT);
        });
    });

    return io;
}

/* ================= GAME END ================= */

async function endGame(game: any, winner: 'white' | 'black' | null, reason: any, io: Server) {
    game.status = 'ended';
    game.winner = winner;
    game.endReason = reason;

    releaseEngine(game.id);
    await applyRankedRating(game);
    game.analysis = await analyzeGame(game);

    await Game.update(
        {
            status: 'ended',
            winner,
            endReason: reason,
            analysis: game.analysis,
            pgn: generatePGN(game),
        },
        { where: { id: game.id } }
    );

    io.to(game.id).emit('game:update', game);
}
