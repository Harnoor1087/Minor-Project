const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { sanitizeInputMiddleware } = require('./middleware/sanitizeInput');
const { buildReact } = require('./build');
require('dotenv').config();

// Ensure React bundle is built on startup
buildReact().catch(err => console.warn('[Server] Initial React build warning:', err.message));

const app = express();
const PORT = 3000;

// Security Headers with Helmet (Customized for AI Studio iframe & Tailwind CDN compatibility)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://cdn.tailwindcss.com',
          'https://cdnjs.cloudflare.com',
          'https://unpkg.com'
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com'
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        frameAncestors: ['*'] // Essential for AI Studio iframe live preview
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
  })
);

// Rate Limiting to prevent brute-force & denial of service
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this client. Please slow down and try again after 15 minutes.'
  }
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.'
  }
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Anti-XSS & Prototype Pollution Recursive Input Sanitizer
app.use(sanitizeInputMiddleware);

// Apply rate limits
app.use('/api/', globalApiLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Serve static assets from public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/skill-verification', require('./routes/skillVerification'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/decisions', require('./routes/decisions'));
app.use('/api/audit-logs', require('./routes/audit'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AI Resume Intelligence System' });
});

// HTML Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/recruiter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recruiter.html'));
});

app.get('/recruiter.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recruiter.html'));
});

app.get('/students', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'students.html'));
});

app.get('/students.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'students.html'));
});

app.get('/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'students.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin-react', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-react.html'));
});

app.get('/applicant-react', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-react.html'));
});

app.get('/interview-react', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-react.html'));
});

app.get('/apply-react', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-react.html'));
});

app.get('/react', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-react.html'));
});

app.get('/applicant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'applicant.html'));
});

app.get('/apply.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
});

app.get('/skill-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'skill-test.html'));
});

app.get('/skill-test/:appId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'skill-test.html'));
});

app.get('/interview', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'interview.html'));
});

app.get('/interview/:appId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'interview.html'));
});

app.get('/company/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'company.html'));
});

app.get('/companies', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'company.html'));
});

// SPA fallback for client navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[AIRIS] Server running on http://0.0.0.0:${PORT}`);
});
