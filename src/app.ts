import express from 'express';
import cors from 'cors';

import authRoutes from './auth/authRoutes';

import { ENV } from './config/env';

export const app = express();

app.use(express.json());

app.use(
    cors({
        origin: ENV.CLIENT_URL,
        credentials: true,
    })
);

app.get('/health', (_, res) => {
    res.json({ ok: true });
});

// Routes
app.use('/auth', authRoutes);
