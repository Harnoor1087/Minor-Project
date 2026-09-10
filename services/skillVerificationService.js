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
    console.warn('[SkillVerificationService] Gemini init fallback:', err.message);
    return null;
  }
}

/**
 * Built-in Curated Question Bank
 * Designed specifically to detect keyword-stuffing vs practical competency.
 * Tests realistic problem scenarios, syntax output, and architectural tradeoffs.
 */
const QUESTION_BANK = {
  python: [
    {
      id: 'py_1',
      skill: 'python',
      question: 'What is the output of the following Python snippet?\n\n```python\na = [1, 2, 3]\nb = a\nb.append(4)\nprint(len(a))\n```',
      options: ['3', '4', 'Throws TypeError', 'None'],
      correctIndex: 1,
      explanation: 'In Python, lists are mutable references. `b = a` assigns the reference to the same list in memory, so appending to `b` alters `a` as well.'
    },
    {
      id: 'py_2',
      skill: 'python',
      question: 'In Python, how does a generator function differ fundamentally from a standard function returning a list?',
      options: [
        'Generators can only yield strings, while standard functions return any type.',
        'Generators use `yield` to lazily produce values on-demand, consuming O(1) memory instead of holding the entire collection in RAM.',
        'Generators run in a separate operating system thread by default.',
        'Generators cannot accept arguments.'
      ],
      correctIndex: 1,
      explanation: 'Generators yield values one at a time using lazy evaluation, maintaining state with minimal memory footprint.'
    },
    {
      id: 'py_3',
      skill: 'python',
      question: 'What does the `@functools.wraps` decorator do when writing custom Python decorators?',
      options: [
        'It speeds up execution of the decorated function by 2x.',
        'It preserves the original function metadata such as __name__, __doc__, and annotations.',
        'It automatically executes the function asynchronously.',
        'It catches and suppresses all runtime exceptions.'
      ],
      correctIndex: 1,
      explanation: '`@wraps` copies the original function’s docstring, name, and attributes onto the wrapper function.'
    },
    {
      id: 'py_4',
      skill: 'python',
      question: 'Which statement correctly describes the Python Global Interpreter Lock (GIL)?',
      options: [
        'It prevents any multi-threaded program from executing in CPython.',
        'It is a mutex that prevents multiple native OS threads from executing Python bytecodes simultaneously in CPython.',
        'It speeds up CPU-bound tasks across multiple CPU cores.',
        'It is only present in PyPy and Jython, not standard CPython.'
      ],
      correctIndex: 1,
      explanation: 'The GIL in CPython ensures thread-safety by allowing only one thread to execute Python bytecode at a time, making multiprocessing preferable for CPU-bound tasks.'
    }
  ],

  javascript: [
    {
      id: 'js_1',
      skill: 'javascript',
      question: 'What is printed to the console?\n\n```javascript\nconsole.log(typeof null);\nconsole.log([] == false);\n```',
      options: [
        '"null" and false',
        '"object" and true',
        '"undefined" and true',
        '"object" and false'
      ],
      correctIndex: 1,
      explanation: '`typeof null` historically returns "object". An empty array `[]` coerces to `""` which coerces to `0`, matching `false` (0).'
    },
    {
      id: 'js_2',
      skill: 'javascript',
      question: 'What is the key difference between microtasks (e.g., Promise callbacks) and macrotasks (e.g., setTimeout) in the Node.js / Browser Event Loop?',
      options: [
        'Macrotasks always execute before microtasks in every cycle.',
        'The microtask queue is completely drained after the current script and between each macrotask phase.',
        'Microtasks are dispatched directly to the OS kernel thread pool.',
        'Promises are executed on separate CPU worker threads.'
      ],
      correctIndex: 1,
      explanation: 'Microtasks (Promises, process.nextTick) have higher priority and drain completely before the event loop advances to the next macrotask.'
    },
    {
      id: 'js_3',
      skill: 'javascript',
      question: 'In JavaScript closures, what occurs when an inner function accesses a variable from an outer scope?',
      options: [
        'A copy of the variable value is made at compile time.',
        'The inner function maintains a lexical reference to the outer variable environment even after the outer function has finished executing.',
        'The outer variable is converted into a global window property.',
        'The variable is garbage-collected immediately.'
      ],
      correctIndex: 1,
      explanation: 'Closures retain access to their outer lexical scope variables by reference even after the enclosing scope has returned.'
    }
  ],

  nodejs: [
    {
      id: 'node_1',
      skill: 'nodejs',
      question: 'In Express.js middleware, what happens if you do NOT call `next()` or return a response (e.g., `res.send()`)?',
      options: [
        'Express immediately returns an HTTP 200 OK status.',
        'The client HTTP request hangs until it hits a socket timeout.',
        'Express automatically throws an unhandled exception.',
        'The request automatically falls through to the next route.'
      ],
      correctIndex: 1,
      explanation: 'Express middleware chains require either passing control to the next handler with `next()` or terminating with a response. Failing to do either leaves the request hanging.'
    },
    {
      id: 'node_2',
      skill: 'nodejs',
      question: 'Why should CPU-intensive operations (like heavy cryptographic loops or massive JSON parsing) be avoided on the main Node.js thread?',
      options: [
        'Node.js does not support CPU architectures.',
        'Because Node.js has a single main event loop thread; blocking it blocks all incoming HTTP requests and I/O for all concurrent users.',
        'CPU operations are automatically killed by V8 after 50ms.',
        'Node.js automatically allocates 16 worker threads for every loop.'
      ],
      correctIndex: 1,
      explanation: 'Because JavaScript execution runs on a single event-loop thread, long synchronous operations starve the loop and freeze throughput.'
    }
  ],

  sql: [
    {
      id: 'sql_1',
      skill: 'sql',
      question: 'What is the primary difference between `WHERE` and `HAVING` clauses in SQL?',
      options: [
        '`WHERE` filters rows before any grouping occurs, while `HAVING` filters aggregated group results after `GROUP BY`.',
        '`HAVING` is used exclusively for primary keys; `WHERE` is for foreign keys.',
        '`WHERE` can only be used with `SELECT *`; `HAVING` can be used with subqueries.',
        'There is no functional difference; they are interchangeable.'
      ],
      correctIndex: 0,
      explanation: '`WHERE` filters individual table rows prior to aggregation; `HAVING` applies conditions to grouped/aggregated summary rows.'
    },
    {
      id: 'sql_2',
      skill: 'sql',
      question: 'What does an `INNER JOIN` return when comparing two tables on a foreign key?',
      options: [
        'All rows from the left table and only matching rows from the right table.',
        'Only rows where there is an exact match in both joined tables.',
        'All rows from both tables, filling nulls where no match exists.',
        'Only rows that have no matching records.'
      ],
      correctIndex: 1,
      explanation: 'An `INNER JOIN` produces the intersection of rows where the join predicate evaluates to true for both tables.'
    },
    {
      id: 'sql_3',
      skill: 'sql',
      question: 'In database transactions, what does the "I" in ACID stand for and guarantee?',
      options: [
        'Indexing: Guarantees B-Tree indexes are rebuilt on commit.',
        'Isolation: Ensures concurrent transactions execute without interfering with one another or seeing uncommitted dirty data (depending on isolation level).',
        'Idempotence: Guarantees running the query twice yields the same result.',
        'Integrity: Prevents null columns from being queried.'
      ],
      correctIndex: 1,
      explanation: 'Isolation guarantees that transactions execute independently without concurrency hazards such as dirty reads or lost updates.'
    }
  ],

  'machine learning': [
    {
      id: 'ml_1',
      skill: 'machine learning',
      question: 'If a machine learning model achieves 99.8% accuracy on training data but drops to 61.2% on validation/test data, what phenomenon is occurring?',
      options: [
        'High bias (Underfitting)',
        'High variance (Overfitting)',
        'Data drift in the training labels',
        'Vanishing gradient problem'
      ],
      correctIndex: 1,
      explanation: 'High training accuracy paired with poor generalization on unseen validation data is the classic hallmark of overfitting / high variance.'
    },
    {
      id: 'ml_2',
      skill: 'machine learning',
      question: 'In a medical cancer detection model where failing to detect cancer (False Negative) is catastrophic, which metric should be prioritized over overall accuracy?',
      options: [
        'Specificity',
        'Recall (Sensitivity)',
        'Precision',
        'L2 Regularization Loss'
      ],
      correctIndex: 1,
      explanation: 'Recall measures the proportion of actual positives correctly identified (TP / (TP + FN)), minimizing dangerous false negatives.'
    },
    {
      id: 'ml_3',
      skill: 'machine learning',
      question: 'What is the primary role of an embedding model in Modern NLP and LLM systems?',
      options: [
        'Compiling Python code into C binaries for faster execution.',
        'Converting discrete textual tokens into continuous, dense high-dimensional semantic vectors where similar meanings are close in vector space.',
        'Decrypting user passwords before database storage.',
        'Translating English text directly into SQL statements without an LLM.'
      ],
      correctIndex: 1,
      explanation: 'Embeddings map text tokens into dense continuous vector representations capturing semantic relationships.'
    }
  ],

  nlp: [
    {
      id: 'nlp_1',
      skill: 'nlp',
      question: 'What is the purpose of Tokenization in Natural Language Processing pipelines?',
      options: [
        'Encrypting sensitive patient data in accordance with HIPAA.',
        'Splitting raw character streams into discrete linguistic units (words, subwords, or characters) that can be mapped to numerical IDs.',
        'Generating automated voice synthesis waveforms.',
        'Correcting grammatical spelling errors automatically.'
      ],
      correctIndex: 1,
      explanation: 'Tokenization breaks unstructured text into numerical subword/word tokens that models can process.'
    }
  ],

  docker: [
    {
      id: 'dock_1',
      skill: 'docker',
      question: 'How do Docker containers differ fundamentally from traditional Virtual Machines (VMs)?',
      options: [
        'Containers bundle a complete guest operating system and virtualized hardware kernel; VMs do not.',
        'Containers share the host operating system kernel and isolate processes via Linux namespaces and cgroups, making them much lighter and faster than VMs.',
        'Containers can only run Python applications, whereas VMs run any software.',
        'Containers require hardware CPU VT-x virtualization enabled in BIOS, whereas VMs do not.'
      ],
      correctIndex: 1,
      explanation: 'Containers share the host kernel and isolate processes via namespaces and cgroups rather than emulating full virtualized hardware.'
    },
    {
      id: 'dock_2',
      skill: 'docker',
      question: 'Why should `COPY package.json .` and `npm install` be placed before `COPY . .` in a Node.js Dockerfile?',
      options: [
        'Because npm refuses to install if other files are present.',
        'To leverage Docker layer caching so npm dependencies are not reinstalled unless package.json actually changed.',
        'To prevent source code files from being encrypted.',
        'It is required syntax; Docker errors out otherwise.'
      ],
      correctIndex: 1,
      explanation: 'Docker caches unchanged layers. Placing dependency installation before application source files prevents slow reinstallations on every source code edit.'
    }
  ],

  kubernetes: [
    {
      id: 'k8s_1',
      skill: 'kubernetes',
      question: 'What is a Pod in Kubernetes?',
      options: [
        'A physical server rack inside a datacenter.',
        'The smallest deployable computing unit in Kubernetes, representing one or more tightly coupled containers sharing storage and network IP.',
        'A load balancer IP address provided by AWS.',
        'A Git repository containing deployment charts.'
      ],
      correctIndex: 1,
      explanation: 'A Pod wraps one or more co-located containers that share storage, IP address, and port space.'
    }
  ],

  aws: [
    {
      id: 'aws_1',
      skill: 'aws',
      question: 'What is the recommended IAM security best practice when granting an EC2 instance access to read from an S3 bucket?',
      options: [
        'Hardcode the root AWS account Access Key and Secret Key into the application configuration.',
        'Assign an IAM Role with least-privilege S3 read permissions directly to the EC2 instance via an instance profile.',
        'Make the S3 bucket completely public.',
        'Commit the AWS credentials file into the company GitHub repository.'
      ],
      correctIndex: 1,
      explanation: 'IAM Roles provide temporary, automatically rotated STS credentials to EC2 instances without storing permanent keys in code.'
    }
  ],

  react: [
    {
      id: 'react_1',
      skill: 'react',
      question: 'What happens if you update a state variable in React using mutating syntax instead of the setter (e.g., `state.count = 5` instead of `setCount(5)`)?',
      options: [
        'React immediately re-renders the component with the new value.',
        'React will NOT trigger a re-render because object identity did not change and no dispatch action was registered.',
        'React throws a compile-time syntax error.',
        'The browser tab reloads automatically.'
      ],
      correctIndex: 1,
      explanation: 'React detects state changes via Object.is equality comparisons triggered through setter functions. Direct mutation fails to trigger re-renders.'
    },
    {
      id: 'react_2',
      skill: 'react',
      question: 'What is the purpose of the dependency array in `useEffect(() => { ... }, [deps])`?',
      options: [
        'It defines which CSS stylesheets to download.',
        'It tells React to only re-run the effect if at least one of the values in the dependency array has changed between renders.',
        'It makes the effect run every 100 milliseconds.',
        'It exports the component state to external modules.'
      ],
      correctIndex: 1,
      explanation: 'React compares dependency array items by reference across renders to decide whether to re-execute the effect.'
    }
  ],

  'c++': [
    {
      id: 'cpp_1',
      skill: 'c++',
      question: 'What is RAII (Resource Acquisition Is Initialization) in modern C++?',
      options: [
        'A compiler flag that enables aggressive multithreading.',
        'A programming idiom where resource lifetime (memory, file handles, locks) is strictly bound to object lifetime via constructors and destructors.',
        'An algorithm for reversing strings in memory.',
        'A deprecated legacy feature from C89.'
      ],
      correctIndex: 1,
      explanation: 'RAII binds resource management to object scope: acquiring in constructor and automatically releasing in destructor, preventing memory leaks.'
    }
  ],

  git: [
    {
      id: 'git_1',
      skill: 'git',
      question: 'What is the primary difference between `git merge` and `git rebase`?',
      options: [
        '`git merge` deletes commits; `git rebase` duplicates the branch.',
        '`git merge` creates a new merge commit combining history, while `git rebase` re-applies commits onto the tip of another branch for a linear history.',
        '`git rebase` can only be performed by repository administrators.',
        'There is no difference; they are alias commands.'
      ],
      correctIndex: 1,
      explanation: 'Merge preserves exact historical chronology with a dedicated merge commit, while rebase rewrites commit history linearly.'
    }
  ]
};

/**
 * Normalizes a skill string (e.g., "Node.JS", "React.js", "Deep Learning")
 */
function normalizeSkillKey(skillStr = '') {
  const clean = skillStr.toLowerCase().trim();
  if (clean.includes('python')) return 'python';
  if (clean.includes('javascript') || clean === 'js') return 'javascript';
  if (clean.includes('node') || clean.includes('express')) return 'nodejs';
  if (clean.includes('sql') || clean.includes('postgres') || clean.includes('mysql')) return 'sql';
  if (clean.includes('machine learning') || clean.includes('ml') || clean.includes('deep learning')) return 'machine learning';
  if (clean.includes('nlp') || clean.includes('natural language')) return 'nlp';
  if (clean.includes('docker') || clean.includes('container')) return 'docker';
  if (clean.includes('k8s') || clean.includes('kubernetes')) return 'kubernetes';
  if (clean.includes('aws') || clean.includes('cloud')) return 'aws';
  if (clean.includes('react')) return 'react';
  if (clean.includes('c++') || clean === 'cpp') return 'c++';
  if (clean.includes('git')) return 'git';
  return clean;
}

/**
 * Generate a dynamic or fallback question for a specialized skill using Gemini
 */
async function generateDynamicSkillQuestions(skillName, count = 1) {
  const ai = getGeminiClient();
  if (!ai) return [];

  try {
    const prompt = `You are a Principal Software Architect at an enterprise tech firm.
Create ${count} high-signal multiple-choice technical interview questions for the skill: "${skillName}".

Goal: Discriminate between an experienced practitioner and a candidate who merely listed "${skillName}" as a keyword on their resume.
Focus on realistic code outputs, architectural tradeoffs, common edge cases, or debugging traps.

Return ONLY a valid JSON array of objects with this schema:
[
  {
    "id": "dyn_${Date.now()}_1",
    "skill": "${skillName}",
    "question": "Question text here (can include markdown code snippet)",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation why the answer is correct."
  }
]`;

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Skill generation timeout')), 5500))
    ]);

    const text = response.text || '';
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((q, idx) => ({
        id: `dyn_${skillName.slice(0, 4)}_${Date.now()}_${idx}`,
        skill: skillName,
        question: q.question,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Yes', 'No', 'Sometimes', 'Never'],
        correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
        explanation: q.explanation || 'Verified industry standard answer.'
      }));
    }
  } catch (err) {
    console.warn(`[SkillVerificationService] Could not generate dynamic questions for "${skillName}":`, err.message);
  }
  return [];
}

/**
 * Assemble a personalized Skill Verification Assessment
 * Target: 5 to 7 practical questions drawn from the candidate's claimed skills
 * that match or support the job's mandatory skills.
 */
async function createSkillVerificationTest({
  claimedSkills = [],
  jobMandatorySkills = [],
  jobOptionalSkills = [],
  candidateName = 'Candidate',
  jobTitle = 'Role'
}) {
  // Determine relevant skills to test
  const allTargetSkills = [
    ...jobMandatorySkills,
    ...jobOptionalSkills,
    ...claimedSkills
  ];

  // Unique normalized skills
  const normalizedSet = new Set();
  const rawSkillMap = new Map();

  for (const s of allTargetSkills) {
    if (!s) continue;
    const norm = normalizeSkillKey(s);
    normalizedSet.add(norm);
    if (!rawSkillMap.has(norm)) {
      rawSkillMap.set(norm, s);
    }
  }

  const selectedQuestions = [];
  const usedQuestionIds = new Set();

  // Draw from question bank first
  for (const normKey of normalizedSet) {
    if (QUESTION_BANK[normKey]) {
      const bankItems = QUESTION_BANK[normKey];
      // Pick 1 or 2 from each matched domain
      for (const q of bankItems) {
        if (!usedQuestionIds.has(q.id)) {
          selectedQuestions.push(q);
          usedQuestionIds.add(q.id);
          if (selectedQuestions.length >= 6) break;
        }
      }
    }
    if (selectedQuestions.length >= 6) break;
  }

  // If still under 5 questions, try dynamic generation for any uncovered skills
  if (selectedQuestions.length < 5) {
    for (const normKey of normalizedSet) {
      if (selectedQuestions.length >= 6) break;
      if (!QUESTION_BANK[normKey]) {
        const rawName = rawSkillMap.get(normKey) || normKey;
        const dynQuestions = await generateDynamicSkillQuestions(rawName, 2);
        for (const dq of dynQuestions) {
          if (!usedQuestionIds.has(dq.id)) {
            selectedQuestions.push(dq);
            usedQuestionIds.add(dq.id);
          }
        }
      }
    }
  }

  // Fallback defaults if still too few questions
  if (selectedQuestions.length < 4) {
    const generalPool = [
      ...QUESTION_BANK.python,
      ...QUESTION_BANK.javascript,
      ...QUESTION_BANK.sql,
      ...QUESTION_BANK.git
    ];
    for (const q of generalPool) {
      if (!usedQuestionIds.has(q.id)) {
        selectedQuestions.push(q);
        usedQuestionIds.add(q.id);
        if (selectedQuestions.length >= 5) break;
      }
    }
  }

  // Shuffle questions slightly
  const finalQuestions = selectedQuestions.sort(() => 0.5 - Math.random()).slice(0, 7);

  return {
    testId: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    candidateName,
    jobTitle,
    targetSkills: Array.from(normalizedSet),
    questionCount: finalQuestions.length,
    timeLimitPerQuestion: 60, // seconds
    totalTimeLimitMinutes: Math.ceil((finalQuestions.length * 60) / 60) + 1,
    questions: finalQuestions
  };
}

/**
 * Obfuscate test for client transmission (hide correct answer index and explanation)
 */
function sanitizeTestForClient(testData) {
  if (!testData || !Array.isArray(testData.questions)) return null;

  return {
    testId: testData.testId,
    candidateName: testData.candidateName,
    jobTitle: testData.jobTitle,
    targetSkills: testData.targetSkills,
    questionCount: testData.questions.length,
    timeLimitPerQuestion: testData.timeLimitPerQuestion || 60,
    totalTimeLimitMinutes: testData.totalTimeLimitMinutes || 6,
    questions: testData.questions.map((q, idx) => ({
      index: idx,
      id: q.id,
      skill: q.skill,
      question: q.question,
      options: q.options
    }))
  };
}

/**
 * Evaluate submitted answers against server reference
 */
function evaluateSkillTestAnswers(testOrQuestions = [], submittedAnswers = {}, passingCutoff = 70) {
  const testQuestions = Array.isArray(testOrQuestions) ? testOrQuestions : (testOrQuestions?.questions || []);
  let correctCount = 0;
  const total = testQuestions.length;
  const questionResults = [];
  const skillStats = {};

  for (let i = 0; i < testQuestions.length; i++) {
    const q = testQuestions[i];
    const userSelected = submittedAnswers[q.id] !== undefined ? parseInt(submittedAnswers[q.id], 10) : null;
    const isCorrect = userSelected !== null && userSelected === q.correctIndex;

    if (isCorrect) correctCount++;

    const skillKey = q.skill.toLowerCase();
    if (!skillStats[skillKey]) {
      skillStats[skillKey] = { total: 0, correct: 0 };
    }
    skillStats[skillKey].total++;
    if (isCorrect) skillStats[skillKey].correct++;

    questionResults.push({
      id: q.id,
      skill: q.skill,
      question: q.question,
      userSelected,
      correctIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation
    });
  }

  const scorePercentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = scorePercentage >= passingCutoff;

  // Classify verified skills and knowledge gaps
  const verifiedSkills = [];
  const knowledgeGaps = [];

  for (const [skill, stats] of Object.entries(skillStats)) {
    const skillPct = Math.round((stats.correct / stats.total) * 100);
    if (skillPct >= 60) {
      verifiedSkills.push({
        skill,
        score: skillPct,
        status: 'VERIFIED',
        badge: `Verified ${skill.toUpperCase()} Specialist`
      });
    } else {
      knowledgeGaps.push({
        skill,
        score: skillPct,
        status: 'GAP_DETECTED',
        recommendation: `Review core conceptual implementations and practical patterns in ${skill}.`
      });
    }
  }

  let antiInflationVerdict = 'VERIFIED_COMPETENCY';
  let summary = `Candidate verified claimed skills with a score of ${scorePercentage}%. Qualified for AI interview.`;

  if (scorePercentage < 45) {
    antiInflationVerdict = 'SUSPECTED_KEYWORD_INFLATION';
    summary = `Candidate scored ${scorePercentage}% on foundational questions for skills claimed on resume. High risk of keyword-stuffing. AI interview access withheld to avoid candidate distress and system overhead.`;
  } else if (!passed) {
    antiInflationVerdict = 'MARGINAL_COMPETENCY';
    summary = `Candidate achieved ${scorePercentage}% (Passing threshold: ${passingCutoff}%). Prerequisite knowledge needs reinforcement before proceeding to interview stage.`;
  }

  return {
    totalQuestions: total,
    correctCount,
    scorePercentage,
    passingCutoff,
    passed,
    antiInflationVerdict,
    summary,
    verifiedSkills,
    knowledgeGaps,
    questionResults,
    evaluatedAt: new Date().toISOString()
  };
}

module.exports = {
  createSkillVerificationTest,
  sanitizeTestForClient,
  evaluateSkillTestAnswers,
  normalizeSkillKey,
  QUESTION_BANK
};
