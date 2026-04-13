/**
 * Security middleware bundle.
 * Wires up helmet, CORS, rate limiting, request IDs, and trust-proxy.
 */
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const cors        = require('cors');
const { randomUUID } = require('crypto');

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow localhost in development; read allowed origins from env in production.
function buildCors() {
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [];

  const devOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = envOrigins.length ? envOrigins : devOrigins;

  return cors({
    origin: allowedOrigins,
    credentials: true,          // needed for cookie-based auth
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Tight limit on auth endpoints; looser general limit to block abusive clients.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,                   // 30 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 300,                  // 300 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' },
});

// Tighter limit for file upload endpoints — 10 upload+commit cycles per minute
// is generous for manual admin use. Applied only to the /upload endpoint.
const importUploadLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many import requests — please wait a moment and try again' },
});

// ── Request ID ────────────────────────────────────────────────────────────────
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// ── Helmet (API-safe settings) ────────────────────────────────────────────────
// contentSecurityPolicy is disabled here because the SPA sets its own CSP via
// the Vite dev server / static file server, not the API.
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
});

module.exports = { buildCors, authLimiter, apiLimiter, importUploadLimiter, requestId, helmetMiddleware };
