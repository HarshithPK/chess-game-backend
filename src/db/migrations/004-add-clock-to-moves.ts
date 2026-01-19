import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('moves', 'clock_white', {
        type: DataTypes.INTEGER,
        allowNull: false,
    });

    await queryInterface.addColumn('moves', 'clock_black', {
        type: DataTypes.INTEGER,
        allowNull: false,
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('moves', 'clock_white');
    await queryInterface.removeColumn('moves', 'clock_black');
}
