import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('users', 'rating', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1200,
    });

    await queryInterface.addColumn('users', 'ranked_games', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('users', 'rating');
    await queryInterface.removeColumn('users', 'ranked_games');
}
