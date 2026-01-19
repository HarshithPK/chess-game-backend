import { Socket } from 'socket.io';
import { verifyToken } from './jwt';

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const payload = verifyToken(token);
        socket.data.userId = payload.userId;
        next();
    } catch {
        next(new Error(`Invalid or expired token`));
    }
}
