import express from 'express';
import { requireAuth, requireRole } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { courtsRouter } from './routes/courts';
import { itemsRouter } from './routes/items';
import { paymentsRouter } from './routes/payments';
import { remindersRouter } from './routes/reminders';
import { reportsRouter } from './routes/reports';
import { usersRouter } from './routes/users';

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
