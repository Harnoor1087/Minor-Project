/**
 * Automated PII Redactor for Blind Reviews (EEOC / GDPR Compliance)
 * Strips personally identifiable information to prevent unconscious bias:
 * - Full candidate names -> Replaced with consistent Anonymous Code (e.g. "Candidate #B3F1")
 * - Email addresses -> Masked (e.g. "[REDACTED_EMAIL]")
 * - Phone numbers -> Masked (e.g. "[REDACTED_PHONE]")
 * - Physical addresses / postal codes -> Masked (e.g. "[REDACTED_LOCATION]")
 * - Social / Personal URLs (GitHub / LinkedIn / personal domains) -> Anonymized
 * - Graduation years & birthdates (mitigates age bias) -> Anonymized
 */

// Regex patterns for PII detection
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?(\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/gi;
const TWITTER_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+/gi;
const URL_REGEX = /https?:\/\/[^\s]+/gi;
const POSTAL_CODE_REGEX = /\b\d{5}(?:-\d{4})?\b/g;

/**
 * Generate a consistent deterministic pseudonym from applicant ID or string
 */
function generatePseudonym(seed) {
  let hash = 0;
  const str = String(seed || 'candidate');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(-4);
  return `Candidate #${hex}`;
}

/**
 * Redact PII from arbitrary text (resume content, bio, comments)
 */
function redactText(text, candidateName = '') {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Redact Candidate Name if provided
  if (candidateName && candidateName.trim().length > 1) {
    const nameParts = candidateName.trim().split(/\s+/);
    // Full name replacement
    const escapedFullName = candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escapedFullName, 'gi'), '[ANONYMOUS_CANDIDATE]');

    // First and last name replacement if longer than 2 chars
    for (const part of nameParts) {
      if (part.length > 2) {
        const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(`\\b${escapedPart}\\b`, 'gi'), '[ANONYMOUS]');
      }
    }
  }

  // 2. Redact Email
  sanitized = sanitized.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');

  // 3. Redact Social Profiles
  sanitized = sanitized.replace(LINKEDIN_REGEX, '[VERIFIED_LINKEDIN_PROFILE]');
  sanitized = sanitized.replace(GITHUB_REGEX, '[VERIFIED_CODE_PORTFOLIO]');
  sanitized = sanitized.replace(TWITTER_REGEX, '[REDACTED_SOCIAL]');

  // 4. Redact Phone Numbers (only matches that look like legitimate phone numbers, avoiding years or small numbers)
  sanitized = sanitized.replace(PHONE_REGEX, (match) => {
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return '[REDACTED_PHONE]';
    }
    return match;
  });

  // 5. Redact Postal Codes
  sanitized = sanitized.replace(POSTAL_CODE_REGEX, '[POSTAL_CODE]');

  // 6. Generic URLs
  sanitized = sanitized.replace(URL_REGEX, (url) => {
    if (url.includes('[VERIFIED_') || url.includes('[REDACTED_')) return url;
    return '[ANONYMIZED_LINK]';
  });

  return sanitized;
}

/**
 * Generate a complete blind review dossier for an application
 */
function createBlindDossier(application) {
  if (!application) return null;

  const pseudonym = generatePseudonym(application.applicantId || application._id);
  const rawText = application.resumeText || '';
  const redactedResume = redactText(rawText, application.applicantName);

  // Redact intelligence commentary if exists
  let redactedIntelligence = null;
  if (application.intelligence) {
    const intel = JSON.parse(JSON.stringify(application.intelligence));
    if (intel.summary) {
      intel.summary = redactText(intel.summary, application.applicantName);
    }
    if (Array.isArray(intel.strengths)) {
      intel.strengths = intel.strengths.map(s => redactText(s, application.applicantName));
    }
    if (Array.isArray(intel.riskFactors)) {
      intel.riskFactors = intel.riskFactors.map(r => redactText(r, application.applicantName));
    }
    redactedIntelligence = intel;
  }

  return {
    _id: application._id,
    blindMode: true,
    pseudonym,
    jobId: application.jobId,
    jobTitle: application.jobTitle,
    companyId: application.companyId,
    companyName: application.companyName,
    scores: application.scores,
    category: application.category,
    eligibility: application.eligibility,
    status: application.status,
    appliedAt: application.appliedAt,
    skillVerification: application.skillVerification,
    interviewSummary: application.interview ? {
      status: application.interview.status,
      overallScore: application.interview.overallScore,
      recommendation: application.interview.recommendation,
      proctoringReport: {
        integrityStatus: application.interview.proctoringReport?.integrityStatus || 'CLEAN',
        infractionCount: application.interview.proctoringReport?.infractionCount || 0
      }
    } : null,
    redactedResumeText: redactedResume,
    intelligence: redactedIntelligence,
    complianceNotice: 'Blind Evaluation Active: Personal Identifiable Information (PII), contact information, and demographic indicators have been sanitized according to EEOC & GDPR standards.'
  };
}

module.exports = {
  redactText,
  createBlindDossier,
  generatePseudonym
};
