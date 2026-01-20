import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
    await queryInterface.createTable('user_ratings', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onDelete: 'CASCADE',
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

        ranked_games: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },

        is_placement: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },

        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    });

    await queryInterface.addConstraint('user_ratings', {
        fields: ['user_id', 'category'],
        type: 'unique',
        name: 'unique_user_category_rating',
    });
}

export async function down(queryInterface: QueryInterface) {
    await queryInterface.dropTable('user_ratings');
}
