import { Game } from './Game';
import { Move } from './Move';
import { User } from './User';

/* ========= ASSOCIATIONS ========= */

/* User ↔ Game */
User.hasMany(Game, { foreignKey: 'whiteUserId', as: 'whiteGames' });
User.hasMany(Game, { foreignKey: 'blackUserId', as: 'blackGames' });

Game.belongsTo(User, { foreignKey: 'whiteUserId', as: 'whitePlayer' });
Game.belongsTo(User, { foreignKey: 'blackUserId', as: 'blackPlayer' });

/* Game ↔ Move */
Game.hasMany(Move, {
    foreignKey: 'gameId',
    as: 'moves',
    onDelete: 'CASCADE',
});

Move.belongsTo(Game, {
    foreignKey: 'gameId',
    as: 'game',
});

/* ========= EXPORT ========= */
export { User, Game, Move };
