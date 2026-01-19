import { Request, Response, NextFunction } from 'express';

import { verifyToken } from './jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers.authorization;

    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const token = auth.replace(`Bearer `, '');

    try {
        const payload = verifyToken(token);
        (req as any).userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}
