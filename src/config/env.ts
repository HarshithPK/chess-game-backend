import dotenv from 'dotenv';

dotenv.config();

export const ENV = {
    PORT: Number(process.env.PORT || 4000),
    NODE_ENV: process.env.NODE_ENV || 'development',
    CLIENT_URL: process.env.CLIENT_URL || '*',
};
