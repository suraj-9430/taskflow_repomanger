import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  mongodbUri: string;
  corsOrigin: string;
  jwt: {
    secret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  redis: {
    url: string;
  };
  rabbitmq: {
    url?: string;
  };
  email: {
    user?: string;
    pass?: string;
  };
  ai: {
    enabled: boolean;
    geminiApiKey?: string;
  };
}

const INSECURE_FALLBACK_SECRETS = [
  'fallback_secret_key_change_me',
  'secret',
  '123456',
  'your_jwt_secret_here',
];

export class ConfigValidationError extends Error {
  constructor(public readonly missingOrInvalid: string[]) {
    super(`Configuration validation failed:\n - ${missingOrInvalid.join('\n - ')}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates environment variables according to security guidelines:
 * - Distinguishes strictly required core settings from optional integrations.
 * - Enforces minimum secret entropy and disallows known fallback keys.
 * - Optional services (e.g. Gemini AI) degrade gracefully rather than crashing the core server.
 */
export const validateConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const errors: string[] = [];

  const nodeEnv = (env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const port = parseInt(env.PORT || '5000', 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push('PORT must be a valid port number between 1 and 65535.');
  }

  const mongodbUri = env.MONGODB_URI?.trim();
  if (!mongodbUri) {
    errors.push('MONGODB_URI is required.');
  }

  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else if (INSECURE_FALLBACK_SECRETS.includes(jwtSecret)) {
    errors.push('JWT_SECRET must not use an insecure or placeholder secret.');
  } else if (jwtSecret.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters long for adequate cryptographic entropy.');
  }

  const refreshSecret = env.REFRESH_SECRET?.trim() || jwtSecret || '';
  if (INSECURE_FALLBACK_SECRETS.includes(refreshSecret)) {
    errors.push('REFRESH_SECRET must not use an insecure or placeholder secret.');
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  const corsOrigin = env.CORS_ORIGIN?.trim() || 'http://localhost:3000,http://localhost:4200';

  // Evaluate optional Gemini AI integration
  const rawGeminiKey = env.GEMINI_API_KEY?.trim();
  const isGeminiValid = Boolean(
    rawGeminiKey &&
      !rawGeminiKey.includes('your_actual_key_here') &&
      rawGeminiKey.length > 10
  );

  if (!isGeminiValid && nodeEnv !== 'test') {
    console.warn('⚠️ GEMINI_API_KEY is not configured or is a placeholder. AI assistant features will be disabled.');
  }

  const validated: AppConfig = {
    port,
    nodeEnv,
    mongodbUri: mongodbUri!,
    corsOrigin,
    jwt: {
      secret: jwtSecret!,
      refreshSecret,
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    redis: {
      url: env.REDIS_URL?.trim() || 'redis://localhost:6379',
    },
    rabbitmq: {
      url: env.RABBITMQ_URL?.trim(),
    },
    email: {
      user: env.EMAIL_USER?.trim(),
      pass: env.EMAIL_PASS?.trim(),
    },
    ai: {
      enabled: isGeminiValid,
      geminiApiKey: isGeminiValid ? rawGeminiKey : undefined,
    },
  };

  return Object.freeze(validated);
};

// Singleton validated config for application use
export const config: AppConfig = validateConfig();
