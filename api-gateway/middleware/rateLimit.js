// api-gateway/middleware/rateLimit.js
// Rate limiting lives ONLY in the gateway. Returns HTTP 429 when exceeded.
const rateLimit = require('express-rate-limit');

// Global limiter: 100 requests / 15 min per IP.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Stricter limiter for brute-force protection on login: 5 requests / 1 min per IP.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please slow down.' }
});

module.exports = { globalLimiter, loginLimiter };
