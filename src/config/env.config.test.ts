import { validateConfig, ConfigValidationError } from './env.config';

describe('Environment Configuration Validation (PDF Section 2)', () => {
  const baseValidEnv: NodeJS.ProcessEnv = {
    PORT: '5000',
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017/test_db',
    JWT_SECRET: 'super_secure_jwt_secret_key_32_characters_long',
    REFRESH_SECRET: 'super_secure_refresh_secret_key_32_characters_long',
    CORS_ORIGIN: 'http://localhost:3000',
  };

  it('should successfully validate and freeze a complete valid configuration', () => {
    const config = validateConfig(baseValidEnv);
    expect(config.port).toBe(5000);
    expect(config.nodeEnv).toBe('test');
    expect(config.mongodbUri).toBe('mongodb://localhost:27017/test_db');
    expect(config.jwt.secret).toBe('super_secure_jwt_secret_key_32_characters_long');
    expect(config.jwt.refreshSecret).toBe('super_secure_refresh_secret_key_32_characters_long');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('should throw ConfigValidationError when JWT_SECRET is missing', () => {
    const invalidEnv = { ...baseValidEnv, JWT_SECRET: '' };
    expect(() => validateConfig(invalidEnv)).toThrow(ConfigValidationError);
    try {
      validateConfig(invalidEnv);
    } catch (err: any) {
      expect(err.missingOrInvalid).toContain('JWT_SECRET is required.');
    }
  });

  it('should reject known insecure or placeholder JWT secrets', () => {
    const insecureEnv = {
      ...baseValidEnv,
      JWT_SECRET: 'fallback_secret_key_change_me',
    };
    expect(() => validateConfig(insecureEnv)).toThrow(ConfigValidationError);
    try {
      validateConfig(insecureEnv);
    } catch (err: any) {
      expect(err.missingOrInvalid.some((msg: string) => msg.includes('insecure or placeholder'))).toBe(true);
    }
  });

  it('should reject JWT secrets with insufficient entropy (< 16 characters)', () => {
    const weakEnv = {
      ...baseValidEnv,
      JWT_SECRET: 'short_key',
    };
    expect(() => validateConfig(weakEnv)).toThrow(ConfigValidationError);
    try {
      validateConfig(weakEnv);
    } catch (err: any) {
      expect(err.missingOrInvalid.some((msg: string) => msg.includes('at least 16 characters'))).toBe(true);
    }
  });

  it('should throw ConfigValidationError when MONGODB_URI is missing', () => {
    const invalidEnv = { ...baseValidEnv, MONGODB_URI: '' };
    expect(() => validateConfig(invalidEnv)).toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError when PORT is invalid', () => {
    const invalidEnv = { ...baseValidEnv, PORT: 'not-a-number' };
    expect(() => validateConfig(invalidEnv)).toThrow(ConfigValidationError);
  });

  it('should allow startup without GEMINI_API_KEY but disable AI functionality gracefully', () => {
    const envWithoutGemini = { ...baseValidEnv, GEMINI_API_KEY: '' };
    const config = validateConfig(envWithoutGemini);
    expect(config.ai.enabled).toBe(false);
    expect(config.ai.geminiApiKey).toBeUndefined();
  });

  it('should enable AI functionality when a valid GEMINI_API_KEY is provided', () => {
    const envWithGemini = {
      ...baseValidEnv,
      GEMINI_API_KEY: 'AIzaSyActualValidKeyFromConsole123456789',
    };
    const config = validateConfig(envWithGemini);
    expect(config.ai.enabled).toBe(true);
    expect(config.ai.geminiApiKey).toBe('AIzaSyActualValidKeyFromConsole123456789');
  });

  it('should fall back refreshSecret to jwtSecret with no validation error when not specified', () => {
    const envWithoutRefresh = { ...baseValidEnv };
    delete envWithoutRefresh.REFRESH_SECRET;
    const config = validateConfig(envWithoutRefresh);
    expect(config.jwt.refreshSecret).toBe(config.jwt.secret);
  });
});
