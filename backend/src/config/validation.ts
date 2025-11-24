import Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  TMDB_API_KEY: Joi.string().required(),
  TMDB_ACCESS_TOKEN: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: Joi.string().optional(),
  EMBEDDING_ENDPOINT: Joi.string().uri().optional(),
  EMBEDDING_API_KEY: Joi.string().optional(),
  EMBEDDING_MODEL: Joi.string().optional(),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
  COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
  COOKIE_SAMESITE: Joi.string().valid('lax', 'strict', 'none').optional(),
});
