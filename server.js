const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/decisions', require('./routes/decisions'));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AI Resume Intelligence System' });
});

// HTML Page Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

app.get('/applicant', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'applicant.html'));
});

app.get('/apply.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'apply.html'));
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
