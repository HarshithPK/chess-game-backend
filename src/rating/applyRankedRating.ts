import { User } from '../db/models';
import { updateElo } from './elo';
import { PLACEMENT_GAMES } from './constants';

const K_PLACEMENT = 64;
const K_NORMAL = 32;

export async function applyRankedRating(game: any) {
    if (!game.isRanked) return;

    const whiteId = game.players.white?.playerId;
    const blackId = game.players.black?.playerId;
    if (!whiteId || !blackId) return;

    const white = await User.findByPk(whiteId);
    const black = await User.findByPk(blackId);
    if (!white || !black) return;

    const whiteScore = game.winner === 'white' ? 1 : game.winner === null ? 0.5 : 0;
    const blackScore = (1 - whiteScore) as 1 | 0.5 | 0;

    /* ========= K FACTOR ========= */

    const whiteK = white.isPlacement ? K_PLACEMENT : K_NORMAL;
    const blackK = black.isPlacement ? K_PLACEMENT : K_NORMAL;

    const newWhiteRating = updateElo(white.rating, black.rating, whiteScore, whiteK);

    const newBlackRating = updateElo(black.rating, white.rating, blackScore, blackK);

    /* ========= UPDATE COUNTERS ========= */

    white.rating = newWhiteRating;
    black.rating = newBlackRating;

    white.rankedGames += 1;
    black.rankedGames += 1;

    /* ========= PLACEMENT EXIT ========= */

    if (white.isPlacement && white.rankedGames >= PLACEMENT_GAMES) {
        white.isPlacement = false;
    }

    if (black.isPlacement && black.rankedGames >= PLACEMENT_GAMES) {
        black.isPlacement = false;
    }

    await Promise.all([white.save(), black.save()]);
}
