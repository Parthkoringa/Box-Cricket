function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get jwtSecret(): string {
    return required('JWT_SECRET');
  },
};
