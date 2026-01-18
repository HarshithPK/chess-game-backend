import { DataTypes, Model } from 'sequelize';

import { sequelize } from '../sequelize';

export class User extends Model {
    declare id: string;
    declare email: string;
    declare username: string;
    declare displayName: string;
    declare passwordHash: string;
}

User.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        displayName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        passwordHash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    { sequelize, tableName: 'users', timestamps: true, underscored: true }
);
