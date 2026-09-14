/**
 * Local Statistical Machine Learning: Item Response Theory (IRT) Adaptive Interview Engine
 * 
 * 100% In-Engine / Zero External API Calls.
 * Computes:
 *  - 2-Parameter Logistic (2PL) Item Response Theory Model: P(θ) = 1 / (1 + exp(-a * (θ - b)))
 *  - Dynamically updates candidate latent ability parameter (θ) after each response
 *  - Calibrates next technical question difficulty parameter (b) and discrimination parameter (a)
 *  - Dynamically branches candidates to Foundational, Senior, or Principal-level architectural questions
 */

// Calibrated question difficulty pool for technical domains
const TECHNICAL_QUESTION_BANK = [
  // Foundational Level (b = -1.2 to -0.2)
  {
    id: 'q_found_1',
    difficulty: -1.0, // b parameter
    discrimination: 1.2, // a parameter
    level: 'Foundational',
    targetArea: 'Data Structures & Core Concurrency',
    question: 'How do you handle asynchronous operations in Node.js event loops, and how do microtasks (Promises) differ from macrotasks (setTimeout)?',
    keyFocusPoints: ['Event Loop Phases', 'Microtask Queue Priority', 'Call Stack Execution']
  },
  {
    id: 'q_found_2',
    difficulty: -0.5,
    discrimination: 1.1,
    level: 'Foundational',
    targetArea: 'Database Indexing & Queries',
    question: 'Explain the difference between clustered and non-clustered indexes in relational databases, and when an index might degrade write performance.',
    keyFocusPoints: ['B-Tree Structure', 'Disk I/O and Lookups', 'Write Amplification Overhead']
  },
  // Intermediate Level (b = 0.0 to 0.8)
  {
    id: 'q_inter_1',
    difficulty: 0.3,
    discrimination: 1.5,
    level: 'Intermediate / Senior',
    targetArea: 'Caching & Data Consistency',
    question: 'Describe how you would design a cache-aside architecture using Redis. How do you prevent cache stampedes (thundering herd) and handle stale reads?',
    keyFocusPoints: ['Cache-Aside Invalidation', 'Probabilistic Early Expiration or Distributed Locks', 'Eventual Consistency']
  },
  {
    id: 'q_inter_2',
    difficulty: 0.7,
    discrimination: 1.6,
    level: 'Intermediate / Senior',
    targetArea: 'Microservice Resilience',
    question: 'In a distributed microservice topology, how do you implement circuit breaking and exponential backoff to stop cascading service outages?',
    keyFocusPoints: ['Half-Open State Transitions', 'Jittered Exponential Backoff', 'Fallback Mechanisms']
  },
  // Principal / Staff Level (b = 1.2 to 2.2)
  {
    id: 'q_princ_1',
    difficulty: 1.4,
    discrimination: 1.8,
    level: 'Principal / Staff',
    targetArea: 'Distributed Systems & Event Sourcing',
    question: 'How would you architect a globally distributed financial transaction ledger using CQRS and Event Sourcing while guaranteeing idempotency and linearizability?',
    keyFocusPoints: ['Raft/Paxos Consensus or Dynamo Topology', 'Idempotency Keys & Deduplication', 'Optimistic Locking & Outbox Pattern']
  },
  {
    id: 'q_princ_2',
    difficulty: 1.8,
    discrimination: 2.0,
    level: 'Principal / Staff',
    targetArea: 'High-Throughput Multi-Region Consensus',
    question: 'Discuss trade-offs between Multi-Raft partitioning and Spanner TrueTime-based commit wait protocols when scaling cross-region write throughput.',
    keyFocusPoints: ['TrueTime Uncertainty Bounds', 'Two-Phase Commit Overhead', 'Partition Availability vs Latency']
  }
];

/**
 * 2PL Probability of correct/exceptional response given ability θ
 */
function probability2PL(theta, a, b) {
  return 1 / (1 + Math.exp(-a * (theta - b)));
}

/**
 * Estimate new candidate latent ability (θ) using Maximum Likelihood / Newton-Raphson step
 * 
 * @param {number} currentTheta Current estimated ability (-3.0 to +3.0)
 * @param {Array<{ difficulty: number, discrimination: number, scoreRatio: number }>} history 
 * @returns {number} updated θ ability estimate
 */
function estimateLatentAbility(currentTheta = 0.0, history = []) {
  if (!history || history.length === 0) return 0.0;

  let theta = currentTheta;
  // Perform 3 iterations of Newton-Raphson optimization
  for (let iter = 0; iter < 3; iter++) {
    let dL = 0; // First derivative of log likelihood
    let d2L = 0; // Second derivative

    for (const item of history) {
      const p = probability2PL(theta, item.discrimination, item.difficulty);
      const q = 1 - p;
      const u = item.scoreRatio; // Observed score [0.0 - 1.0]

      dL += item.discrimination * (u - p);
      d2L -= Math.pow(item.discrimination, 2) * p * q;
    }

    if (Math.abs(d2L) > 1e-4) {
      const delta = dL / d2L;
      theta = theta - delta;
      // Clamp theta between -3.0 (Junior) and +3.0 (Principal)
      theta = Math.max(-3.0, Math.min(3.0, theta));
    }
  }

  return Math.round(theta * 100) / 100;
}

/**
 * Select the optimal next technical question maximizing Fisher Information at candidate ability θ
 * 
 * @param {number} candidateTheta Current candidate ability
 * @param {Array<string>} answeredQuestionIds IDs already asked
 * @returns {Object} Selected question with difficulty metrics and adaptive trajectory
 */
function selectNextAdaptiveQuestion(candidateTheta = 0.0, answeredQuestionIds = []) {
  const answeredSet = new Set(answeredQuestionIds);
  const eligible = TECHNICAL_QUESTION_BANK.filter(q => !answeredSet.has(q.id));

  if (eligible.length === 0) {
    return TECHNICAL_QUESTION_BANK[0];
  }

  // Fisher Information in 2PL: I(θ) = a^2 * P(θ) * Q(θ)
  let bestQuestion = eligible[0];
  let maxInformation = -1;

  for (const q of eligible) {
    const p = probability2PL(candidateTheta, q.discrimination, q.difficulty);
    const information = Math.pow(q.discrimination, 2) * p * (1 - p);
    if (information > maxInformation) {
      maxInformation = information;
      bestQuestion = q;
    }
  }

  // Determine trajectory tier name
  let tierLabel = 'Standard Engineering';
  if (candidateTheta > 1.2) {
    tierLabel = 'Advanced Principal / Architectural Track';
  } else if (candidateTheta > 0.2) {
    tierLabel = 'Senior Systems Engineering Track';
  } else {
    tierLabel = 'Core Foundations Track';
  }

  return {
    ...bestQuestion,
    adaptiveMetadata: {
      candidateAbilityTheta: candidateTheta,
      fisherInformationScore: Math.round(maxInformation * 100) / 100,
      adaptiveTier: tierLabel,
      engine: 'AIRIS 2PL Item Response Theory (IRT) Adaptive Engine'
    }
  };
}

module.exports = {
  TECHNICAL_QUESTION_BANK,
  estimateLatentAbility,
  selectNextAdaptiveQuestion,
  probability2PL
};
