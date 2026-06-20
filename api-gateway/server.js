// api-gateway/server.js
// Single entry point for all clients. Responsibilities (all live HERE, not in services):
//   - JWT verification
//   - Role-based authorization (RBAC)
//   - Rate limiting
//   - Round-robin load balancing (menu-service)
//   - Proxying with http-proxy, forwarding x-user-id / x-user-role downstream
require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');

const { authenticate, requireRole } = require('./middleware/auth');
const { globalLimiter, loginLimiter } = require('./middleware/rateLimit');
const { pickMenuTarget } = require('./proxy/loadBalancer');

const app = express();

// One single http-proxy server instance for the whole gateway.
const proxy = httpProxy.createProxyServer({ proxyTimeout: 30000 });

// Downstream service URLs (menu handled by the round-robin load balancer).
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3003';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

// Forward the decoded identity downstream. Services TRUST these headers.
proxy.on('proxyReq', (proxyReq, req) => {
  if (req.user) {
    proxyReq.setHeader('x-user-id', String(req.user.userId));
    proxyReq.setHeader('x-user-role', String(req.user.role));
  }
});

// Never leak an unhandled proxy error.
proxy.on('error', (err, req, res) => {
  console.error('[GATEWAY] Proxy error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
  }
  if (res) res.end(JSON.stringify({ error: 'Bad gateway', detail: err.message }));
});

// Helper: choose target service from the first path segment (prefix already stripped).
function resolveTarget(req, res, prefixLabel) {
  const segment = (req.url.split('/')[1] || '').split('?')[0];

  if (segment === 'menu' || segment === 'cart') {
    const target = pickMenuTarget();
    console.log(`[GATEWAY][LB] ${prefixLabel} /${segment}${req.url} -> ${target}`);
    return target;
  }
  if (segment === 'order') {
    console.log(`[GATEWAY] ${prefixLabel} ${req.url} -> ${ORDER_URL}`);
    return ORDER_URL;
  }
  if (segment === 'payment') {
    console.log(`[GATEWAY] ${prefixLabel} ${req.url} -> ${PAYMENT_URL}`);
    return PAYMENT_URL;
  }
  res.status(404).json({ error: `Unknown ${prefixLabel} route` });
  return null;
}

// Gateway's own health endpoint (no auth).
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));

// Global rate limiter applies to everything.
app.use(globalLimiter);

// ---- PUBLIC: /auth/* -> auth-service (no token) ----
// Inside this mount, req.url is already stripped to /reg or /login.
app.use(
  '/auth',
  (req, res, next) => {
    // Stricter limiter only on login to throttle brute force.
    if (req.url === '/login' || req.url.startsWith('/login?')) {
      return loginLimiter(req, res, next);
    }
    return next();
  },
  (req, res) => {
    console.log(`[GATEWAY] /auth${req.url} -> ${AUTH_URL}`);
    proxy.web(req, res, { target: AUTH_URL });
  }
);

// ---- ADMIN ONLY: /admin/* (valid JWT with role=admin, else 403) ----
app.use('/admin', authenticate, requireRole('admin'), (req, res) => {
  const target = resolveTarget(req, res, '/admin');
  if (target) proxy.web(req, res, { target });
});

// ---- CUSTOMER ONLY: /customer/* (valid JWT with role=customer, else 403) ----
app.use('/customer', authenticate, requireRole('customer'), (req, res) => {
  const target = resolveTarget(req, res, '/customer');
  if (target) proxy.web(req, res, { target });
});

// Fallback.
app.use((req, res) => res.status(404).json({ error: 'Route not found at gateway' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[api-gateway] listening on ${PORT}`);
});
