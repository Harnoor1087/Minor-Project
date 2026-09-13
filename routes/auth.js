const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { users, otps, companies, refreshTokens, auditLogs } = require('../db/store');
const { generateOtpCode, sendOtpEmail, isSmtpConfigured } = require('../services/emailService');
const mfaService = require('../services/mfaService');

const JWT_SECRET = process.env.JWT_SECRET || 'airis_secret_jwt_key_2026';

// Helper to issue short-lived access token + rotating refresh token + HttpOnly cookies
function issueTokens(user, comp, req, res) {
  const payload = {
    id: user._id,
    role: user.role,
    name: user.name,
    email: user.email,
    companyId: comp?.id || user.companyId || '',
    companySlug: comp?.slug || ''
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  refreshTokens.create({
    userId: user._id,
    token: refreshTokenString,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ip,
    userAgent
  });

  const isProd = process.env.NODE_ENV === 'production';

  // Set HttpOnly secure cookies
  res.cookie('airis_access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('airis_refresh_token', refreshTokenString, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return { accessToken, refreshToken: refreshTokenString };
}

// Verify token middleware (reads from HttpOnly cookie first, then Authorization Bearer header)
const verifyToken = (req, res, next) => {
  let token = req.cookies?.airis_access_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  }

  if (!token) {
    return res.status(401).json({ message: 'No session token provided in cookie or authorization header' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session token' });
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
    const { accessToken, refreshToken } = issueTokens(newUser, comp, req, res);

    auditLogs.record({
      actorId: newUser._id,
      actorEmail: newUser.email,
      actorRole: newUser.role,
      action: 'USER_REGISTER_SUCCESS',
      targetType: 'user',
      targetId: newUser._id,
      tenantId: newUser.companyId || '',
      ip: req.ip
    });

    res.status(201).json({
      message: 'Email verified and account registered successfully',
      token: accessToken,
      refreshToken,
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

// Login: Step 1 - Check credentials, check account lockout, support TOTP MFA, or dispatch Email 2FA OTP
router.post('/login', async (req, res) => {
  try {
    const { email, password, mfaCode, backupCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = users.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check account lockout status
    if (users.isLocked(user)) {
      const lockoutTime = new Date(user.lockoutUntil).toLocaleTimeString();
      auditLogs.record({
        actorEmail: normalizedEmail,
        action: 'LOGIN_BLOCKED_LOCKOUT',
        targetType: 'user',
        targetId: user._id,
        tenantId: user.companyId || '',
        ip: req.ip,
        details: { lockoutUntil: user.lockoutUntil }
      });
      return res.status(423).json({
        error: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to excessive failed attempts. Please try again after ${lockoutTime}.`
      });
    }

    // Validate password
    const isMatch = await users.verifyPassword(user, password);
    if (!isMatch) {
      users.recordFailedLogin(user);
      const remaining = 5 - (user.failedLoginAttempts || 0);

      auditLogs.record({
        actorEmail: normalizedEmail,
        action: 'LOGIN_FAILED_BAD_PASSWORD',
        targetType: 'user',
        targetId: user._id,
        tenantId: user.companyId || '',
        ip: req.ip,
        details: { failedAttempts: user.failedLoginAttempts }
      });

      if (remaining <= 0) {
        return res.status(423).json({
          error: 'ACCOUNT_LOCKED',
          message: 'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
        });
      }

      return res.status(400).json({
        message: `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`
      });
    }

    // Reset failed logins counter on valid password
    users.resetFailedLogins(user);

    // If User has TOTP MFA Enabled, authenticate via Authenticator Code or Backup Code
    if (user.mfaEnabled && user.mfaSecret) {
      if (!mfaCode && !backupCode) {
        return res.status(200).json({
          requiresMfa: true,
          email: normalizedEmail,
          message: 'Multi-factor authentication required. Please provide your 6-digit authenticator code or backup recovery code.'
        });
      }

      let mfaValid = false;
      let usedBackup = false;

      if (mfaCode) {
        mfaValid = mfaService.verifyTOTP(user.mfaSecret, mfaCode);
      } else if (backupCode) {
        mfaValid = users.consumeBackupCode(user, backupCode);
        usedBackup = true;
      }

      if (!mfaValid) {
        auditLogs.record({
          actorId: user._id,
          actorEmail: user.email,
          action: 'LOGIN_FAILED_MFA',
          tenantId: user.companyId || '',
          ip: req.ip
        });
        return res.status(400).json({
          error: 'MFA_FAILED',
          message: 'Invalid authenticator code or backup recovery code.'
        });
      }

      const comp = user.companyId ? companies.getById(user.companyId) : null;
      const { accessToken, refreshToken } = issueTokens(user, comp, req, res);

      auditLogs.record({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: usedBackup ? 'LOGIN_SUCCESS_MFA_BACKUP' : 'LOGIN_SUCCESS_MFA_TOTP',
        tenantId: user.companyId || '',
        ip: req.ip
      });

      return res.json({
        message: 'Two-factor authenticator verification successful. Logged in.',
        token: accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
          companyId: user.companyId || '',
          companySlug: comp?.slug || '',
          companyLogo: comp?.logo || '🏢',
          mfaEnabled: true
        }
      });
    }

    // Default 2FA via Email OTP
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

// Verify Login OTP & Issue JWT Session Token + HttpOnly Cookies
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
    const { accessToken, refreshToken } = issueTokens(user, comp, req, res);

    auditLogs.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS_EMAIL_OTP',
      tenantId: user.companyId || '',
      ip: req.ip
    });

    res.json({
      message: 'Two-factor verification successful. Logged in.',
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        companyId: user.companyId || '',
        companySlug: comp?.slug || '',
        companyLogo: comp?.logo || '🏢',
        mfaEnabled: !!user.mfaEnabled
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
    isSuperAdmin: user.role === 'super_admin',
    mfaEnabled: !!user.mfaEnabled
  });
});

// Refresh Access Token using secure HttpOnly cookie or body token
router.post('/refresh', async (req, res) => {
  try {
    let token = req.cookies?.airis_refresh_token || req.body?.refreshToken;

    if (!token) {
      return res.status(401).json({
        error: 'REFRESH_TOKEN_REQUIRED',
        message: 'No refresh token provided.'
      });
    }

    const record = refreshTokens.find(token);
    if (!record || new Date(record.expiresAt) < new Date()) {
      res.clearCookie('airis_access_token');
      res.clearCookie('airis_refresh_token');
      return res.status(401).json({
        error: 'REFRESH_TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.'
      });
    }

    // Revoke old refresh token (Strict Token Rotation)
    refreshTokens.revoke(token);

    const user = users.findById(record.userId);
    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }

    const comp = user.companyId ? companies.getById(user.companyId) : null;
    const { accessToken, refreshToken } = issueTokens(user, comp, req, res);

    auditLogs.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'TOKEN_REFRESH_SUCCESS',
      tenantId: user.companyId || '',
      ip: req.ip
    });

    res.json({
      message: 'Token refreshed successfully.',
      token: accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Secure Logout - Invalidate Refresh Token & Clear Cookies
router.post('/logout', verifyToken, (req, res) => {
  try {
    const token = req.cookies?.airis_refresh_token || req.body?.refreshToken;
    if (token) {
      refreshTokens.revoke(token);
    }
    if (req.user?.id) {
      refreshTokens.revokeAllForUser(req.user.id);
    }

    res.clearCookie('airis_access_token');
    res.clearCookie('airis_refresh_token');

    auditLogs.record({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action: 'USER_LOGOUT',
      tenantId: req.user?.companyId || '',
      ip: req.ip
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Logout error', error: error.message });
  }
});

// MFA: Check user MFA status
router.get('/mfa/status', verifyToken, (req, res) => {
  const user = users.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({
    mfaEnabled: !!user.mfaEnabled,
    backupCodesRemaining: Array.isArray(user.mfaBackupCodes) ? user.mfaBackupCodes.length : 0
  });
});

// MFA: Initiate TOTP MFA Setup (Generate secret, OTPAuth URI, backup codes)
router.post('/mfa/setup', verifyToken, (req, res) => {
  try {
    const user = users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const secret = mfaService.generateSecret();
    const uri = mfaService.generateTOTPUri(secret, user.email, 'AIRIS Enterprise');
    const backupCodes = mfaService.generateBackupCodes(8);

    // Save pending setup on user
    user._pendingMfaSecret = secret;
    user._pendingBackupCodes = backupCodes;

    res.json({
      secret,
      otpauthUri: uri,
      backupCodes,
      message: 'Scan the QR code in Google Authenticator or enter the secret key manually, then submit a 6-digit code to finalize setup.'
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ message: 'MFA setup error', error: error.message });
  }
});

// MFA: Confirm and Enable TOTP Setup
router.post('/mfa/verify-setup', verifyToken, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: '6-digit verification token from authenticator app is required.' });
    }

    const user = users.findById(req.user.id);
    if (!user || !user._pendingMfaSecret) {
      return res.status(400).json({ message: 'No pending MFA setup found. Please initiate setup first.' });
    }

    const isValid = mfaService.verifyTOTP(user._pendingMfaSecret, token);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid 6-digit verification code. Ensure your device time is synchronized.' });
    }

    // Activate MFA
    users.updateMfa(user._id, {
      enabled: true,
      secret: user._pendingMfaSecret,
      backupCodes: user._pendingBackupCodes || []
    });

    delete user._pendingMfaSecret;
    delete user._pendingBackupCodes;

    auditLogs.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'MFA_ENABLED_TOTP',
      tenantId: user.companyId || '',
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Two-Factor Authenticator successfully enabled on your account!'
    });
  } catch (error) {
    console.error('MFA verify setup error:', error);
    res.status(500).json({ message: 'MFA verification error', error: error.message });
  }
});

// MFA: Disable TOTP (Requires current password confirmation)
router.post('/mfa/disable', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required to disable MFA.' });
    }

    const user = users.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await users.verifyPassword(user, password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password. MFA remains enabled.' });
    }

    users.updateMfa(user._id, {
      enabled: false,
      secret: null,
      backupCodes: []
    });

    auditLogs.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'MFA_DISABLED',
      tenantId: user.companyId || '',
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Multi-factor authentication has been disabled.'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ message: 'MFA disable error', error: error.message });
  }
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

    const { accessToken, refreshToken } = issueTokens(user, comp, req, res);

    auditLogs.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'DEMO_LOGIN_SUCCESS',
      tenantId: comp?.id || user.companyId || '',
      ip: req.ip,
      details: { persona }
    });

    res.json({
      message: `Demo authentication successful as ${user.name} (${user.role})`,
      token: accessToken,
      refreshToken,
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
