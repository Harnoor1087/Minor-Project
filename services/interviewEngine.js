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
 * Extract named candidate projects and architectural details from resume text
 */
function extractCandidateProjects(resumeText = '', skills = { matched: [], missing: [] }) {
  const projects = [];
  if (!resumeText || typeof resumeText !== 'string') {
    return getDefaultProjects(skills);
  }

  // 1. Look for explicit project headings in resume
  const projectSectionMatch = resumeText.match(/(?:projects?|technical projects?|academic projects?|key projects?|selected projects?|recent work|portfolio)\b[:\s\n-]*([\s\S]*?)(?=(?:\n[A-Z][A-Za-z\s]{2,20}:|\n(?:education|experience|work experience|employment|certifications|awards|summary)\b|$))/i);
  
  const rawProjectBlock = projectSectionMatch ? projectSectionMatch[1] : '';
  const searchSource = rawProjectBlock.length > 50 ? rawProjectBlock : resumeText;

  // Split into potential project chunks
  const lines = searchSource.split('\n').map(l => l.trim()).filter(Boolean);
  let currentProject = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line looks like a project bullet or action verb
    const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') ||
      /^(built|developed|architected|engineered|designed|implemented|spearheaded|scaled|created|deployed)\b/i.test(line);

    // Check if line looks like a project title: e.g. "Distributed Kafka Ledger | Node.js, Kafka"
    const isHeaderLine = !isBullet && !line.endsWith('.') &&
      line.length >= 4 && line.length <= 90 &&
      !/^(experience|education|skills|certifications|responsibilities|technologies|tools|languages|summary|about|profile)/i.test(line);

    if (isHeaderLine) {
      if (currentProject && currentProject.name && currentProject.details.length > 0) {
        projects.push(finalizeProject(currentProject));
      }
      currentProject = {
        name: line.replace(/^(?:project\s*\d*\s*[:\-]|###|##|\*|\-)\s*/i, '').trim(),
        details: []
      };
    } else if (currentProject) {
      if (isBullet) {
        currentProject.details.push(line.replace(/^[•\-\*]\s*/, '').trim());
      } else if (currentProject.details.length < 3 && line.length > 15 && !line.includes('@')) {
        currentProject.details.push(line);
      }
    }
  }

  if (currentProject && currentProject.name && currentProject.details.length > 0) {
    projects.push(finalizeProject(currentProject));
  }

  // 2. If no project was parsed cleanly via headers, look for action lines in general text
  if (projects.length === 0) {
    const actionLines = lines.filter(l => /^(?:•|\-|\*)?\s*(?:built|developed|architected|engineered|designed|implemented|spearheaded|scaled)\b/i.test(l));
    if (actionLines.length > 0) {
      projects.push({
        name: 'Production Engineering Project',
        summary: actionLines.slice(0, 3).join('; ').replace(/^[•\-\*]\s*/g, ''),
        tech: extractTechWords(actionLines.join(' '), skills)
      });
    }
  }

  // 3. Fallback if still empty
  if (projects.length === 0) {
    return getDefaultProjects(skills);
  }

  return projects.slice(0, 3);
}

function finalizeProject(p) {
  const allText = [p.name, ...p.details].join(' ');
  const tech = extractTechWords(allText, { matched: [] });
  return {
    name: p.name.split(/[|–—\(\[]/)[0].trim(),
    summary: p.details.slice(0, 3).join(' '),
    tech: tech.length > 0 ? tech : ['Modern Architecture Stack']
  };
}

function extractTechWords(text, skills) {
  const commonTech = [
    'Node.js', 'React', 'TypeScript', 'JavaScript', 'Python', 'Java', 'Golang',
    'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS',
    'GCP', 'GraphQL', 'Express', 'Django', 'FastAPI', 'Spring Boot', 'Next.js',
    'TensorFlow', 'PyTorch', 'Microservices', 'REST', 'Tailwind', 'Elasticsearch'
  ];
  const found = [];
  const lower = text.toLowerCase();
  commonTech.forEach(t => {
    if (lower.includes(t.toLowerCase())) found.push(t);
  });
  (skills.matched || []).forEach(m => {
    if (lower.includes(m.toLowerCase()) && !found.some(f => f.toLowerCase() === m.toLowerCase())) {
      found.push(m);
    }
  });
  return found.slice(0, 6);
}

function getDefaultProjects(skills) {
  const matched = (skills && Array.isArray(skills.matched) && skills.matched.length > 0) ? skills.matched : ['Full-Stack Engineering', 'API Integration'];
  return [
    {
      name: `${matched[0] || 'Cloud-Native'} Application Architecture`,
      summary: `End-to-end production service leveraging ${matched.slice(0, 3).join(', ')} with automated CI/CD and telemetry.`,
      tech: matched.slice(0, 4)
    }
  ];
}

/**
 * Generate context-aware interview questions based on Job, Resume, Identified Skill Gaps, and Project Deep-Dive
 */
async function generateInterviewQuestions({ job, resumeText = '', skills = { matched: [], missing: [] }, candidateName = 'Candidate' }) {
  const mandatorySkills = Array.isArray(job.mandatory_skills) ? job.mandatory_skills : [];
  const optionalSkills = Array.isArray(job.optional_skills) ? job.optional_skills : [];
  const matchedSkills = Array.isArray(skills.matched) ? skills.matched : [];
  const missingSkills = Array.isArray(skills.missing) ? skills.missing : mandatorySkills.filter(s => !matchedSkills.includes(s.toLowerCase()));

  // Extract structured projects from candidate resume
  const candidateProjects = extractCandidateProjects(resumeText, skills);
  const primaryProject = candidateProjects[0] || getDefaultProjects(skills)[0];

  const client = getGeminiClient();
  if (client) {
    try {
      const prompt = `You are the Lead Technical Interviewer and Evaluation Architect at ${job.companyName || 'AIRIS Talent'}.
Generate exactly 5 contextual, highly relevant technical interview questions for the role: "${job.title}".

Context:
Candidate Name: ${candidateName}
Target Department: ${job.department || 'Engineering'}
Experience Level: ${job.experienceLevel || 'Mid Level'}
Mandatory Skills for Job: ${mandatorySkills.join(', ') || 'Software Engineering'}
Optional Skills for Job: ${optionalSkills.join(', ') || 'Best Practices'}
Candidate's Verified Skills: ${matchedSkills.join(', ') || 'General Technical Background'}
Identified Candidate Skill Gaps: ${missingSkills.join(', ') || 'Advanced production tooling'}

Candidate's Parsed Resume Projects:
${candidateProjects.map((p, idx) => `Project ${idx + 1}: "${p.name}" (Tech: ${p.tech.join(', ')}). Details: ${p.summary}`).join('\n')}

Candidate Resume Snippet (First 2500 chars):
"""
${resumeText.slice(0, 2500)}
"""

Formulate exactly 5 distinct questions covering these essential evaluation dimensions:
1. Core Competency Alignment: Tests candidate's verified primary skill in practical production code.
2. Project Deep-Dive (MANDATORY): A dedicated interrogation directly referencing the candidate's actual resume project: "${primaryProject.name}".
   - Drill into specific architectural choices, component boundaries, and why specific technologies were selected over alternatives.
   - Challenge candidate on their specific individual contributions and ownership vs third-party packages or team scope.
   - Ask about the hardest technical hurdle, bottleneck, concurrency issue, or data consistency constraint encountered in that project and how it was solved.
   - Investigate how testing, deployment, and production observability were handled.
3. Skill Gap Investigation: Specifically tests how the candidate navigates their identified skill gaps (${missingSkills.slice(0, 3).join(', ') || 'new technologies'}) or applies analogous concepts.
4. System Architecture & Real-World Scenario: A realistic production challenge tailored to ${job.title} at ${job.companyName || 'our company'}.
5. Troubleshooting & Operational Trade-offs: A complex production incident, debugging challenge, or engineering trade-off.

Output ONLY valid JSON matching this exact array structure:
[
  {
    "id": 1,
    "category": "Core Competency Alignment",
    "targetArea": "Primary skill focus",
    "rationale": "Why this question matters for this candidate",
    "question": "The comprehensive question text",
    "keyFocusPoints": ["Point 1", "Point 2", "Point 3"]
  },
  {
    "id": 2,
    "category": "Project Deep-Dive",
    "targetArea": "${primaryProject.name} Architecture & Individual Contribution",
    "rationale": "Directly cross-examines candidate on concrete implementation, architectural trade-offs, and technical ownership in their stated project: ${primaryProject.name}",
    "question": "Comprehensive project deep-dive question referencing ${primaryProject.name}...",
    "keyFocusPoints": ["Architectural decisions & trade-offs in ${primaryProject.name}", "Personal contributions vs library abstractions", "Resolution of scalability/concurrency bottlenecks"]
  },
  ...
]`;

      const response = await Promise.race([
        client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Question generation timed out')), 7000))
      ]);

      let raw = response.text ? response.text.trim() : '';
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return parsed.map((q, idx) => ({
          ...q,
          id: idx + 1
        }));
      }
    } catch (err) {
      console.warn('[InterviewEngine] Gemini question generation failed, using intelligent heuristic:', err.message);
    }
  }

  // Fallback: Intelligent heuristic generation using parsed projects, skills and role context
  return generateHeuristicQuestions({ job, matchedSkills, missingSkills, mandatorySkills, candidateProjects });
}

function generateHeuristicQuestions({ job, matchedSkills, missingSkills, mandatorySkills, candidateProjects = [] }) {
  const primarySkill = matchedSkills[0] || mandatorySkills[0] || 'software architecture';
  const secondarySkill = matchedSkills[1] || mandatorySkills[1] || 'API design';
  const gapSkill = missingSkills[0] || (mandatorySkills.length > 2 ? mandatorySkills[2] : 'cloud deployment');
  const role = job.title || 'Software Engineer';
  const company = job.companyName || 'the enterprise';

  const project = (Array.isArray(candidateProjects) && candidateProjects.length > 0)
    ? candidateProjects[0]
    : { name: 'Full-Stack Architecture & Microservices Pipeline', tech: [primarySkill, secondarySkill], summary: 'Enterprise production service' };

  const projectTechStr = Array.isArray(project.tech) && project.tech.length > 0 ? project.tech.join(', ') : `${primarySkill} and related frameworks`;

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
      category: 'Project Deep-Dive',
      targetArea: `Architecture & Ownership: "${project.name}" (${projectTechStr})`,
      rationale: `Examines candidate's authentic technical ownership, engineering decisions, and problem-solving depth on their stated project: "${project.name}".`,
      question: `In your project "${project.name}" (utilizing ${projectTechStr}), walk us through the end-to-end architecture from data ingestion to persistence and client delivery. What was your specific individual contribution, what design alternatives did you reject, and how did you diagnose and resolve the single most critical performance bottleneck or data consistency challenge in that system?`,
      keyFocusPoints: [
        `System component boundaries and data flow in ${project.name}`,
        'Candidate individual technical contribution vs team scope/libraries',
        'Key technical trade-offs, bottlenecks, and how resolution was measured'
      ]
    },
    {
      id: 3,
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
      id: 4,
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
      id: 5,
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

Evaluate the answer objectively.
${question.category === 'Project Deep-Dive' ? 'CRITICAL EVALUATION FOCUS: Specifically assess the candidate\'s authentic technical ownership, architectural justification of tech choices, personal contributions vs third-party packages, and their systematic resolution of bottlenecks and constraints.' : ''}

Return ONLY valid JSON:
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
          model: 'gemini-3.8-flash',
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

  // Bonus for Project Deep-Dive personal ownership and trade-off justification
  const isProjectDeepDive = (question.category || '').toLowerCase().includes('project');
  if (isProjectDeepDive) {
    const ownershipTerms = ['i designed', 'i built', 'i implemented', 'my contribution', 'we chose', 'trade-off', 'alternative', 'bottleneck', 'migrated', 'refactored', 'decision', 'latency', 'benchmark'];
    let ownershipCount = 0;
    ownershipTerms.forEach(term => {
      if (text.includes(term)) ownershipCount++;
    });
    baseScore += Math.min(15, ownershipCount * 3);
  }

  const finalScore = Math.min(95, Math.max(30, Math.round(baseScore)));

  const strengths = [];
  const improvements = [];

  if (isProjectDeepDive) {
    if (text.includes('trade-off') || text.includes('chose') || text.includes('alternative') || text.includes('decision')) {
      strengths.push('Articulated specific architectural trade-offs and justified technology selections.');
    } else {
      improvements.push('Clarify why specific libraries or database architectures were chosen over alternatives.');
    }
    if (text.includes('bottleneck') || text.includes('latency') || text.includes('concurrency') || text.includes('scale')) {
      strengths.push('Demonstrated strong problem-solving under real-world performance constraints.');
    } else {
      improvements.push('Discuss quantitative throughput, latency metrics, and performance limits.');
    }
  }

  if (wordCount >= 80) {
    strengths.push('Provided a well-structured and detailed explanation.');
  }
  if (matchedTechCount >= 3) {
    strengths.push('Effectively referenced industry-standard architectural terms and best practices.');
  } else if (!isProjectDeepDive) {
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
