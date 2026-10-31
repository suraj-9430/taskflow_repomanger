import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

/**
 * Attaches a correlation ID to every incoming request.
 * If X-Request-Id or X-Correlation-Id header is present and valid, it is reused.
 * Otherwise, a fresh RFC 4122 UUID is generated.
 * The ID is always reflected in the response header X-Request-Id.
 */
export const correlationIdMiddleware = (
  req: CorrelatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const incomingId = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string | undefined;

  // Validate incoming ID: alphanumeric, hyphen, underscore, 8-64 chars
  const isValid = incomingId && /^[a-zA-Z0-9\-_]{8,64}$/.test(incomingId);
  const correlationId = isValid ? incomingId : crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);

  next();
};
