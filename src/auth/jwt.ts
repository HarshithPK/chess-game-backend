import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { ENV } from '../config/env';

const JWT_SECRET: Secret = ENV.JWT.SECRET;

const JWT_EXPIRES_IN: SignOptions['expiresIn'] = ENV.JWT.EXPIRES_IN as SignOptions['expiresIn'];

export function signToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: string } {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
}
