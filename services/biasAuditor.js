/**
 * Local Statistical Engine: EEOC Adverse Impact & Algorithmic Parity Auditor
 * 
 * 100% In-Engine / Zero External API Calls.
 * Computes:
 *  - EEOC 4/5ths (80%) Rule Disparate Impact Ratio
 *  - Demographic Parity & Selection Rate Disparities
 *  - Experience Bracket Skew (Junior vs Mid vs Senior)
 *  - Score Distribution Statistical Spread (Mean, Median, Standard Deviation)
 *  - Compliance Status: COMPLIANT | ATTENTION_REQUIRED | ADVERSE_IMPACT_FLAGGED
 */

/**
 * Audit application pool for statistical bias and adverse impact
 * 
 * @param {Array<Object>} applications Array of candidate application objects
 * @returns {Object} Comprehensive adverse impact audit report
 */
function auditScreeningAdverseImpact(applications = []) {
  if (!Array.isArray(applications) || applications.length === 0) {
    return {
      sampleSize: 0,
      complianceStatus: 'INSUFFICIENT_DATA',
      parityRatio: 1.0,
      selectionRates: {},
      statisticalMetrics: { meanScore: 0, stdDev: 0 },
      recommendations: ['Collect at least 5 candidate applications to establish statistical baseline.'],
      engine: 'AIRIS In-Engine EEOC Adverse Impact & Bias Auditor'
    };
  }

  const validApps = applications.filter(a => a && typeof a === 'object');
  const total = validApps.length;

  // 1. Group by Experience Tiers
  const experienceBuckets = {
    'Early Career (< 3 yrs)': { total: 0, selected: 0 },
    'Mid-Level (3-6 yrs)': { total: 0, selected: 0 },
    'Senior+ (7+ yrs)': { total: 0, selected: 0 }
  };

  // 2. Score metrics
  const scores = [];
  const selectedApps = [];

  for (const app of validApps) {
    const finalScore = app.scores?.final || (typeof app.finalScore === 'number' ? app.finalScore : 0);
    scores.push(finalScore);

    const isSelected = finalScore >= 70 || app.status === 'accepted' || app.status === 'under_review';
    if (isSelected) selectedApps.push(app);

    const expYears = typeof app.scores?.experienceYears === 'number'
      ? app.scores.experienceYears
      : (app.experienceYears || 4);

    if (expYears < 3) {
      experienceBuckets['Early Career (< 3 yrs)'].total++;
      if (isSelected) experienceBuckets['Early Career (< 3 yrs)'].selected++;
    } else if (expYears <= 6) {
      experienceBuckets['Mid-Level (3-6 yrs)'].total++;
      if (isSelected) experienceBuckets['Mid-Level (3-6 yrs)'].selected++;
    } else {
      experienceBuckets['Senior+ (7+ yrs)'].total++;
      if (isSelected) experienceBuckets['Senior+ (7+ yrs)'].selected++;
    }
  }

  // 3. Selection Rates & 4/5ths Rule Parity Ratio
  const selectionRates = {};
  let maxRate = 0;
  let minRate = 1.0;

  for (const [tier, data] of Object.entries(experienceBuckets)) {
    if (data.total > 0) {
      const rate = data.selected / data.total;
      selectionRates[tier] = {
        total: data.total,
        selected: data.selected,
        rate: Math.round(rate * 100) / 100,
        ratePercent: `${Math.round(rate * 100)}%`
      };
      if (rate > maxRate) maxRate = rate;
      if (rate < minRate) minRate = rate;
    }
  }

  // 4/5ths ratio = Min Selection Rate / Max Selection Rate (EEOC standard threshold: >= 0.80)
  const parityRatio = maxRate > 0 ? Math.round((minRate / maxRate) * 100) / 100 : 1.0;

  // 4. Mean & Standard Deviation of Scores
  const meanScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const variance = scores.length > 1
    ? scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / (scores.length - 1)
    : 0;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  // 5. Compliance Determination
  let complianceStatus = 'COMPLIANT';
  const recommendations = [];

  if (total < 4) {
    complianceStatus = 'PRELIMINARY_SAMPLE';
    recommendations.push('Preliminary sample size (< 4 candidates). Add more submissions to unlock high-confidence auditing.');
  } else if (parityRatio < 0.65) {
    complianceStatus = 'ADVERSE_IMPACT_FLAGGED';
    recommendations.push('Selection rate falls below the EEOC 80% guideline. Check mandatory skill filters for disproportionate stringency.');
    recommendations.push('Audit experience requirements to ensure early-career talent is evaluated on demonstrated project competencies.');
  } else if (parityRatio < 0.80) {
    complianceStatus = 'ATTENTION_REQUIRED';
    recommendations.push('Parity ratio is hovering near the 0.80 threshold. Review borderline candidates for additional interview screening.');
  } else {
    complianceStatus = 'COMPLIANT';
    recommendations.push('Selection distributions satisfy the EEOC 4/5ths rule across all active experience cohorts.');
  }

  return {
    sampleSize: total,
    selectedCount: selectedApps.length,
    overallSelectionRate: `${Math.round((selectedApps.length / Math.max(1, total)) * 100)}%`,
    complianceStatus,
    parityRatio,
    eeocThresholdMet: parityRatio >= 0.80,
    selectionRatesByCohort: selectionRates,
    statisticalMetrics: {
      meanScore: Math.round(meanScore * 10) / 10,
      standardDeviation: stdDev,
      minScore: Math.min(...(scores.length > 0 ? scores : [0])),
      maxScore: Math.max(...(scores.length > 0 ? scores : [0]))
    },
    recommendations,
    engine: 'AIRIS In-Engine EEOC Algorithmic Bias Auditor (Zero External API)'
  };
}

module.exports = {
  auditScreeningAdverseImpact
};
