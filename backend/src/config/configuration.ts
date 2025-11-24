export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  tmdb: {
    apiKey: process.env.TMDB_API_KEY,
    accessToken: process.env.TMDB_ACCESS_TOKEN,
    language: 'ru-RU',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
  cors: {
    allowedOrigins: (
      process.env.CORS_ALLOWED_ORIGINS ??
      process.env.FRONTEND_URL ??
      'http://localhost:5173'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  cookies: {
    domain: process.env.COOKIE_DOMAIN,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
});
