import { applyMove } from '../chess/applyMove';
import { createGame } from './createGame';
import { Game } from './gameTypes';

class GameStore {
    private games = new Map<string, Game>();

    create(socketId: string, playerId: string): Game {
        const game = createGame(socketId, playerId);
        this.games.set(game.id, game);
        return game;
    }

    get(gameId: string): Game | null {
        return this.games.get(gameId) ?? null;
    }

    findGameByPlayerId(playerId: string): Game | undefined {
        for (const game of this.games.values()) {
            if (
                game.players.white?.playerId === playerId ||
                game.players.black?.playerId === playerId
            ) {
                return game;
            }
        }
    }

    join(gameId: string, socketId: string, playerId: string): Game | null {
        const game = this.games.get(gameId);

        if (!game) return null;
        if (game.players.white?.socketId === socketId) {
            return null;
        }
        if (game.status !== 'waiting') return null;

        game.players.black = {
            socketId,
            playerId,
            color: 'black',
        };

        game.status = 'active';
        return game;
    }

    leave(gameId: string, socketId: string) {
        const game = this.games.get(gameId);
        if (!game) return;

        if (game.players.white?.socketId === socketId) {
            game.players.white = undefined;
        }

        if (game.players.black?.socketId === socketId) {
            game.players.black = undefined;
        }

        game.status = 'waiting';

        if (!game.players.white && !game.players.black) {
            this.remove(gameId);
        }
    }

    remove(gameId: string) {
        this.games.delete(gameId);
    }

    makeMove(gameId: string, socketId: string, move: { from: number; to: number }): Game | null {
        const game = this.games.get(gameId);
        if (!game) return null;
        if (game.status !== 'active') return null;

        const player =
            game.players.white?.socketId === socketId
                ? game.players.white
                : game.players.black?.socketId === socketId
                  ? game.players.black
                  : null;

        if (!player) return null;
        if (player.color !== game.turn) return null;

        const success = applyMove(game, move.from, move.to);
        if (!success) return null;

        return game;
    }
}

export const gameStore = new GameStore();
