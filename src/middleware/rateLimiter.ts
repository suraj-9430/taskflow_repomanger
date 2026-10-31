import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again after 5 seconds' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 AI requests per minute (PDF Section 13)
  message: { success: false, message: 'Too many AI requests. Please slow down and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});
