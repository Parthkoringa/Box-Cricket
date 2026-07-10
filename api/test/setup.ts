import 'dotenv/config';

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST is required to run the test suite (Neon test branch, pooled string)');
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET ??= 'test-secret';
