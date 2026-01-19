import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.createTable('moves', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
        },

        game_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'games',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },

        move_number: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        color: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        from_square: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        to_square: {
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

        eval_before: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },

        eval_after: {
            type: DataTypes.INTEGER,
            allowNull: true,
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
    await queryInterface.dropTable('moves');
}
