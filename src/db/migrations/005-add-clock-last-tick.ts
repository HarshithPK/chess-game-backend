import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('games', 'clock_last_tick', {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: Date.now(),
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('games', 'clock_last_tick');
}
