import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.addColumn('users', 'is_placement', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.removeColumn('users', 'is_placement');
}
