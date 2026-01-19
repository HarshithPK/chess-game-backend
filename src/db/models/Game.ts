import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../sequelize';
import { Move } from './Move';

export class Game extends Model {
    declare id: string;
    declare whiteUserId: string;
    declare blackUserId: string | null;
    declare status: string;
    declare winner: string | null;
    declare endReason: string | null;
    declare timeControl: string;
    declare clockLastTick: number;

    declare moves?: Move[];
}

Game.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        whiteUserId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        blackUserId: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        winner: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        endReason: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        timeControl: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        clockLastTick: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
    },
    { sequelize, tableName: 'games', underscored: true, timestamps: true }
);
