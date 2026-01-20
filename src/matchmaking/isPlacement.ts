import { User } from '../db/models';
import { PLACEMENT_GAMES } from './constants';

export async function isPlacementPlayer(userId: string): Promise<boolean> {
    const user = await User.findByPk(userId, {
        attributes: ['ranked_games'],
    });

    if (!user) return false;
    return user.rankedGames < PLACEMENT_GAMES;
}
