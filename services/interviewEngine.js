const { extractTextFromFile } = require('./analyzer');

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
    console.warn('[InterviewEngine] Could not initialize @google/genai:', err.message);
    return null;
  }
}

/**
 * Generate context-aware interview questions based on Job, Resume, and Identified Skill Gaps
 */
async function generateInterviewQuestions({ job, resumeText = '', skills = { matched: [], missing: [] }, candidateName = 'Candidate' }) {
  const mandatorySkills = Array.isArray(job.mandatory_skills) ? job.mandatory_skills : [];
  const optionalSkills = Array.isArray(job.optional_skills) ? job.optional_skills : [];
  const matchedSkills = Array.isArray(skills.matched) ? skills.matched : [];
  const missingSkills = Array.isArray(skills.missing) ? skills.missing : mandatorySkills.filter(s => !matchedSkills.includes(s.toLowerCase()));

  const client = getGeminiClient();
  if (client) {
    try {
      const prompt = `You are the Lead Technical Interviewer and Evaluation Architect at ${job.companyName || 'AIRIS Talent'}.
Generate exactly 4 contextual, highly relevant technical interview questions for the role: "${job.title}".

Context:
Candidate Name: ${candidateName}
Target Department: ${job.department || 'Engineering'}
Experience Level: ${job.experienceLevel || 'Mid Level'}
Mandatory Skills for Job: ${mandatorySkills.join(', ') || 'Software Engineering'}
Optional Skills for Job: ${optionalSkills.join(', ') || 'Best Practices'}
Candidate's Verified Skills: ${matchedSkills.join(', ') || 'General Technical Background'}
Identified Candidate Skill Gaps: ${missingSkills.join(', ') || 'Advanced production tooling'}
Candidate Resume Snippet (First 2000 chars):
"""
${resumeText.slice(0, 2000)}
"""

Formulate 4 distinct questions:
1. Core Competency: Focuses on candidate's strongest verified skills aligned with the job.
2. Skill Gap Investigation: Specifically tests how the candidate navigates their identified skill gaps (${missingSkills.slice(0, 3).join(', ') || 'new technologies'}) or applies analogous concepts.
3. System Architecture & Real-World Scenario: A realistic production challenge tailored to ${job.title} at ${job.companyName || 'our company'}.
4. Troubleshooting & Operational Trade-offs: A complex production incident, debugging challenge, or engineering trade-off.

Output ONLY valid JSON matching this exact array structure:
[
  {
    "id": 1,
    "category": "Core Competency",
    "targetArea": "Primary skill focus",
    "rationale": "Why this question matters for this candidate",
    "question": "The comprehensive question text",
    "keyFocusPoints": ["Point 1", "Point 2", "Point 3"]
  },
  ...
]`;

      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Question generation timed out')), 7000))
      ]);

      let raw = response.text ? response.text.trim() : '';
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.map((q, idx) => ({
          ...q,
          id: idx + 1
        }));
      }
    } catch (err) {
      console.warn('[InterviewEngine] Gemini question generation failed, using intelligent heuristic:', err.message);
    }
  }

  // Fallback: Intelligent heuristic generation using skills and role context
  return generateHeuristicQuestions({ job, matchedSkills, missingSkills, mandatorySkills });
}

function generateHeuristicQuestions({ job, matchedSkills, missingSkills, mandatorySkills }) {
  const primarySkill = matchedSkills[0] || mandatorySkills[0] || 'software architecture';
  const secondarySkill = matchedSkills[1] || mandatorySkills[1] || 'API design';
  const gapSkill = missingSkills[0] || (mandatorySkills.length > 2 ? mandatorySkills[2] : 'cloud deployment');
  const role = job.title || 'Software Engineer';
  const company = job.companyName || 'the enterprise';

  return [
    {
      id: 1,
      category: 'Core Competency Alignment',
      targetArea: `${primarySkill.toUpperCase()} & Practical Implementation`,
      rationale: `Directly assesses candidate's verified capability in ${primarySkill} which is vital for this ${role} position.`,
      question: `In your recent projects leveraging ${primarySkill}, what was the most demanding technical hurdle you resolved? Specifically detail the design choices, edge cases, and performance considerations you took.`,
      keyFocusPoints: [
        `Architectural decisions with ${primarySkill}`,
        'Handling concurrency, throughput, or memory constraints',
        'Testing and production verification strategies'
      ]
    },
    {
      id: 2,
      category: 'Skill Gap & Adaptability',
      targetArea: `Adoption of ${gapSkill.toUpperCase()} in Production`,
      rationale: `Our screening identified ${gapSkill} as a core requirement for ${job.title}. This investigates your problem-solving adaptability.`,
      question: `This role at ${company} requires strong proficiency with ${gapSkill}. Even if your primary background is in other tooling, how would you design and implement a solution utilizing ${gapSkill}? What foundational concepts translate directly from your existing toolset?`,
      keyFocusPoints: [
        `Fundamental paradigms of ${gapSkill}`,
        'Translating analogous patterns from known technologies',
        'Mitigating risks when adopting new system components'
      ]
    },
    {
      id: 3,
      category: 'System Architecture & Scalability',
      targetArea: `End-to-End System Design for ${role}`,
      rationale: `Evaluates holistic architectural thinking, security boundaries, and scalability for high-load systems.`,
      question: `Imagine you are tasked with architecting a fault-tolerant subsystem for ${company} that processes high-frequency user requests. How would you structure data consistency, caching, asynchronous communication, and observability?`,
      keyFocusPoints: [
        'Data consistency vs latency trade-offs',
        'Resilience (circuit breakers, retries, dead-letter queues)',
        'Metrics, structured logging, and distributed tracing'
      ]
    },
    {
      id: 4,
      category: 'Engineering Trade-offs & Production Incident',
      targetArea: 'Incident Triage, Root-Cause Analysis & Quality Assurance',
      rationale: `Assesses operational maturity, calm under pressure, and systemic learning from outages.`,
      question: `Describe a scenario where a critical bug or performance degradation escaped into production. Walk us through your triage protocol, root cause analysis, immediate remediation, and the architectural safeguards you put in place to prevent recurrence.`,
      keyFocusPoints: [
        'Immediate containment and stakeholder communication',
        'Systematic root cause isolation (RCA)',
        'Preventative automation (CI/CD regression tests, alerting)'
      ]
    }
  ];
}

/**
 * Evaluate a single candidate answer
 */
async function evaluateAnswer({ question, candidateAnswer, job, candidateName = 'Candidate' }) {
  if (!candidateAnswer || candidateAnswer.trim().length < 15) {
    return {
      score: 25,
      technicalAccuracy: 20,
      depthAndPracticality: 20,
      clarityAndCommunication: 35,
      strengths: ['Candidate provided an initial brief response.'],
      improvements: ['Answer lacks technical depth, architecture specifics, and concrete examples.'],
      feedback: 'The response is too brief to adequately demonstrate technical competency. Please elaborate on system design choices, tooling, and concrete problem-solving steps.'
    };
  }

  const client = getGeminiClient();
  if (client) {
    try {
      const prompt = `You are a Principal Engineering Interviewer evaluating a candidate's answer.
Job Title: ${job.title}
Company: ${job.companyName || 'AIRIS'}
Question Category: ${question.category}
Target Area: ${question.targetArea}
Question Asked: "${question.question}"
Key Points Expected: ${(question.keyFocusPoints || []).join('; ')}

Candidate Name: ${candidateName}
Candidate's Answer:
"""
${candidateAnswer}
"""

Evaluate the answer objectively. Return ONLY valid JSON:
{
  "technicalAccuracy": <number 0-100>,
  "depthAndPracticality": <number 0-100>,
  "clarityAndCommunication": <number 0-100>,
  "score": <number 0-100 overall weighted score>,
  "strengths": ["string", "string"],
  "improvements": ["string", "string"],
  "feedback": "Concise, constructive summary (2-3 sentences)"
}`;

      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Answer evaluation timed out')), 6000))
      ]);

      let raw = response.text ? response.text.trim() : '';
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.score === 'number') {
        return {
          score: Math.min(100, Math.max(0, Math.round(parsed.score))),
          technicalAccuracy: Math.min(100, Math.max(0, Math.round(parsed.technicalAccuracy || parsed.score))),
          depthAndPracticality: Math.min(100, Math.max(0, Math.round(parsed.depthAndPracticality || parsed.score))),
          clarityAndCommunication: Math.min(100, Math.max(0, Math.round(parsed.clarityAndCommunication || parsed.score))),
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : ['Demonstrated relevant subject familiarity.'],
          improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0 ? parsed.improvements : ['Provide more quantitative production metrics.'],
          feedback: parsed.feedback || 'Solid technical demonstration with coherent structure.'
        };
      }
    } catch (err) {
      console.warn('[InterviewEngine] Gemini answer evaluation fallback:', err.message);
    }
  }

  // Fallback deterministic evaluation
  return evaluateHeuristicAnswer({ question, candidateAnswer });
}

function evaluateHeuristicAnswer({ question, candidateAnswer }) {
  const text = candidateAnswer.toLowerCase();
  const wordCount = candidateAnswer.trim().split(/\s+/).length;

  // Technical terminology density
  const techTerms = [
    'architecture', 'scale', 'database', 'api', 'cache', 'redis', 'kafka', 'latency',
    'throughput', 'docker', 'kubernetes', 'cloud', 'aws', 'gcp', 'sql', 'nosql',
    'microservices', 'async', 'performance', 'monitoring', 'ci/cd', 'test', 'security',
    'failover', 'replica', 'metric', 'observability', 'lock', 'concurrency', 'optimize'
  ];
  let matchedTechCount = 0;
  techTerms.forEach(term => {
    if (text.includes(term)) matchedTechCount++;
  });

  // Calculate scores
  let baseScore = 50;
  if (wordCount > 150) baseScore += 20;
  else if (wordCount > 70) baseScore += 12;
  else if (wordCount < 30) baseScore -= 15;

  baseScore += Math.min(25, matchedTechCount * 4);
  const finalScore = Math.min(95, Math.max(30, Math.round(baseScore)));

  const strengths = [];
  const improvements = [];

  if (wordCount >= 80) {
    strengths.push('Provided a well-structured and detailed explanation.');
  }
  if (matchedTechCount >= 3) {
    strengths.push('Effectively referenced industry-standard architectural terms and best practices.');
  } else {
    improvements.push('Could include more specific architectural tooling and protocol choices.');
  }

  if (text.includes('test') || text.includes('monitor') || text.includes('metric') || text.includes('log')) {
    strengths.push('Emphasized operational reliability, observability, and validation.');
  } else {
    improvements.push('Incorporate validation, telemetry, and automated testing strategies.');
  }

  if (strengths.length === 0) {
    strengths.push('Directly addressed the core prompt question.');
  }

  return {
    score: finalScore,
    technicalAccuracy: Math.min(100, finalScore + 2),
    depthAndPracticality: Math.min(100, Math.max(20, finalScore - 3)),
    clarityAndCommunication: Math.min(100, Math.max(30, finalScore + 4)),
    strengths,
    improvements,
    feedback: `The candidate delivered a ${finalScore >= 75 ? 'comprehensive and technically grounded' : 'fairly solid'} response addressing ${question.targetArea}. To elevate further, integrate concrete benchmarks and failure-recovery protocols.`
  };
}

/**
 * Generate final interview summary report
 */
function compileInterviewReport({ questions = [], infractions = [], proctoringConfig = {} }) {
  const answered = questions.filter(q => q.evaluation && typeof q.evaluation.score === 'number');
  const avgScore = answered.length > 0
    ? Math.round(answered.reduce((sum, q) => sum + q.evaluation.score, 0) / answered.length)
    : 0;

  const maxInfractions = proctoringConfig.max_infractions || 3;
  const infractionCount = infractions.length;

  let integrityStatus = 'CLEAN';
  if (infractionCount >= maxInfractions) {
    integrityStatus = 'DISQUALIFIED';
  } else if (infractionCount > 0) {
    integrityStatus = 'FLAGGED';
  }

  let recommendation = 'Borderline';
  if (integrityStatus === 'DISQUALIFIED') {
    recommendation = 'Disqualified (Integrity Violation)';
  } else if (avgScore >= 85) {
    recommendation = 'Strong Hire';
  } else if (avgScore >= 70) {
    recommendation = 'Hire';
  } else if (avgScore >= 55) {
    recommendation = 'Borderline / Additional Technical Screen';
  } else {
    recommendation = 'Do Not Hire';
  }

  return {
    overallScore: avgScore,
    answeredCount: answered.length,
    totalQuestions: questions.length,
    recommendation,
    integrityStatus,
    infractionCount,
    maxInfractions,
    completedAt: new Date().toISOString()
  };
}

module.exports = {
  generateInterviewQuestions,
  evaluateAnswer,
  compileInterviewReport
};
