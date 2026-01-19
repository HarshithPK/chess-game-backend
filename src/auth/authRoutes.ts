import { Router } from 'express';
import bcrypt from 'bcrypt';

import { User } from '../db/models/User';
import { signToken } from './jwt';

const router = Router();

/* ========= REGISTER ========= */
router.post(`/register`, async (req, res) => {
    const { email, username, displayName, password } = req.body;

    if (!email || !username || !displayName || !password) {
        return res.status(400).json({ error: 'Missing Fields' });
    }

    const existing = await User.findOne({
        where: { email },
    });

    if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
        email,
        username,
        displayName,
        passwordHash,
    });

    const token = signToken(user.id);

    res.status(200).json({
        token,
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
        },
    });
});

/* ========= LOGIN (email OR username) ========= */
router.post(`/login`, async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await User.findOne({
        where: identifier.includes('@') ? { email: identifier } : { username: identifier },
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);

    res.status(200).json({
        token,
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
        },
    });
});

export default router;
