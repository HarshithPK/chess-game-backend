import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export class UserRating extends Model {
    declare id: string;
    declare userId: string;
    declare category: string;
    declare rating: number;
    declare rankedGames: number;
    declare isPlacement: boolean;
}

UserRating.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'user_id',
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1200,
        },
        rankedGames: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'ranked_games',
            defaultValue: 0,
        },
        isPlacement: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            field: 'is_placement',
            defaultValue: true,
        },
    },
    {
        sequelize,
        tableName: 'user_ratings',
        underscored: true,
    }
);
