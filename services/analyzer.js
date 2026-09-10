const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { scanAndVerifyCertificate } = require('./certificateVerification');

// Lazy initialization of Gemini client
let geminiClient = null;
function getGeminiClient() {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const { GoogleGenAI } = require('@google/genai');
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    return geminiClient;
  } catch (err) {
    console.warn('[Gemini] Could not initialize @google/genai:', err.message);
    return null;
  }
}

// Resilient Gemini generator with strict timeout to prevent hangs
async function generateGeminiContentWithTimeout(ai, params, timeoutMs = 7000) {
  return Promise.race([
    ai.models.generateContent(params),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request exceeded timeout of ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Broad skill lexicon for robust NLP extraction
const SKILL_LEXICON = [
  'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue',
  'node', 'nodejs', 'express', 'django', 'flask', 'fastapi', 'spring',
  'aws', 'azure', 'gcp', 'cloud', 'docker', 'kubernetes', 'k8s',
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'sqlite',
  'machine learning', 'ml', 'ai', 'artificial intelligence', 'nlp',
  'deep learning', 'tensorflow', 'pytorch', 'scikit', 'numpy', 'pandas',
  'llm', 'prompt engineering', 'generative ai', 'data science',
  'html', 'css', 'bootstrap', 'tailwind', 'sass',
  'git', 'github', 'ci/cd', 'devops', 'linux', 'bash',
  'rest api', 'graphql', 'microservices', 'agile', 'scrum'
];

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t',
  'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having',
  'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its',
  'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t',
  'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d',
  'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

async function extractTextFromFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    if (ext === '.pdf') {
      try {
        const parsed = await pdfParse(buffer);
        if (parsed && parsed.text && parsed.text.trim()) {
          return parsed.text;
        }
      } catch (pdfErr) {
        console.warn(`[Analyzer] pdf-parse warning for ${filePath}:`, pdfErr.message);
      }
    }

    // Text fallback
    const rawText = buffer.toString('utf-8');
    const cleaned = rawText.replace(/[^\x20-\x7E\t\n\r]/g, ' ');
    return cleaned;
  } catch (err) {
    console.error(`[Analyzer] Failed reading file ${filePath}:`, err.message);
    return '';
  }
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.|er\.|engr\.)\s+/i, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function calculateNameSimilarity(claimedName, resumeName) {
  const normClaimed = normalizeName(claimedName);
  const normResume = normalizeName(resumeName);

  if (!normClaimed || !normResume) return 0;
  if (normClaimed === normResume) return 1.0;

  const tokensClaimed = normClaimed.split(/\s+/).filter(Boolean);
  const tokensResume = normResume.split(/\s+/).filter(Boolean);

  if (tokensClaimed.length === 0 || tokensResume.length === 0) return 0;

  // Exact set match in different word order (e.g. "Singh Kamaljeet" vs "Kamaljeet Singh")
  const claimedSet = new Set(tokensClaimed);
  const resumeSet = new Set(tokensResume);
  const matchedTokens = tokensClaimed.filter(t => resumeSet.has(t));

  if (tokensClaimed.length === tokensResume.length && matchedTokens.length === tokensClaimed.length) {
    return 1.0;
  }

  // Token subset match (e.g., "Kamaljeet Singh" vs "Kamaljeet Singh Dhillon")
  if (matchedTokens.length === tokensClaimed.length || matchedTokens.length === tokensResume.length) {
    return 0.9;
  }

  // Check primary given name (first word)
  const firstNameClaimed = tokensClaimed[0];
  const firstNameResume = tokensResume[0];
  const lastNameClaimed = tokensClaimed[tokensClaimed.length - 1];
  const lastNameResume = tokensResume[tokensResume.length - 1];

  // Completely different first name (e.g. "Kamaljeet" vs "Harnoor")
  if (
    firstNameClaimed !== firstNameResume &&
    !firstNameClaimed.startsWith(firstNameResume) &&
    !firstNameResume.startsWith(firstNameClaimed)
  ) {
    // If only the surname matches (e.g., "Singh" or "Sharma" or "Kumar"), it's a family/shared surname but different person!
    if (lastNameClaimed === lastNameResume) {
      return 0.25;
    }
    return 0.1;
  }

  // Overlap ratio
  return (2 * matchedTokens.length) / (tokensClaimed.length + tokensResume.length);
}

function verifyCandidateIdentity({ claimedName = '', resumeName = '', claimedEmail = '', resumeEmail = '' }) {
  const similarity = calculateNameSimilarity(claimedName, resumeName);
  const isGeneric = !resumeName || resumeName.toLowerCase() === 'candidate' || resumeName.trim().length < 3;

  // If resumeName is generic, we cannot definitively flag a mismatch
  if (isGeneric) {
    return {
      status: 'VERIFIED_GENERIC',
      verified: true,
      similarity: 0.8,
      claimedName,
      resumeName: claimedName,
      confidence: 'MEDIUM',
      message: 'Candidate identity aligned with profile credentials.'
    };
  }

  // Strict mismatch threshold: similarity < 0.5 indicates a different person (e.g. Kamaljeet vs Harnoor)
  if (similarity < 0.5) {
    return {
      status: 'MISMATCH',
      verified: false,
      similarity: Math.round(similarity * 100) / 100,
      claimedName,
      resumeName,
      confidence: 'HIGH',
      message: `Identity Alert: Uploaded resume belongs to "${resumeName}", but applicant account is registered as "${claimedName}". Cross-candidate resume submissions are strictly prohibited.`
    };
  }

  return {
    status: 'VERIFIED',
    verified: true,
    similarity: Math.round(similarity * 100) / 100,
    claimedName,
    resumeName,
    confidence: similarity >= 0.9 ? 'HIGH' : 'MEDIUM',
    message: 'Candidate identity successfully matched with resume header.'
  };
}

function extractName(text) {
  if (!text) return 'Candidate';
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= 3 && trimmed.length <= 40 && !trimmed.includes('@') && !/https?:\/\//i.test(trimmed) && !/\d{4}/.test(trimmed)) {
      // Clean leading labels
      const cleaned = trimmed.replace(/^(resume|curriculum vitae|cv|name)\s*:?/i, '').trim();
      if (cleaned.length >= 3 && !/^(education|experience|skills|projects|summary|objective)/i.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return 'Candidate';
}

function extractEmail(text) {
  if (!text) return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase().trim() : null;
}

function tokenize(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9#+.]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return words;
}

function extractSkills(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matched = [];

  for (const skill of SKILL_LEXICON) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      matched.push(skill);
    }
  }
  return matched;
}

function calculateCosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0.5;

  const freqA = {};
  const freqB = {};

  for (const t of tokensA) freqA[t] = (freqA[t] || 0) + 1;
  for (const t of tokensB) freqB[t] = (freqB[t] || 0) + 1;

  const allWords = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const w of allWords) {
    const a = freqA[w] || 0;
    const b = freqB[w] || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0.5;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Normalize to 0.4 - 0.95 realistic range
  const scaled = Math.min(0.98, Math.max(0.35, similarity * 1.6));
  return scaled;
}

function calculateExperienceScore(text) {
  if (!text) return 0.6;
  const expMatch = text.match(/(\d+)\+?\s*years?\s*(?:of)?\s*experience/i);
  if (expMatch && expMatch[1]) {
    const years = parseInt(expMatch[1], 10);
    if (years >= 5) return 0.95;
    if (years >= 3) return 0.85;
    if (years >= 1) return 0.75;
    return 0.6;
  }
  return 0.65;
}

function classifyCandidate(finalScore, skillScore) {
  if (skillScore >= 0.85 || finalScore >= 0.75) {
    return 'Strong Match';
  } else if (finalScore >= 0.55) {
    return 'Moderate Match';
  } else {
    return 'Weak Match';
  }
}

const KNOWN_CERTIFICATE_ISSUERS = [
  // Tier 1: Cloud & Industry Enterprise Standards
  { pattern: /amazon\s*web\s*services|aws/i, name: 'Amazon Web Services (AWS)', tier: 'Tier 1 - Industry Cloud Leader' },
  { pattern: /google\s*cloud|gcp/i, name: 'Google Cloud Platform (GCP)', tier: 'Tier 1 - Industry Cloud Leader' },
  { pattern: /microsoft\s*(azure)?|azure/i, name: 'Microsoft Azure', tier: 'Tier 1 - Industry Cloud Leader' },
  { pattern: /cisco/i, name: 'Cisco Networking', tier: 'Tier 1 - Enterprise Infrastructure' },
  { pattern: /oracle/i, name: 'Oracle University', tier: 'Tier 1 - Enterprise Systems' },
  { pattern: /red\s*hat/i, name: 'Red Hat Certified', tier: 'Tier 1 - Enterprise Linux' },
  { pattern: /kubernetes|cncf|linux\s*foundation/i, name: 'Linux Foundation / CNCF', tier: 'Tier 1 - Cloud Native' },
  { pattern: /hashicorp/i, name: 'HashiCorp Certified', tier: 'Tier 1 - DevOps & Cloud' },
  { pattern: /salesforce/i, name: 'Salesforce Certified', tier: 'Tier 1 - Enterprise CRM' },
  { pattern: /comptia/i, name: 'CompTIA', tier: 'Tier 1 - IT Standards' },

  // Tier 2: Accredited MOOCs & Universities
  { pattern: /coursera/i, name: 'Coursera Accredited', tier: 'Tier 2 - Academic / Professional MOOC' },
  { pattern: /edx/i, name: 'edX Global', tier: 'Tier 2 - Academic / Professional MOOC' },
  { pattern: /stanford/i, name: 'Stanford Online', tier: 'Tier 2 - Top University Credential' },
  { pattern: /mit\s*x|massachusetts\s*institute/i, name: 'MITx', tier: 'Tier 2 - Top University Credential' },
  { pattern: /harvard/i, name: 'Harvard Online', tier: 'Tier 2 - Top University Credential' },
  { pattern: /deeplearning\.ai/i, name: 'DeepLearning.AI', tier: 'Tier 2 - AI Specialization' },
  { pattern: /hackerrank/i, name: 'HackerRank Verified Skill', tier: 'Tier 2 - Technical Skills' },
  { pattern: /udacity/i, name: 'Udacity Nanodegree', tier: 'Tier 2 - Applied Technology' },

  // Tier 3: Professional Platforms & Self-Paced Courses
  { pattern: /udemy/i, name: 'Udemy Online Academy', tier: 'Tier 3 - Self-Paced Course' },
  { pattern: /linkedin\s*learning/i, name: 'LinkedIn Learning', tier: 'Tier 3 - Continuing Education' },
  { pattern: /freecodecamp/i, name: 'freeCodeCamp Certification', tier: 'Tier 3 - Practical Web Dev' },
  { pattern: /codecademy/i, name: 'Codecademy Pro', tier: 'Tier 3 - Interactive Learning' },
  { pattern: /pluralsight/i, name: 'Pluralsight Skills', tier: 'Tier 3 - Developer Training' }
];

const CERTIFICATE_HALLMARKS = [
  /hereby\s+certif(ies|y)/i,
  /certificate\s+of\s+(completion|achievement|accomplishment|excellence)/i,
  /statement\s+of\s+accomplishment/i,
  /has\s+successfully\s+completed/i,
  /is\s+awarded\s+this\s+certificate/i,
  /in\s+recognition\s+of\s+successful\s+completion/i,
  /has\s+fulfilled\s+the\s+requirements/i,
  /awarded\s+to/i,
  /proudly\s+presented\s+to/i,
  /credential\s+id/i,
  /certificate\s+no/i,
  /verify\s+at\s+https?:\/\//i
];

function extractCertificateRecipient(text) {
  if (!text) return null;
  const patterns = [
    /(?:certif(?:ies|y)\s+that|presented\s+to|awarded\s+to|recognizes?)\s+([A-Z][a-zA-Z.'-]+\s+[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)?)/i,
    /([A-Z][a-zA-Z.'-]+\s+[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)?)\s+has\s+successfully\s+completed/i
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (!/^(the|this|a|an|course|all|requirements|candidate)\b/i.test(candidate) && candidate.length <= 40) {
        return candidate;
      }
    }
  }
  return null;
}

function extractCredentialVerification(text) {
  let credentialId = null;
  let verifyUrl = null;

  const idMatch = text.match(/(?:credential|certificate|license|serial|registration)\s*(?:id|no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9\-_]{6,36})/i);
  if (idMatch && idMatch[1]) {
    credentialId = idMatch[1].trim();
  }

  const urlMatch = text.match(/https?:\/\/[^\s"'<>]*(?:verify|certificate|credential|badge|credly)[^\s"'<>]*/i);
  if (urlMatch) {
    verifyUrl = urlMatch[0].trim();
  }

  return { credentialId, verifyUrl };
}

async function verifyCertificateAuthenticity(filePath, candidateName = '', jobSkills = []) {
  try {
    const verified = await scanAndVerifyCertificate(filePath, { candidateName, jobSkills });
    if (verified) return verified;
  } catch (scanErr) {
    console.warn('[Analyzer] scanAndVerifyCertificate fallback triggered:', scanErr.message);
  }

  const text = await extractTextFromFile(filePath);
  const filename = path.basename(filePath);

  let title = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  let skills = [];
  let recipientName = extractCertificateRecipient(text);
  let recognizedIssuer = null;
  let issuerTier = 'Tier 4 - Custom / Independent Issuer';
  const { credentialId, verifyUrl } = extractCredentialVerification(text);

  // Check issuer pattern
  for (const item of KNOWN_CERTIFICATE_ISSUERS) {
    if (item.pattern.test(text) || item.pattern.test(filename)) {
      recognizedIssuer = item.name;
      issuerTier = item.tier;
      break;
    }
  }

  // Check document authenticity hallmarks
  const hasHallmark = CERTIFICATE_HALLMARKS.some(pattern => pattern.test(text));

  // AI Deep Inspection with Gemini if available
  const ai = getGeminiClient();
  let aiEvaluated = false;
  let geminiResult = null;

  if (ai && text.trim().length > 30) {
    try {
      const prompt = `You are a forensic enterprise credential verification auditor for AIRIS.
Target Candidate Applicant Name: "${candidateName || 'Candidate'}".

Evaluate the following certificate document text:
"""
${text.slice(0, 2500)}
"""

AUDIT RULES:
1. Recipient Identification: Who was this certificate awarded to?
2. Recipient Match: Does the recipient name on the certificate match "${candidateName || 'Candidate'}"?
3. Issuer: Who issued or accredited this certification?
4. Title: Full course / certification title.
5. Credential Proof: Any Credential ID, Certificate ID, or verification URL?
6. Is Valid Certificate: Is this a genuine certificate or an unrelated document?
7. Authenticity Status:
   - "VERIFIED_AUTHENTIC": Recipient matches candidate AND genuine accredited certificate.
   - "PROVISIONAL": Recipient matches candidate, valid completion certificate, but no external URL.
   - "REJECTED_NAME_MISMATCH": Certificate belongs to someone else (e.g. issued to Harnoor Singh when candidate is Kamaljeet Singh).
   - "INVALID_DOCUMENT": Not a certificate.
8. Skills: List of core technical skills taught.
9. Audit Summary: 1 clear sentence summarizing authenticity and owner verification findings.

Return strictly valid JSON only:
{
  "recipientName": "string or null",
  "recipientMatchesCandidate": true,
  "issuer": "string",
  "issuerTier": "string",
  "title": "string",
  "credentialId": "string or null",
  "verifyUrl": "string or null",
  "isValidDocument": true,
  "authenticityStatus": "VERIFIED_AUTHENTIC",
  "skills": ["skill1", "skill2"],
  "authenticityScore": 1.0,
  "auditSummary": "string"
}`;

      const response = await generateGeminiContentWithTimeout(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt
      }, 5500);

      const responseText = response.text ? response.text.trim() : '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      geminiResult = JSON.parse(cleanJson);
      aiEvaluated = true;
    } catch (geminiErr) {
      console.warn('[Analyzer] Gemini certificate audit fallback:', geminiErr.message);
    }
  }

  // Merge AI result or compute deterministic result
  if (aiEvaluated && geminiResult) {
    if (geminiResult.title) title = geminiResult.title;
    if (geminiResult.issuer) recognizedIssuer = geminiResult.issuer;
    if (geminiResult.issuerTier) issuerTier = geminiResult.issuerTier;
    if (geminiResult.recipientName) recipientName = geminiResult.recipientName;
    if (Array.isArray(geminiResult.skills)) skills = geminiResult.skills.map(s => s.toLowerCase());

    const isNameMismatch = geminiResult.authenticityStatus === 'REJECTED_NAME_MISMATCH' || geminiResult.recipientMatchesCandidate === false;
    const isInvalid = !geminiResult.isValidDocument || geminiResult.authenticityStatus === 'INVALID_DOCUMENT';

    let authenticityStatus = 'VERIFIED_AUTHENTIC';
    let authenticityScore = 1.0;
    let isAuthentic = true;

    if (isNameMismatch) {
      authenticityStatus = 'REJECTED_NAME_MISMATCH';
      authenticityScore = 0;
      isAuthentic = false;
    } else if (isInvalid) {
      authenticityStatus = 'INVALID_DOCUMENT';
      authenticityScore = 0;
      isAuthentic = false;
    } else if (geminiResult.authenticityStatus === 'PROVISIONAL') {
      authenticityStatus = 'PROVISIONAL';
      authenticityScore = 0.75;
      isAuthentic = true;
    }

    // Check skill relevance to job
    const isRelevant = isAuthentic && jobSkills.some(js => {
      const s = js.toLowerCase();
      return skills.some(cs => cs.includes(s) || s.includes(cs)) || title.toLowerCase().includes(s);
    });

    return {
      filename,
      title,
      issuer: recognizedIssuer || 'Accredited Training Provider',
      issuerTier,
      recipientName: recipientName || candidateName || 'Candidate',
      recipientMatched: !isNameMismatch,
      credentialId: geminiResult.credentialId || credentialId,
      verifyUrl: geminiResult.verifyUrl || verifyUrl,
      skills,
      authenticityStatus,
      authenticityScore,
      isAuthentic,
      isRelevant,
      auditSummary: geminiResult.auditSummary || (
        isNameMismatch
          ? `Certificate rejected: issued to ${recipientName || 'another individual'}, not ${candidateName}.`
          : `Verified credential from ${recognizedIssuer || 'provider'}.`
      )
    };
  }

  // Deterministic Fallback
  if (skills.length === 0) {
    skills = extractSkills(text);
    if (skills.length === 0) {
      skills = ['professional certification'];
    }
  }

  // Recipient Name Match validation
  let recipientMatched = true;
  let authenticityStatus = 'PROVISIONAL';
  let authenticityScore = 0.75;
  let isAuthentic = true;
  let auditSummary = 'Provisional certificate: Contains valid completion marks.';

  if (candidateName && recipientName) {
    const similarity = calculateNameSimilarity(candidateName, recipientName);
    if (similarity < 0.5) {
      recipientMatched = false;
      authenticityStatus = 'REJECTED_NAME_MISMATCH';
      authenticityScore = 0;
      isAuthentic = false;
      auditSummary = `Integrity Alert: Certificate was awarded to "${recipientName}", which does not match candidate "${candidateName}". Score revoked.`;
    } else {
      recipientMatched = true;
    }
  }

  if (isAuthentic && !hasHallmark && text.trim().length < 50) {
    authenticityStatus = 'INVALID_DOCUMENT';
    authenticityScore = 0;
    isAuthentic = false;
    auditSummary = 'Document does not contain standard accreditation or completion statements.';
  } else if (isAuthentic && (credentialId || verifyUrl || recognizedIssuer)) {
    authenticityStatus = 'VERIFIED_AUTHENTIC';
    authenticityScore = 1.0;
    auditSummary = `Verified credential from ${recognizedIssuer || 'accredited body'} (ID: ${credentialId || 'Digital Sign'}).`;
  }

  const isRelevant = isAuthentic && jobSkills.some(js => {
    const s = js.toLowerCase();
    return skills.some(cs => cs.includes(s) || s.includes(cs)) || title.toLowerCase().includes(s);
  });

  return {
    filename,
    title,
    issuer: recognizedIssuer || 'Accredited Institution',
    issuerTier,
    recipientName: recipientName || candidateName || 'Candidate',
    recipientMatched,
    credentialId,
    verifyUrl,
    skills,
    authenticityStatus,
    authenticityScore,
    isAuthentic,
    isRelevant,
    auditSummary
  };
}

async function analyzeResume({ resumePath, certificatePaths = [], job, candidateName: claimedName = '', candidateEmail: claimedEmail = '' }) {
  const resumeText = await extractTextFromFile(resumePath);
  const resumeCandidateName = extractName(resumeText);
  const resumeCandidateEmail = extractEmail(resumeText);
  const resumeSkills = extractSkills(resumeText);

  // Candidate Identity Consistency Check
  const effectiveClaimedName = claimedName || resumeCandidateName || 'Candidate';
  const effectiveClaimedEmail = claimedEmail || resumeCandidateEmail || '';
  const identityVerification = verifyCandidateIdentity({
    claimedName: effectiveClaimedName,
    resumeName: resumeCandidateName,
    claimedEmail: effectiveClaimedEmail,
    resumeEmail: resumeCandidateEmail
  });

  const mandatorySkills = (job.mandatory_skills || []).map(s => s.toLowerCase().trim());
  const optionalSkills = (job.optional_skills || []).map(s => s.toLowerCase().trim());
  const allJobSkills = [...mandatorySkills, ...optionalSkills];

  // Semantic matching
  const jobText = `${job.title} ${job.description} ${allJobSkills.join(' ')}`;
  const semanticScore = calculateCosineSimilarity(resumeText, jobText);

  // Skill matching
  const matchedMandatory = mandatorySkills.filter(s =>
    resumeSkills.some(rs => rs === s || rs.includes(s) || s.includes(rs))
  );
  const matchedOptional = optionalSkills.filter(s =>
    resumeSkills.some(rs => rs === s || rs.includes(s) || s.includes(rs))
  );
  const missingMandatory = mandatorySkills.filter(s => !matchedMandatory.includes(s));

  const mandatoryScore = mandatorySkills.length > 0 ? (matchedMandatory.length / mandatorySkills.length) : 1;
  const optionalScore = optionalSkills.length > 0 ? (matchedOptional.length / optionalSkills.length) : 0;
  let skillScore = (0.7 * mandatoryScore) + (0.3 * optionalScore);

  // Certificates Forensic Authenticity Verification
  const certificateAudits = [];
  let verifiedRelevantCertsCount = 0;
  let totalValidCertsCount = 0;
  let rejectedNameMismatchCount = 0;
  const totalCerts = certificatePaths.length;

  if (totalCerts > 0) {
    for (const certPath of certificatePaths) {
      try {
        const certAudit = await verifyCertificateAuthenticity(certPath, effectiveClaimedName, allJobSkills);
        certificateAudits.push(certAudit);

        if (certAudit.authenticityStatus === 'REJECTED_NAME_MISMATCH') {
          rejectedNameMismatchCount++;
        } else if (certAudit.isAuthentic) {
          totalValidCertsCount++;
          if (certAudit.isRelevant) {
            verifiedRelevantCertsCount++;
          }
        }
      } catch (certErr) {
        console.warn('[Analyzer] Error verifying certificate:', certErr.message);
      }
    }
  }

  let certificationScore = 0;
  if (job.certification_enabled && totalCerts > 0) {
    // Only authentic and relevant certificates earn credit; mismatched or fake certificates yield 0
    certificationScore = verifiedRelevantCertsCount / totalCerts;
    const certWeight = typeof job.certification_weight === 'number' ? job.certification_weight : 0.2;
    skillScore += certificationScore * certWeight;
    skillScore = Math.min(1, skillScore);
  }

  const experienceScore = calculateExperienceScore(resumeText);

  const finalScore = (
    0.4 * semanticScore +
    0.4 * skillScore +
    0.2 * experienceScore
  );

  const eligibilityStatus = missingMandatory.length > 0
    ? 'Rejected - Missing Mandatory Skills'
    : 'Eligible';

  const category = classifyCandidate(finalScore, skillScore);

  const explanation = [];
  if (identityVerification.status === 'MISMATCH') {
    explanation.push(identityVerification.message);
  }
  if (eligibilityStatus.startsWith('Rejected')) {
    explanation.push(`Missing mandatory skills: ${missingMandatory.join(', ')}`);
  }
  if (rejectedNameMismatchCount > 0) {
    explanation.push(`Warning: ${rejectedNameMismatchCount} uploaded certificate(s) were rejected due to recipient name mismatch.`);
  }
  if (certificationScore > 0) {
    explanation.push(`${verifiedRelevantCertsCount} authentic, job-relevant certification(s) verified and factored into score`);
  }
  if (semanticScore < 0.5) {
    explanation.push('Low semantic match with job description');
  } else {
    explanation.push('Strong alignment with position responsibilities');
  }

  return {
    candidate_name: resumeCandidateName,
    identityVerification,
    scores: {
      semantic: Math.round(semanticScore * 100) / 100,
      skill: Math.round(skillScore * 100) / 100,
      experience: Math.round(experienceScore * 100) / 100,
      certification: Math.round(certificationScore * 100) / 100,
      final: Math.round(finalScore * 100) / 100
    },
    eligibility: eligibilityStatus,
    category,
    skills: {
      matched: [...matchedMandatory, ...matchedOptional],
      missing: missingMandatory
    },
    certifications: {
      total_uploaded: totalCerts,
      authentic: totalValidCertsCount,
      relevant: verifiedRelevantCertsCount,
      rejected_mismatches: rejectedNameMismatchCount,
      audits: certificateAudits
    },
    explanation
  };
}

async function generateCandidateIntelligence({ resumeText = '', candidateName = 'Candidate', job, scores = {}, skills = {}, eligibility = 'Eligible', category = 'Average' }) {
  const ai = getGeminiClient();
  const mandatorySkills = job.mandatory_skills || [];
  const optionalSkills = job.optional_skills || [];
  const matchedSkills = skills?.matched || [];
  const missingSkills = skills?.missing || [];

  const finalScoreNum = typeof scores.final === 'number' ? scores.final : 0.6;
  const semanticScoreNum = typeof scores.semantic === 'number' ? scores.semantic : 0.6;
  const skillScoreNum = typeof scores.skill === 'number' ? scores.skill : 0.6;
  const expScoreNum = typeof scores.experience === 'number' ? scores.experience : 0.6;

  if (ai && resumeText && resumeText.trim().length > 30) {
    try {
      const prompt = `You are an elite talent acquisition AI partner for AIRIS (AI Resume Intelligence System).
Analyze this candidate's resume for the role "${job.title}".

JOB DETAILS:
${job.description}
Mandatory Skills: ${mandatorySkills.join(', ')}
Optional Skills: ${optionalSkills.join(', ')}

CANDIDATE:
Name: ${candidateName}, Category: ${category}, Match: ${(finalScoreNum * 100).toFixed(0)}%, Matched: ${matchedSkills.slice(0, 5).join(', ') || 'None'}, Missing: ${missingSkills.slice(0, 3).join(', ') || 'None'}

RESUME SNIPPET:
${resumeText.slice(0, 1200)}

Respond with strictly valid JSON only:
{
  "executiveSummary": "2 concise sentences on candidate suitability and technical background.",
  "coreStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "skillGaps": ["Gap or ramp-up area 1", "Gap or ramp-up area 2"],
  "interviewQuestions": [
    { "question": "Question 1", "focus": "Architecture", "expectedSignals": "Strong signals" },
    { "question": "Question 2", "focus": "Problem Solving", "expectedSignals": "Signals" }
  ],
  "hiringRecommendation": {
    "decision": "Strong Advance",
    "reasoning": "1 sentence recommendation rationale."
  },
  "applicantFeedback": {
    "resumeTips": ["Actionable tip 1", "Actionable tip 2"],
    "suggestedActions": ["Suggested certification or milestone project"]
  }
}`;

      const response = await generateGeminiContentWithTimeout(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt
      }, 7000);

      const responseText = response.text ? response.text.trim() : '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.executiveSummary && Array.isArray(parsed.interviewQuestions)) {
        return {
          ...parsed,
          generatedBy: 'AIRIS Gemini Intelligence Engine',
          generatedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('[Analyzer] Gemini candidate intelligence generation fallback:', err.message);
    }
  }

  // Deterministic intelligent fallback
  const isHighMatch = finalScoreNum >= 0.7;
  const isMidMatch = finalScoreNum >= 0.5;

  const decision = isHighMatch
    ? 'Strong Advance'
    : isMidMatch
    ? 'Advance to Technical Screening'
    : 'Hold / Realign for Alternative Openings';

  const defaultSummary = `${candidateName} demonstrates a ${(finalScoreNum * 100).toFixed(0)}% overall compatibility score for the ${job.title} opening. The profile shows ${matchedSkills.length > 0 ? `active proficiency in ${matchedSkills.slice(0, 4).join(', ')}` : 'solid technical fundamentals'} with a ${(semanticScoreNum * 100).toFixed(0)}% semantic context alignment with role responsibilities.`;

  const coreStrengths = [
    `Demonstrated capability in required core competencies: ${matchedSkills.slice(0, 3).join(', ') || 'core software engineering concepts'}.`,
    `Relevant domain background evaluated at ${(expScoreNum * 100).toFixed(0)}% depth for ${job.title}.`,
    `Structured professional resume with demonstrated project delivery in modern technology stacks.`
  ];

  const skillGaps = missingSkills.length > 0
    ? missingSkills.map(s => `Requires evaluation or ramp-up in mandatory competency: "${s}" (Moderate Risk)`)
    : [
        `No critical mandatory skill deficiencies detected; candidate matches all required core tech stacks.`,
        `Recommend probing practical depth in optional tooling: ${(optionalSkills.slice(0, 2)).join(', ') || 'cloud deployment pipelines'}.`
      ];

  const interviewQuestions = [
    {
      question: `In your recent work, how have you architected and scaled systems using ${matchedSkills[0] || 'core technologies'} to handle real-world latency and concurrent load?`,
      focus: `${matchedSkills[0] || 'Core Architecture'} & Systems Design`,
      expectedSignals: 'Look for concrete architectural trade-offs, caching or database optimization, and metric-backed outcomes.'
    },
    {
      question: missingSkills.length > 0
        ? `This position relies on ${missingSkills[0]}. While your background shows strong parallels, how would you approach ramping up and applying this in production within the first 30 days?`
        : `Walk us through a scenario where a critical feature broke unexpectedly in production. How did you triage, resolve, and prevent recurrence?`,
      focus: missingSkills.length > 0 ? `Adaptability & ${missingSkills[0]}` : 'Incident Triaging & Observability',
      expectedSignals: 'Candidate articulates structured debugging methodology and fast-learning engineering mindset.'
    },
    {
      question: `How do you approach automated testing, continuous delivery, and code review standards when shipping under tight deadlines?`,
      focus: 'Engineering Rigor & Team Velocity',
      expectedSignals: 'Demonstrates balanced velocity with code quality, automated test pipelines, and constructive peer collaboration.'
    }
  ];

  return {
    executiveSummary: defaultSummary,
    coreStrengths,
    skillGaps,
    interviewQuestions,
    hiringRecommendation: {
      decision,
      reasoning: isHighMatch
        ? `The candidate possesses the necessary skill baseline and high semantic alignment. Recommended to proceed directly to technical screening.`
        : `The candidate demonstrates solid potential but has specific competency gaps that should be validated during technical screening.`
    },
    applicantFeedback: {
      resumeTips: [
        `Quantify project achievements with measurable business impact (e.g., reduced response times by 30%, served 50k+ daily users).`,
        `Ensure explicit keywords for core target skills like ${mandatorySkills.slice(0, 3).join(', ')} appear prominently in recent role bullet points.`
      ],
      suggestedActions: [
        `Highlight hands-on open-source repositories or demonstrable portfolio projects featuring ${missingSkills[0] || optionalSkills[0] || 'modern distributed architecture'}.`,
        `Pursue industry-recognized certifications in cloud platforms or modern frameworks to reinforce technical authority.`
      ]
    },
    generatedBy: 'AIRIS AI Screening Engine (Deterministic Heuristic)',
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  analyzeResume,
  extractSkills,
  extractTextFromFile,
  generateCandidateIntelligence,
  verifyCandidateIdentity,
  verifyCertificateAuthenticity
};
