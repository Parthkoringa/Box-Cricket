import express from 'express';
import { errorHandler } from './middleware/error-handler';

export const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Route mounts are added here by later tasks, always ABOVE the error handler.

app.use(errorHandler);
