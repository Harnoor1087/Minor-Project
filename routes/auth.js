const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { users, otps, companies } = require('../db/store');
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

// Register: Validates input, sends OTP verification code
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, company, companyId } = req.body;

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

    const normalizedEmail = email.toLowerCase().trim();
    const existing = users.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Hash password beforehand to safely store in pending state
    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateOtpCode();

    await otps.create({
      email: normalizedEmail,
      code,
      purpose: 'registration',
      metadata: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role || 'applicant',
        company: company || '',
        companyId: companyId || ''
      },
      expiresInMinutes: 10
    });

    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      name: name.trim(),
      code,
      purpose: 'registration'
    });

    const isTestInbox = emailResult.deliveredToTestRecipient;
    const cooldownInfo = otps.getCooldownInfo({ email: normalizedEmail, purpose: 'registration' });
    const responsePayload = {
      requiresOtp: true,
      email: normalizedEmail,
      purpose: 'registration',
      message: isTestInbox
        ? `Verification code dispatched to your verified test inbox (${emailResult.recipient}).`
        : `A 6-digit verification code has been sent to ${normalizedEmail}.`,
      cooldownSeconds: cooldownInfo.cooldownPeriod || 30,
      resendCount: cooldownInfo.resendCount || 0,
      maxResends: cooldownInfo.maxResends || 5,
      expiresInMinutes: 10
    };

    // If delivered to sandbox test recipient or SMTP is offline, provide devCode for testing convenience
    if (!emailResult.delivered || isTestInbox) {
      responsePayload.devCode = code;
      responsePayload.notice = isTestInbox
        ? `Resend sandbox active: Email delivered to verified inbox ${emailResult.recipient}.`
        : 'SMTP offline or simulated. Verification code provided for testing.';
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify Registration OTP & Complete Account Creation
router.post('/register/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const verification = await otps.verify({
      email,
      code,
      purpose: 'registration'
    });

    if (!verification.valid) {
      return res.status(400).json({ message: verification.error });
    }

    const { name, email: userEmail, passwordHash, role, company, companyId } = verification.metadata;

    // Double check user doesn't already exist
    const existing = users.findByEmail(userEmail);
    if (existing) {
      return res.status(400).json({ message: 'User account was already registered.' });
    }

    // Create the persistent user record
    const newUser = await users.create({
      name,
      email: userEmail,
      passwordHash,
      role,
      company,
      companyId
    });

    const comp = newUser.companyId ? companies.getById(newUser.companyId) : null;

    const token = jwt.sign(
      {
        id: newUser._id,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        companyId: newUser.companyId || '',
        companySlug: comp?.slug || ''
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Email verified and account registered successfully',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company,
        companyId: newUser.companyId || '',
        companySlug: comp?.slug || '',
        companyLogo: comp?.logo || '🏢'
      }
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login: Step 1 - Check credentials & send Two-Factor OTP
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = users.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await users.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate login OTP
    const code = generateOtpCode();

    await otps.create({
      email: normalizedEmail,
      code,
      purpose: 'login',
      metadata: {
        userId: user._id
      },
      expiresInMinutes: 10
    });

    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      name: user.name,
      code,
      purpose: 'login'
    });

    const isTestInbox = emailResult.deliveredToTestRecipient;
    const cooldownInfo = otps.getCooldownInfo({ email: normalizedEmail, purpose: 'login' });
    const responsePayload = {
      requiresOtp: true,
      email: normalizedEmail,
      purpose: 'login',
      message: isTestInbox
        ? `Two-factor code dispatched to your verified test inbox (${emailResult.recipient}).`
        : `A two-factor authentication code has been sent to ${normalizedEmail}.`,
      cooldownSeconds: cooldownInfo.cooldownPeriod || 30,
      resendCount: cooldownInfo.resendCount || 0,
      maxResends: cooldownInfo.maxResends || 5,
      expiresInMinutes: 10
    };

    if (!emailResult.delivered || isTestInbox) {
      responsePayload.devCode = code;
      responsePayload.notice = isTestInbox
        ? `Resend sandbox active: Email delivered to verified inbox ${emailResult.recipient}.`
        : 'SMTP offline or simulated. Verification code provided for testing.';
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify Login OTP & Issue JWT Session Token
router.post('/login/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const verification = await otps.verify({
      email,
      code,
      purpose: 'login'
    });

    if (!verification.valid) {
      return res.status(400).json({ message: verification.error });
    }

    const user = users.findById(verification.metadata.userId) || users.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const comp = user.companyId ? companies.getById(user.companyId) : null;

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        companyId: user.companyId || '',
        companySlug: comp?.slug || ''
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Two-factor verification successful. Logged in.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        companyId: user.companyId || '',
        companySlug: comp?.slug || '',
        companyLogo: comp?.logo || '🏢'
      }
    });
  } catch (error) {
    console.error('Verify login OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Resend OTP code for either registration or login
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res.status(400).json({ message: 'Email and purpose are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!['registration', 'login'].includes(purpose)) {
      return res.status(400).json({ message: 'Invalid OTP purpose specified' });
    }

    // Enforce cooldown and anti-spam limits
    const cooldownInfo = otps.getCooldownInfo({ email: normalizedEmail, purpose });
    if (cooldownInfo.maxReached) {
      return res.status(429).json({
        message: 'Maximum resend limit reached to prevent email spam. Please wait 10 minutes before requesting a new code.',
        cooldownSeconds: cooldownInfo.remainingSeconds,
        maxReached: true,
        resendCount: cooldownInfo.resendCount,
        maxResends: cooldownInfo.maxResends
      });
    }

    if (cooldownInfo.remainingSeconds > 0) {
      return res.status(429).json({
        message: `Please wait ${cooldownInfo.remainingSeconds} seconds before requesting another code to prevent email spamming.`,
        cooldownSeconds: cooldownInfo.remainingSeconds,
        resendCount: cooldownInfo.resendCount,
        maxResends: cooldownInfo.maxResends
      });
    }

    // Retrieve active OTP record to retain registration metadata
    const active = otps.getActive({ email: normalizedEmail, purpose });
    if (!active && purpose === 'registration') {
      return res.status(400).json({ message: 'No pending registration found for this email. Please register again.' });
    }

    const metadata = active?.metadata || {};
    let userName = metadata.name || '';
    if (purpose === 'login') {
      const user = users.findByEmail(normalizedEmail);
      if (!user) return res.status(404).json({ message: 'User account not found.' });
      userName = user.name;
    }

    const code = generateOtpCode();
    await otps.recordResend({
      email: normalizedEmail,
      purpose,
      code,
      expiresInMinutes: 10
    });

    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      name: userName,
      code,
      purpose
    });

    // Check newly updated cooldown info for next allowable resend
    const nextCooldownInfo = otps.getCooldownInfo({ email: normalizedEmail, purpose });

    const isTestInbox = emailResult.deliveredToTestRecipient;
    const responsePayload = {
      success: true,
      message: isTestInbox
        ? `A fresh verification code has been dispatched to your verified inbox (${emailResult.recipient}).`
        : `A fresh verification code has been dispatched to ${normalizedEmail}.`,
      cooldownSeconds: nextCooldownInfo.cooldownPeriod || 30,
      resendCount: nextCooldownInfo.resendCount,
      maxResends: nextCooldownInfo.maxResends,
      expiresInMinutes: 10
    };

    if (!emailResult.delivered || isTestInbox) {
      responsePayload.devCode = code;
      responsePayload.notice = isTestInbox
        ? `Resend sandbox active: Email delivered to verified inbox ${emailResult.recipient}.`
        : 'SMTP offline or simulated. Verification code provided for development.';
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', verifyToken, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  const comp = user.companyId ? companies.getById(user.companyId) : null;
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    company: user.company,
    companyId: user.companyId || '',
    companySlug: comp?.slug || '',
    companyLogo: comp?.logo || '🏢',
    tenant: comp || null,
    isSuperAdmin: user.role === 'super_admin'
  });
});

// Quick Demo Login endpoint for interactive persona switching and 1-click portal access
router.post('/demo-login', async (req, res) => {
  try {
    const { persona = 'recruiter', companyId } = req.body;
    let targetEmail = 'admin@company.com';

    if (persona === 'candidate' || persona === 'applicant') {
      targetEmail = 'alex.morgan@example.com';
    } else if (persona === 'recruiter' || persona === 'admin') {
      targetEmail = 'admin@company.com';
    }

    let user = users.findByEmail(targetEmail);
    if (!user) {
      if (persona === 'candidate' || persona === 'applicant') {
        user = await users.create({
          name: 'Alex Morgan',
          email: 'alex.morgan@example.com',
          passwordHash: await bcrypt.hash('alex123', 10),
          role: 'applicant',
          company: '',
          companyId: ''
        });
      } else {
        user = await users.create({
          name: 'Sarah Jenkins',
          email: 'admin@company.com',
          passwordHash: await bcrypt.hash('admin123', 10),
          role: 'admin',
          company: 'AIRIS Talent Global',
          companyId: 'comp_airis'
        });
      }
    }

    let comp = user.companyId ? companies.getById(user.companyId) : null;
    if (companyId && user.role === 'admin') {
      const specifiedComp = companies.getById(companyId);
      if (specifiedComp) comp = specifiedComp;
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
        companyId: comp?.id || user.companyId || '',
        companySlug: comp?.slug || ''
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: `Demo authentication successful as ${user.name} (${user.role})`,
      token,
      targetUrl: user.role === 'admin' ? '/admin' : '/applicant',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: comp?.name || user.company,
        companyId: comp?.id || user.companyId || '',
        companySlug: comp?.slug || '',
        companyLogo: comp?.logo || '🏢'
      }
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.verifyToken = verifyToken;
module.exports = router;
