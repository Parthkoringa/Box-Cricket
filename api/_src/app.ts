import express from 'express';
import { requireAuth, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { bookingsRouter } from './routes/bookings.js';
import { courtsRouter } from './routes/courts.js';
import { itemsRouter } from './routes/items.js';
import { paymentsRouter } from './routes/payments.js';
import { remindersRouter } from './routes/reminders.js';
import { reportsRouter } from './routes/reports.js';
import { usersRouter } from './routes/users.js';

export const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Route mounts are added here by later tasks, always ABOVE the error handler.

app.use('/api/courts', requireAuth, courtsRouter);
app.use('/api/bookings', requireAuth, bookingsRouter);
app.use('/api/payments', requireAuth, paymentsRouter);
app.use('/api/items', requireAuth, itemsRouter);
app.use('/api/reminders', requireAuth, remindersRouter);
app.use('/api/reports', requireAuth, requireRole('owner'), reportsRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);
