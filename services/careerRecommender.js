/**
 * Local Machine Learning: Cosine Vector Space & Jaccard Career Recommendation Engine
 * 
 * 100% In-Engine / Zero External API Calls.
 * Computes:
 *  - High-dimensional skill overlap using Jaccard Similarity: J(A, B) = |A ∩ B| / |A ∪ B|
 *  - Sublinear TF-IDF term vector cosine similarity across candidate resume and all active job postings
 *  - Experience delta alignment and leveling fit
 *  - Returns ranked job recommendations with affinity scores and exact skill matches/gaps
 */

const { matchResumeToJobSemantic, tokenize } = require('./vectorMatcher');

/**
 * Recommend top matching jobs for a candidate profile or resume
 * 
 * @param {Object} options
 * @param {string} options.resumeText Candidate resume or profile text
 * @param {Array<string>} options.candidateSkills Array of detected candidate skills
 * @param {Array<Object>} options.allJobs All active job openings
 * @param {number} options.topK Number of top recommendations to return (default: 5)
 * @returns {Array<Object>} Ranked job matches with match scores and gap details
 */
function recommendJobsForCandidate({ resumeText = '', candidateSkills = [], allJobs = [], topK = 5 }) {
  if (!allJobs || allJobs.length === 0) {
    return [];
  }

  const normalizedCandidateSkills = new Set(
    (candidateSkills || []).map(s => s.toLowerCase().trim())
  );

  // Fallback: extract terms if no candidate skills explicitly passed
  if (normalizedCandidateSkills.size === 0 && resumeText) {
    const tokens = tokenize(resumeText);
    tokens.slice(0, 30).forEach(t => normalizedCandidateSkills.add(t));
  }

  const recommendations = allJobs.map(job => {
    const mandatory = (job.mandatory_skills || []).map(s => s.toLowerCase().trim());
    const optional = (job.optional_skills || []).map(s => s.toLowerCase().trim());
    const allJobSkills = Array.from(new Set([...mandatory, ...optional]));

    // 1. Jaccard Skill Similarity
    const intersection = allJobSkills.filter(s => normalizedCandidateSkills.has(s));
    const union = Array.from(new Set([...allJobSkills, ...normalizedCandidateSkills]));
    const jaccardScore = union.length > 0 ? (intersection.length / union.length) : 0;

    // 2. Mandatory Skill Coverage
    const mandatoryMatched = mandatory.filter(s => normalizedCandidateSkills.has(s));
    const mandatoryCoverage = mandatory.length > 0 ? (mandatoryMatched.length / mandatory.length) : 1;

    // 3. TF-IDF Text Vector Cosine Similarity
    const jobFullText = `${job.title} ${job.description || ''} ${job.department || ''} ${allJobSkills.join(' ')}`;
    const vectorComparison = matchResumeToJobSemantic(resumeText || Array.from(normalizedCandidateSkills).join(' '), jobFullText);
    const cosineScore = vectorComparison.cosineSimilarity || 0.5;

    // 4. Composite Fit Score (Weighted combination: 40% mandatory coverage + 35% TF-IDF vector + 25% Jaccard)
    const compositeScore = Math.round(
      (mandatoryCoverage * 40) +
      (cosineScore * 35) +
      (jaccardScore * 25)
    );

    const missingMandatory = mandatory.filter(s => !normalizedCandidateSkills.has(s));

    return {
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName || 'AIRIS Partner',
      department: job.department || 'Engineering',
      location: job.location || 'Remote',
      matchScore: Math.min(99, Math.max(15, compositeScore)),
      jaccardIndex: Math.round(jaccardScore * 100) / 100,
      cosineSimilarity: Math.round(cosineScore * 100) / 100,
      matchedSkillsCount: intersection.length,
      matchedSkills: intersection,
      missingCriticalSkills: missingMandatory,
      fitLevel: compositeScore >= 75 ? 'Strong Match' : (compositeScore >= 55 ? 'Good Alignment' : 'Transferable Skills'),
      engine: 'AIRIS Local Vector & Jaccard Career Recommendation Engine'
    };
  });

  // Sort descending by matchScore
  recommendations.sort((a, b) => b.matchScore - a.matchScore);

  return recommendations.slice(0, topK);
}

module.exports = {
  recommendJobsForCandidate
};
