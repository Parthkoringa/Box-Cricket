import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config';
import { db } from '../db';
import { unauthorized } from '../errors';

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  const rows = await db().query(
    'SELECT id, name, role, password_hash, is_active FROM users WHERE phone = $1 OR email = $1',
    [identifier],
  ) as unknown as Array<{ id: string; name: string; role: 'owner' | 'worker'; password_hash: string; is_active: boolean }>;
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw unauthorized('Invalid credentials');
  }
  const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, {
    expiresIn: '12h',
  });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});
