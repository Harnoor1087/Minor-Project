const { GoogleGenAI } = require('@google/genai');

// Lazy initialization of Gemini client
let geminiClient = null;
function getGeminiClient() {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
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
    console.warn('[DecisionEngine] Could not initialize @google/genai:', err.message);
    return null;
  }
}

/**
 * Calculate the unified Composite Hiring Index (CHI)
 * Weights:
 * - 35% Resume & Verified Skill Compatibility
 * - 45% AI Proctored Technical Assessment Performance
 * - 20% In-Browser Proctoring & Anti-Malpractice Integrity Factor
 */
function calculateCompositeHiringIndex({ scores = {}, interview = {}, proctoringReport = {} }) {
  const resumeFit = Math.round(((scores.final !== undefined ? scores.final : 0.65)) * 100);
  
  // Interview performance score
  let interviewScore = 65; // baseline assumption if not yet taken
  let interviewCompleted = false;
  if (interview && typeof interview.overallScore === 'number') {
    interviewScore = Math.max(0, Math.min(100, interview.overallScore));
    interviewCompleted = interview.status === 'completed';
  }

  // Integrity factor
  const report = proctoringReport || (interview ? interview.proctoringReport : {}) || {};
  const status = report.integrityStatus || 'CLEAN';
  const infractions = Array.isArray(report.infractions) ? report.infractions.length : (report.infractionCount || 0);

  let integrityRating = 100;
  if (status === 'DISQUALIFIED' || interview.status === 'disqualified') {
    integrityRating = 0;
  } else if (status === 'FLAGGED' || infractions > 0) {
    integrityRating = Math.max(25, 100 - (infractions * 20));
  }

  // If candidate was disqualified for cheating, cap total index severely
  if (status === 'DISQUALIFIED' || interview.status === 'disqualified') {
    return {
      compositeHiringIndex: 12,
      breakdown: {
        resumeFit,
        interviewScore,
        integrityRating: 0,
        integrityStatus: 'DISQUALIFIED',
        infractionCount: infractions
      },
      verdict: 'DISQUALIFIED',
      verdictLabel: '🚫 Disqualified (Cheating / Malpractice Detected)',
      percentile: 5,
      recommendationSummary: 'Candidate violated anti-malpractice proctoring protocols during the technical assessment. Automatic disqualification.'
    };
  }

  // Calculate weighted Composite Hiring Index (0 - 100)
  const weightedChi = Math.round(
    (resumeFit * 0.35) + 
    (interviewScore * 0.45) + 
    (integrityRating * 0.20)
  );
  const chi = Math.max(10, Math.min(99, weightedChi));

  // Determine Verdict
  let verdict = 'CONSIDER_WITH_RESERVATIONS';
  let verdictLabel = '🟡 Consider with Reservations';
  let percentile = Math.min(98, Math.max(15, Math.round(chi * 1.02)));
  let recommendationSummary = 'Candidate shows acceptable alignment; second technical interview round or reference check advised.';

  if (chi >= 82 && integrityRating === 100) {
    verdict = 'STRONG_HIRE';
    verdictLabel = '🟢 Strong Hire (Top Talent Cohort)';
    percentile = Math.min(99, 88 + Math.round((chi - 82) * 0.7));
    recommendationSummary = 'Exceptional composite candidate. High resume relevance, stellar proctored interview execution, and flawless integrity telemetry.';
  } else if (chi >= 70) {
    verdict = 'HIRE';
    verdictLabel = '🟢 Hire (Exceeds Hiring Bar)';
    percentile = Math.min(88, 70 + Math.round((chi - 70) * 1.2));
    recommendationSummary = 'Solid candidate with proven technical competencies and demonstrated problem-solving skills meeting team standards.';
  } else if (chi < 55) {
    verdict = 'REJECT';
    verdictLabel = '🔴 Decline / Insufficient Role Alignment';
    percentile = Math.max(10, Math.round(chi * 0.8));
    recommendationSummary = 'Candidate did not meet required technical depth or prerequisite competencies for this specific vacancy.';
  }

  return {
    compositeHiringIndex: chi,
    breakdown: {
      resumeFit,
      interviewScore,
      interviewCompleted,
      integrityRating,
      integrityStatus: status,
      infractionCount: infractions
    },
    verdict,
    verdictLabel,
    percentile,
    recommendationSummary
  };
}

/**
 * Calibrate candidate leveling, compensation benchmarks, and ramp-up estimates
 */
function calibrateLevelingAndCompensation({ job = {}, application = {}, chi = 75 }) {
  const jobTitle = (job.title || application.jobTitle || 'Software Engineer').toLowerCase();
  const expScore = application.scores?.experience || 0.6;
  
  let levelCode = 'L4';
  let levelTitle = 'Mid-Level Engineer';
  let salaryRange = '$130,000 - $155,000 USD';
  let equityRange = '0.08% - 0.15% Equity Options';
  let rampUpWeeks = '2 - 3 Weeks';

  if (jobTitle.includes('lead') || jobTitle.includes('principal') || jobTitle.includes('architect')) {
    levelCode = 'L6';
    levelTitle = 'Staff / Principal Engineer';
    salaryRange = '$185,000 - $225,000 USD';
    equityRange = '0.25% - 0.50% Equity Options';
    rampUpWeeks = '1 - 2 Weeks (Immediate Technical Direction)';
  } else if (jobTitle.includes('senior') || expScore >= 0.8 || chi >= 84) {
    levelCode = 'L5';
    levelTitle = 'Senior Engineer';
    salaryRange = '$155,000 - $185,000 USD';
    equityRange = '0.15% - 0.25% Equity Options';
    rampUpWeeks = '1 - 2 Weeks';
  } else if (jobTitle.includes('junior') || jobTitle.includes('associate') || expScore < 0.45) {
    levelCode = 'L3';
    levelTitle = 'Associate Engineer';
    salaryRange = '$95,000 - $120,000 USD';
    equityRange = '0.04% - 0.08% Equity Options';
    rampUpWeeks = '4 - 6 Weeks (Mentorship Recommended)';
  }

  return {
    levelCode,
    levelTitle,
    salaryRange,
    equityRange,
    rampUpWeeks,
    suggestedBaseSalary: salaryRange.split('-')[0].trim() + ' base',
    levelingRationale: `Calibrated against ${job.title || 'Role'} expectations, demonstrated verified skills, and ${Math.round(expScore * 10)} years relevant industry exposure.`
  };
}

/**
 * Draft an official, tailored Offer Letter using Gemini 3.8 Flash
 */
async function generateOfferLetter({
  candidateName = 'Alex Morgan',
  jobTitle = 'Full Stack Software Engineer',
  companyName = 'AIRIS Talent Global',
  baseSalary = '$145,000 USD',
  equity = '0.15% Stock Options',
  startDate = '2026-10-01',
  customNotes = '',
  verifiedSkills = [],
  interviewScore = 85
}) {
  const client = getGeminiClient();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (client) {
    try {
      const prompt = `You are the Vice President of People and Talent Acquisition at ${companyName}.
Draft a formal, inspiring, and professional Offer Letter for candidate "${candidateName}" for the position of "${jobTitle}".

Context:
Company: ${companyName}
Candidate: ${candidateName}
Role: ${jobTitle}
Base Salary: ${baseSalary}
Equity: ${equity}
Target Start Date: ${startDate}
Technical Assessment Score: ${interviewScore}%
Verified Candidate Strengths: ${verifiedSkills.slice(0, 5).join(', ') || 'Software Engineering Excellence'}
Hiring Manager Custom Notes: ${customNotes || 'Exemplary problem-solving and proactive communication during assessment.'}
Offer Date: ${dateStr}

Write a formal, comprehensive, 4-paragraph Offer Letter including:
1. Enthusiastic offer of employment and role introduction.
2. Direct praise of the candidate's verified technical depth during the proctored interview and their alignment with the company's culture.
3. Detailed compensation breakdown (Base salary, Equity, 401(k)/pension, comprehensive healthcare, flexible work arrangements).
4. Next steps: Start date, acceptance instructions, and welcoming sign-off from the leadership team.

Do not include markdown code fences or backticks. Format with professional executive spacing.`;

      const res = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Offer letter generation timed out')), 7000))
      ]);

      if (res.text && res.text.trim().length > 100) {
        return {
          title: `Formal Offer of Employment: ${jobTitle}`,
          date: dateStr,
          subject: `Offer of Employment — ${jobTitle} at ${companyName}`,
          body: res.text.trim(),
          compensation: baseSalary,
          equity,
          startDate,
          generatedBy: 'AIRIS Executive Gemini Engine'
        };
      }
    } catch (err) {
      console.warn('[DecisionEngine] Gemini offer letter error:', err.message);
    }
  }

  // Robust fallback offer letter template
  const fallbackBody = `Dear ${candidateName},

On behalf of the entire team at ${companyName}, it is my absolute pleasure to extend to you this formal offer of employment for the position of ${jobTitle}.

Throughout our technical evaluation and proctored assessment, our hiring team was deeply impressed by your analytical rigor, demonstrated proficiency in ${verifiedSkills.slice(0, 4).join(', ') || 'software engineering'}, and exceptional communication. Your assessment score of ${interviewScore}% demonstrated the exact caliber of technical leadership and problem-solving excellence we seek for our growing team.

Compensation & Benefits Overview:
• Annual Base Salary: ${baseSalary} annualized, payable bi-weekly.
• Equity Participation: ${equity}, subject to standard 4-year vesting with a 1-year cliff.
• Target Start Date: ${startDate}.
• Benefits Package: Comprehensive medical, dental, and vision insurance with full company-paid premiums, 401(k) matching up to 5%, unlimited flexible paid time off (PTO), and an annual professional development stipend.

${customNotes ? `Special Note from the Hiring Committee:\n${customNotes}\n\n` : ''}We are confident that your expertise will make an immediate and lasting contribution to our core initiatives. Please sign and return this offer by your earliest convenience to initiate your onboarding. We look forward to welcoming you to ${companyName}!

Warm regards,

Executive Hiring Committee
${companyName}`;

  return {
    title: `Formal Offer of Employment: ${jobTitle}`,
    date: dateStr,
    subject: `Offer of Employment — ${jobTitle} at ${companyName}`,
    body: fallbackBody,
    compensation: baseSalary,
    equity,
    startDate,
    generatedBy: 'AIRIS Executive Template Engine'
  };
}

/**
 * Draft a constructive, highly respectful Rejection & Development Roadmap letter using Gemini 3.8 Flash
 */
async function generateRejectionFeedback({
  candidateName = 'Alex Morgan',
  jobTitle = 'Full Stack Software Engineer',
  companyName = 'AIRIS Talent Global',
  verifiedSkills = [],
  missingSkills = [],
  interviewScore = 60,
  customNotes = ''
}) {
  const client = getGeminiClient();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (client) {
    try {
      const prompt = `You are the Lead Talent Partner at ${companyName}.
Draft an empathetic, highly constructive and encouraging feedback and decision letter for applicant "${candidateName}" regarding the position of "${jobTitle}".

Context:
Company: ${companyName}
Candidate: ${candidateName}
Role: ${jobTitle}
Candidate Verified Strengths: ${verifiedSkills.join(', ') || 'Foundational Programming'}
Identified Growth / Skill Gaps: ${missingSkills.join(', ') || 'Advanced distributed architectures and system scaling'}
Interview Assessment Score: ${interviewScore}%
Recruiter Specific Feedback: ${customNotes || 'Solid foundational knowledge, but currently seeking candidates with deeper hands-on production scale experience.'}
Decision Date: ${dateStr}

Write an empathetic, uplifting 3-paragraph letter:
1. Warm appreciation for the time and preparation invested in our technical screening and proctored assessment.
2. Actionable, highly constructive developmental feedback: highlight 2 key areas where further hands-on experience or project depth will accelerate their technical mastery.
3. Encouragement for future growth, keeping their profile in the active talent network, and warm wishes.

Do not use markdown code fences. Format cleanly and professionally.`;

      const res = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Rejection feedback generation timed out')), 7000))
      ]);

      if (res.text && res.text.trim().length > 100) {
        return {
          title: `Application Update & Technical Feedback: ${jobTitle}`,
          date: dateStr,
          subject: `Thank you for interviewing with ${companyName} — Application Update`,
          body: res.text.trim(),
          generatedBy: 'AIRIS Developmental Gemini Engine'
        };
      }
    } catch (err) {
      console.warn('[DecisionEngine] Gemini feedback letter error:', err.message);
    }
  }

  // Fallback constructive letter
  const fallbackBody = `Dear ${candidateName},

Thank you sincerely for taking the time to interview with ${companyName} for the ${jobTitle} position, and for participating in our comprehensive technical assessment. We deeply value the effort, preparation, and thought you put into every question.

While your background in ${verifiedSkills.slice(0, 3).join(', ') || 'core software engineering'} is commendable, we have chosen to move forward with candidates whose current production experience more directly aligns with our immediate requirements in ${missingSkills.slice(0, 2).join(' and ') || 'distributed cloud systems architecture'}.

Constructive Growth Recommendations:
• Deepen hands-on implementation experience with ${missingSkills.slice(0, 3).join(', ') || 'advanced cloud native patterns and system design'}.
• Continue building and open-sourcing real-world microservice workloads that showcase resilience, telemetry, and automated testing.

${customNotes ? `Hiring Team Feedback:\n${customNotes}\n\n` : ''}We were genuinely impressed with your enthusiasm and problem-solving mindset. We will keep your profile in our preferred talent registry for future openings that match your skill trajectory. We wish you every success in your career journey.

Warm regards,

Talent Acquisition Team
${companyName}`;

  return {
    title: `Application Update & Technical Feedback: ${jobTitle}`,
    date: dateStr,
    subject: `Thank you for interviewing with ${companyName} — Application Update`,
    body: fallbackBody,
    generatedBy: 'AIRIS Developmental Template Engine'
  };
}

module.exports = {
  calculateCompositeHiringIndex,
  calibrateLevelingAndCompensation,
  generateOfferLetter,
  generateRejectionFeedback
};
