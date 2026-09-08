const crypto = require('crypto');

// Lazy-load nodemailer to avoid startup issues if optional
let nodemailerClient = null;

function getNodemailer() {
  if (!nodemailerClient) {
    try {
      nodemailerClient = require('nodemailer');
    } catch (e) {
      nodemailerClient = null;
    }
  }
  return nodemailerClient;
}

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function getTransporter() {
  const nodemailer = getNodemailer();
  if (!nodemailer || !isSmtpConfigured()) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || ''
    }
  });
}

/**
 * Generates a secure random 6-digit numeric OTP code string
 */
function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Sends an OTP email to the user
 * Falls back to console log and dev response when SMTP is not configured
 */
async function sendOtpEmail({ to, name, code, purpose }) {
  const isRegistration = purpose === 'registration';
  const subject = isRegistration
    ? `🔐 ${code} is your AIRIS verification code`
    : `🛡️ ${code} is your AIRIS two-factor login code`;

  const purposeText = isRegistration
    ? 'complete your account registration'
    : 'authenticate your login request';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
        .logo { font-size: 20px; font-weight: 800; color: #4f46e5; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
        .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }
        .desc { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #312e81; font-family: 'Courier New', Courier, monospace; }
        .notice { font-size: 13px; color: #64748b; line-height: 1.5; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">🤖 AIRIS Talent Intelligence</div>
        <h1 class="title">${isRegistration ? 'Verify Your Email' : 'Two-Factor Authentication'}</h1>
        <p class="desc">Hello${name ? ' ' + name : ''},<br>Please use the following single-use verification code to ${purposeText}:</p>
        <div class="otp-box">
          <div class="otp-code">${code}</div>
        </div>
        <p class="notice">
          ⏱️ This code is valid for <strong>10 minutes</strong>.<br>
          🔒 Never share this code with anyone. AIRIS staff will never ask for your verification code.
        </p>
        <div class="footer">
          AIRIS Autonomous Talent Intelligence & Proctoring Infrastructure &copy; 2026
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `AIRIS Verification Code: ${code}\n\nUse this code to ${purposeText}. It expires in 10 minutes.\nNever share this code with anyone.`;

  // Always log to console for auditing and development
  console.log('--------------------------------------------------');
  console.log(`📨 [AIRIS AUTH EMAIL DISPATCH]`);
  console.log(`To: ${to}`);
  console.log(`Purpose: ${purpose.toUpperCase()}`);
  console.log(`Verification Code: ${code}`);
  console.log(`Expires in: 10 minutes`);
  console.log('--------------------------------------------------');

  const transporter = getTransporter();
  let delivered = false;
  let deliveryError = null;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"AIRIS Auth" <no-reply@airis.ai>',
        to,
        subject,
        text: textContent,
        html: htmlContent
      });
      delivered = true;
      console.log(`✅ [AIRIS AUTH EMAIL] Successfully dispatched SMTP email to ${to}`);
    } catch (err) {
      console.error(`⚠️ [AIRIS AUTH EMAIL] SMTP delivery failed:`, err.message);
      deliveryError = err.message;
    }
  }

  return {
    success: true,
    delivered,
    isSmtpConfigured: isSmtpConfigured(),
    deliveryError
  };
}

module.exports = {
  generateOtpCode,
  sendOtpEmail,
  isSmtpConfigured
};
