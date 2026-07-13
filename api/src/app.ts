import express from 'express';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { courtsRouter } from './routes/courts';

export const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Route mounts are added here by later tasks, always ABOVE the error handler.

app.use('/api/courts', requireAuth, courtsRouter);
app.use('/api/bookings', requireAuth, bookingsRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);
