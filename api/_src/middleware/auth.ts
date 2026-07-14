import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { forbidden, unauthorized } from '../errors';

export interface AuthUser {
  sub: string;
  role: 'owner' | 'worker';
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next(unauthorized('Missing token'));
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
};

export const requireRole = (role: 'owner' | 'worker'): RequestHandler => (req, _res, next) => {
  if (req.user?.role !== role) return next(forbidden());
  next();
};
