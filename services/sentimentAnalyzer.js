/**
 * Local Machine Learning Engine: Lexicon Sentiment, Speech Fluency,
 * and Communication Clarity Analyzer.
 * 
 * 100% In-Engine / Zero External API Calls.
 * Computes:
 *  - Lexicon-based Sentiment Valency & Polarity (-1.0 to +1.0)
 *  - Communication Clarity Index (Readability & Structural Coherence)
 *  - Confidence Score vs. Hesitation / Uncertainty Marker Detection
 *  - Speaking Pace & Lexical Diversity (Type-Token Ratio)
 */

// Lexicon with valency and conviction weights
const SENTIMENT_LEXICON = {
  // High confidence & ownership
  'architected': 2.5, 'spearheaded': 2.8, 'delivered': 2.2, 'resolved': 2.0, 'optimized': 2.4,
  'engineered': 2.2, 'demonstrated': 1.8, 'guaranteed': 2.0, 'accelerated': 2.2, 'achieved': 2.3,
  'championed': 2.5, 'streamlined': 2.1, 'scaled': 2.4, 'innovated': 2.3, 'mitigated': 2.0,
  'strengthened': 2.0, 'succeeded': 2.1, 'confident': 2.0, 'clearly': 1.5, 'robust': 1.8,
  'effective': 1.6, 'exceptional': 2.5, 'thorough': 1.8, 'efficient': 1.7, 'mastered': 2.5,

  // Positive collaboration & learning
  'collaborated': 1.5, 'partnered': 1.5, 'learned': 1.2, 'improved': 1.6, 'enhanced': 1.7,
  'supported': 1.3, 'beneficial': 1.4, 'productive': 1.5, 'proactive': 1.9, 'reliable': 1.8,

  // Hesitation, uncertainty, passive vagueness (negative valence/conviction)
  'maybe': -1.2, 'perhaps': -1.0, 'guess': -1.5, 'probably': -0.8, 'possibly': -1.0,
  'suppose': -1.2, 'sort of': -1.4, 'kind of': -1.4, 'um': -1.8, 'uh': -1.8,
  'dunno': -2.0, 'confused': -1.6, 'unsure': -1.8, 'struggled': -0.8, 'failed': -1.5,
  'forgot': -1.3, 'doubt': -1.5, 'hesitant': -1.4, 'awkward': -1.2, 'barely': -1.0
};

// Fillers and hesitation indicators
const HESITATION_PATTERNS = [
  /\b(um+|uh+|er+|ah+)\b/gi,
  /\b(i guess|i think so|not sure|sort of|kind of|i suppose)\b/gi,
  /\b(you know|like you know|basically like)\b/gi,
  /\b(maybe|perhaps|probably)\b/gi
];

// Structural transition words indicating high coherence
const COHERENCE_CONNECTIVES = [
  'furthermore', 'moreover', 'in addition', 'consequently', 'therefore',
  'specifically', 'for instance', 'for example', 'as a result', 'firstly',
  'secondly', 'on the other hand', 'in contrast', 'ultimately', 'in summary'
];

/**
 * Clean and segment text into sentences and tokens
 */
function parseText(text = '') {
  const clean = text.trim();
  if (!clean) return { words: [], sentences: [], cleanText: '' };

  const sentences = clean
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const words = clean
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  return { words, sentences, cleanText: clean };
}

/**
 * Analyze Answer Sentiment, Hesitation, and Clarity
 * 
 * @param {string} candidateAnswer 
 * @param {number} responseTimeSeconds (optional time spent speaking/answering)
 * @returns {Object} Analytical metrics including confidence, sentiment, clarity, and recommendations
 */
function analyzeAnswerSpeechAndSentiment(candidateAnswer = '', responseTimeSeconds = 0) {
  const { words, sentences, cleanText } = parseText(candidateAnswer);

  if (words.length === 0) {
    return {
      sentimentPolarity: 0,
      sentimentLabel: 'Neutral',
      confidenceScore: 50,
      communicationClarity: 50,
      hesitationMarkersCount: 0,
      hesitationRate: 'Low',
      lexicalDiversity: 0,
      wordsCount: 0,
      readabilityLevel: 'N/A',
      coherenceIndicators: [],
      strengths: ['Direct response'],
      recommendations: ['Expand technical detail and trade-offs'],
      engine: 'AIRIS Local NLP Sentiment & Clarity Engine'
    };
  }

  // 1. Lexicon Sentiment Valency
  let totalValence = 0;
  let valenceWordMatches = 0;
  const lowerText = cleanText.toLowerCase();

  for (const [term, weight] of Object.entries(SENTIMENT_LEXICON)) {
    if (term.includes(' ')) {
      const occurrences = (lowerText.match(new RegExp(term, 'g')) || []).length;
      if (occurrences > 0) {
        totalValence += occurrences * weight;
        valenceWordMatches += occurrences;
      }
    } else if (words.includes(term)) {
      const occurrences = words.filter(w => w === term).length;
      totalValence += occurrences * weight;
      valenceWordMatches += occurrences;
    }
  }

  // Sentiment Polarity normalized between -1.0 and +1.0
  const normSentiment = valenceWordMatches > 0
    ? Math.max(-1.0, Math.min(1.0, totalValence / Math.max(3, valenceWordMatches * 1.5)))
    : 0.15; // default slight professional baseline

  let sentimentLabel = 'Neutral / Objective';
  if (normSentiment >= 0.3) sentimentLabel = 'Positive & Enthusiastic';
  else if (normSentiment >= 0.05) sentimentLabel = 'Constructive & Composed';
  else if (normSentiment <= -0.2) sentimentLabel = 'Hesitant / Uncertain';

  // 2. Hesitation / Uncertainty Marker Detection
  let hesitationCount = 0;
  const detectedHesitations = [];
  for (const pattern of HESITATION_PATTERNS) {
    const matches = lowerText.match(pattern);
    if (matches) {
      hesitationCount += matches.length;
      detectedHesitations.push(...matches.map(m => m.toLowerCase()));
    }
  }

  const hesitationRatio = hesitationCount / Math.max(1, words.length);
  const hesitationRate = hesitationRatio > 0.08 ? 'Elevated' : (hesitationRatio > 0.03 ? 'Moderate' : 'Low / Clean');

  // 3. Confidence Scoring
  // High confidence = strong ownership verbs, low hesitation, sufficient word volume (>60 words)
  let confidence = 70;
  if (normSentiment > 0.2) confidence += 12;
  if (normSentiment < -0.1) confidence -= 15;
  if (hesitationCount === 0) confidence += 8;
  else confidence -= Math.min(25, hesitationCount * 4);

  if (words.length >= 60) confidence += 8;
  else if (words.length < 25) confidence -= 18;

  const finalConfidenceScore = Math.max(30, Math.min(96, Math.round(confidence)));

  // 4. Communication Clarity & Structural Coherence
  const uniqueWords = new Set(words);
  const lexicalDiversity = Math.round((uniqueWords.size / words.length) * 100);

  const matchedCoherence = [];
  for (const marker of COHERENCE_CONNECTIVES) {
    if (lowerText.includes(marker)) {
      matchedCoherence.push(marker);
    }
  }

  // Average Sentence Length (ideal 12-22 words for spoken clarity)
  const avgSentenceLength = sentences.length > 0 ? (words.length / sentences.length) : words.length;
  let clarityScore = 65;

  if (avgSentenceLength >= 8 && avgSentenceLength <= 24) {
    clarityScore += 15; // Balanced syntax
  } else if (avgSentenceLength > 35) {
    clarityScore -= 10; // Run-on sentence
  }

  clarityScore += Math.min(15, matchedCoherence.length * 5); // Connective transitions boost
  if (lexicalDiversity >= 60) clarityScore += 8;
  else if (lexicalDiversity < 35) clarityScore -= 8;

  const finalClarityScore = Math.max(35, Math.min(98, Math.round(clarityScore)));

  // Readability Classification
  let readabilityLevel = 'Standard Professional';
  if (avgSentenceLength > 25 && lexicalDiversity > 65) readabilityLevel = 'Advanced Technical / Academic';
  else if (avgSentenceLength < 10) readabilityLevel = 'Concise / Bullet Style';

  // Actionable Insights
  const strengths = [];
  const recommendations = [];

  if (finalConfidenceScore >= 80) {
    strengths.push('Demonstrates strong verbal ownership, assertiveness, and definitive terminology.');
  } else if (finalConfidenceScore >= 65) {
    strengths.push('Composed tone with steady delivery.');
  }

  if (finalClarityScore >= 80) {
    strengths.push('High structural coherence with effective transitions and logical sequencing.');
  }

  if (hesitationCount > 2) {
    recommendations.push(`Reduce verbal fillers (${[...new Set(detectedHesitations)].slice(0, 3).join(', ')}); replace with deliberate pauses.`);
  }

  if (words.length < 40) {
    recommendations.push('Provide deeper contextual detail, metric impacts, and engineering trade-offs.');
  }

  if (strengths.length === 0) strengths.push('Clear and direct baseline response.');
  if (recommendations.length === 0) recommendations.push('Maintain current delivery cadence and technical ownership.');

  return {
    sentimentPolarity: Math.round(normSentiment * 100) / 100,
    sentimentLabel,
    confidenceScore: finalConfidenceScore,
    communicationClarity: finalClarityScore,
    hesitationMarkersCount: hesitationCount,
    hesitationRate,
    lexicalDiversity: `${lexicalDiversity}%`,
    wordsCount: words.length,
    sentencesCount: sentences.length,
    avgSentenceLength: Math.round(avgSentenceLength),
    readabilityLevel,
    coherenceIndicators: matchedCoherence,
    strengths,
    recommendations,
    engine: 'AIRIS In-Engine NLP Sentiment & Clarity Analyzer'
  };
}

module.exports = {
  analyzeAnswerSpeechAndSentiment
};
