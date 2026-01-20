import { User } from '../db/models';
import { updateElo } from './elo';

const PLACEMENT_GAMES = 10;

function getKFactor(rankedGames: number) {
    if (rankedGames < PLACEMENT_GAMES) return 40; // placement boost
    if (rankedGames < 50) return 24;
    return 16;
}

export async function applyRankedRating(game: any) {
    if (!game.isRanked) return;

    const whiteId = game.players.white?.playerId;
    const blackId = game.players.black?.playerId;
    if (!whiteId || !blackId) return;

    const [white, black] = await Promise.all([User.findByPk(whiteId), User.findByPk(blackId)]);

    if (!white || !black) return;

    const whiteScore = game.winner === 'white' ? 1 : game.winner === null ? 0.5 : 0;
    const blackScore = (1 - whiteScore) as 1 | 0.5 | 0;

    const whiteK = getKFactor(white.rankedGames);
    const blackK = getKFactor(black.rankedGames);

    const newWhiteRating = updateElo(white.rating, black.rating, whiteScore, whiteK);

    const newBlackRating = updateElo(black.rating, white.rating, blackScore, blackK);

    const whiteGames = white.rankedGames + 1;
    const blackGames = black.rankedGames + 1;

    await Promise.all([
        white.update({
            rating: newWhiteRating,
            rankedGames: whiteGames,
            isPlacement: whiteGames < PLACEMENT_GAMES,
        }),
        black.update({
            rating: newBlackRating,
            rankedGames: blackGames,
            isPlacement: blackGames < PLACEMENT_GAMES,
        }),
    ]);
}
