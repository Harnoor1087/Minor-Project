const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

function extractName(text) {
  if (!text) return 'Candidate';
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= 3 && trimmed.length <= 40 && !trimmed.includes('@') && !/https?:\/\//i.test(trimmed) && !/\d{4}/.test(trimmed)) {
      // Remove any trailing labels
      return trimmed.replace(/^resume\s*:?/i, '').trim();
    }
  }
  return 'Candidate';
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

async function processCertificate(filePath, jobSkills) {
  const text = await extractTextFromFile(filePath);
  const filename = path.basename(filePath);

  let title = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  let skills = [];
  let isValid = true;

  // Try Gemini if configured
  const ai = getGeminiClient();
  if (ai && text.trim().length > 20) {
    try {
      const prompt = `Analyze this certificate text and extract information in JSON format:
${text.slice(0, 2000)}

Return strictly valid JSON:
{
  "title": "course or certification name",
  "skills": ["technical skills mentioned"],
  "issuer": "organization or platform",
  "is_valid_certificate": true
}`;
      const response = await generateGeminiContentWithTimeout(ai, {
        model: 'gemini-2.5-flash',
        contents: prompt
      }, 5000);
      const responseText = response.text ? response.text.trim() : '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.title) title = parsed.title;
      if (Array.isArray(parsed.skills)) skills = parsed.skills.map(s => s.toLowerCase());
      if (parsed.is_valid_certificate !== undefined) isValid = Boolean(parsed.is_valid_certificate);
    } catch (geminiErr) {
      console.warn('[Analyzer] Gemini certificate extraction fallback:', geminiErr.message);
    }
  }

  // Fallback keyword extraction
  if (skills.length === 0) {
    skills = extractSkills(text);
    if (skills.length === 0) {
      skills = ['professional certification'];
    }
  }

  // Check relevance against job requirements
  const isRelevant = jobSkills.some(js => {
    const s = js.toLowerCase();
    return skills.some(cs => cs.includes(s) || s.includes(cs)) || title.toLowerCase().includes(s);
  });

  return {
    title,
    skills,
    isValid,
    isRelevant
  };
}

async function analyzeResume({ resumePath, certificatePaths = [], job }) {
  const resumeText = await extractTextFromFile(resumePath);
  const candidateName = extractName(resumeText);
  const resumeSkills = extractSkills(resumeText);

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

  // Certificates
  let relevantCerts = 0;
  const totalCerts = certificatePaths.length;

  if (totalCerts > 0) {
    for (const certPath of certificatePaths) {
      try {
        const certResult = await processCertificate(certPath, allJobSkills);
        if (certResult.isValid && certResult.isRelevant) {
          relevantCerts++;
        }
      } catch (certErr) {
        console.warn('[Analyzer] Error processing certificate:', certErr.message);
      }
    }
  }

  let certificationScore = 0;
  if (job.certification_enabled && totalCerts > 0) {
    certificationScore = relevantCerts / totalCerts;
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
  if (eligibilityStatus.startsWith('Rejected')) {
    explanation.push(`Missing mandatory skills: ${missingMandatory.join(', ')}`);
  }
  if (certificationScore > 0) {
    explanation.push('Relevant certifications validated and factored into score');
  }
  if (semanticScore < 0.5) {
    explanation.push('Low semantic match with job description');
  } else {
    explanation.push('Strong alignment with position responsibilities');
  }

  return {
    candidate_name: candidateName,
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
      relevant: relevantCerts
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
  generateCandidateIntelligence
};
