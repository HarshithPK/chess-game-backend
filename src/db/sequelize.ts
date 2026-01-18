import { Sequelize } from 'sequelize';

import { ENV } from '../config/env';

export const sequelize = new Sequelize(ENV.DB.NAME, ENV.DB.USER, ENV.DB.PASSWORD, {
    host: ENV.DB.HOST,
    port: ENV.DB.PORT,
    dialect: 'postgres',
});
