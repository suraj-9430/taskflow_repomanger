import { Response, NextFunction } from 'express';
import { CorrelatedRequest } from './correlationId';

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Structured HTTP request logger middleware (Solutions Guide Section 16).
 * Produces machine-parseable log entries including correlation IDs and execution latency.
 */
export const requestLogger = (
  req: CorrelatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    // Suppress spammy health check polling logs in test/development
    if (req.originalUrl.startsWith('/health') && res.statusCode === 200) {
      return;
    }

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      correlationId: req.correlationId,
      ip: req.ip || (req.socket ? req.socket.remoteAddress : undefined),
      userAgent: req.headers['user-agent'],
    };

    if (process.env.NODE_ENV === 'test') {
      return; // Keep test runner output clean
    }

    const formatted = `[${logEntry.timestamp}] [${logEntry.level.toUpperCase()}] [REQ:${logEntry.correlationId || 'none'}] ${logEntry.method} ${logEntry.url} ${logEntry.statusCode} - ${logEntry.durationMs}ms`;

    if (logEntry.level === 'error') {
      console.error(formatted);
    } else if (logEntry.level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  });

  next();
};
