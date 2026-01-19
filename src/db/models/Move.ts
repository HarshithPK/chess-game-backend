import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../sequelize';
import { PlayerColor } from '../../game/gameTypes';

export class Move extends Model {
    declare id: string;
    declare gameId: string;
    declare moveNumber: number;

    declare color: PlayerColor;

    declare fromSquare: number;
    declare toSquare: number;

    declare piece: string;
    declare capture: boolean;
    declare promotion: string | null;

    declare san: string | null;
    declare annotation: string | null;

    declare evalBefore: number | null;
    declare evalAfter: number | null;

    // ⏱️ CLOCK SNAPSHOTS (milliseconds)
    declare clockWhite: number;
    declare clockBlack: number;
}

Move.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },

        gameId: {
            type: DataTypes.UUID,
            allowNull: false,
        },

        moveNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        color: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        fromSquare: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        toSquare: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        piece: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        capture: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },

        promotion: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        san: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        annotation: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        evalBefore: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        evalAfter: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        clockWhite: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        clockBlack: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    },
    {
        sequelize,
        tableName: 'moves',
        underscored: true,
        timestamps: true,
    }
);
