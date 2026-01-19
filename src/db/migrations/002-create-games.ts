import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.createTable('games', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
        },

        white_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },

        black_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        winner: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        end_reason: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        time_control: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.dropTable('games');
}
