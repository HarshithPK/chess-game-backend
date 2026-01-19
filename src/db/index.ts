import './models';
import { sequelize } from './sequelize';

export async function initDB() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        await sequelize.sync();
        console.log('✅ Models synced');
    } catch (err) {
        console.error('❌ DB connection failed', err);
        process.exit(1);
    }
}
