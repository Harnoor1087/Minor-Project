const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { users, otps } = require('../db/store');
const { generateOtpCode, sendOtpEmail, isSmtpConfigured } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'airis_secret_jwt_key_2026';

// Verify token middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Robust password validation helper enforcing length, numeric, special characters, and casing
const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireNumber: /[0-9]/,
  requireSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/,
  requireLower: /[a-z]/,
  requireUpper: /[A-Z]/
};

function validatePasswordPolicy(password) {
  if (typeof password !== 'string') {
    return 'Password must be provided as text.';
  }
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long.`;
  }
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    return `Password cannot exceed ${PASSWORD_REQUIREMENTS.maxLength} characters.`;
  }
  if (!PASSWORD_REQUIREMENTS.requireNumber.test(password)) {
    return 'Password must contain at least one numeric digit (0-9).';
  }
  if (!PASSWORD_REQUIREMENTS.requireSpecial.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%^&*).';
  }
  if (!PASSWORD_REQUIREMENTS.requireLower.test(password) || !PASSWORD_REQUIREMENTS.requireUpper.test(password)) {
    return 'Password must contain both uppercase (A-Z) and lowercase (a-z) letters.';
  }
  return null;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, company } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Enforce password security policy
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({
        message: passwordError,
        requirement: 'Password must be 8+ chars with at least 1 number, 1 special character, and uppercase/lowercase letters.'
      });
    }

    const existing = users.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const newUser = await users.create({
      name,
      email,
      password,
      role: role || 'applicant',
      company: company || ''
    });

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role, name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = users.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await users.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', verifyToken, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company
  });
});

router.verifyToken = verifyToken;
module.exports = router;
