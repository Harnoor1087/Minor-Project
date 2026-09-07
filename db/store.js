const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, '../data/database.json');

// Default initial state
const defaultData = {
  users: [
    {
      _id: 'usr_admin_1',
      name: 'Sarah Jenkins',
      email: 'admin@company.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      company: 'AIRIS Talent Global',
      createdAt: new Date('2026-01-15T09:00:00Z').toISOString()
    },
    {
      _id: 'usr_applicant_1',
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      passwordHash: bcrypt.hashSync('alex123', 10),
      role: 'applicant',
      company: '',
      createdAt: new Date('2026-02-01T10:30:00Z').toISOString()
    }
  ],
  jobs: [
    {
      id: 1,
      title: 'Full Stack Software Engineer',
      description: 'We are seeking a talented Full Stack Engineer to build reliable, high-performance web applications using Node.js, JavaScript, and modern web frameworks.',
      mandatory_skills: ['javascript', 'nodejs', 'express', 'sql', 'git'],
      optional_skills: ['react', 'docker', 'mongodb', 'typescript', 'rest api'],
      certification_enabled: true,
      certification_weight: 0.2
    },
    {
      id: 2,
      title: 'Machine Learning & AI Engineer',
      description: 'Looking for an AI/ML Engineer to implement NLP pipelines, embedding models, and generative AI solutions for automated intelligence systems.',
      mandatory_skills: ['python', 'machine learning', 'nlp', 'sql', 'deep learning'],
      optional_skills: ['tensorflow', 'pytorch', 'llm', 'numpy', 'pandas', 'git'],
      certification_enabled: true,
      certification_weight: 0.25
    },
    {
      id: 3,
      title: 'Data Scientist / Analyst',
      description: 'Join our data intelligence team to develop statistical algorithms, analyze resume trends, and extract structured insights from unstructured documents.',
      mandatory_skills: ['python', 'sql', 'pandas', 'numpy', 'machine learning'],
      optional_skills: ['scikit', 'data science', 'tableau', 'github'],
      certification_enabled: false,
      certification_weight: 0.15
    }
  ],
  applications: []
};

// In-memory state initialized from file if present
let state = JSON.parse(JSON.stringify(defaultData));

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.users && parsed.jobs && parsed.applications) {
        state = parsed;
        return;
      }
    }
  } catch (err) {
    console.warn('[Store] Could not load database.json, using defaults:', err.message);
  }
  saveToDisk();
}

function saveToDisk() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Store] Could not persist to database.json:', err.message);
  }
}

loadFromDisk();

// User methods
const users = {
  findByEmail(email) {
    if (!email) return null;
    return state.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },
  findById(id) {
    return state.users.find(u => u._id === id) || null;
  },
  async create({ name, email, password, role, company }) {
    const existing = this.findByEmail(email);
    if (existing) {
      throw new Error('User already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      _id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'applicant',
      company: company ? company.trim() : '',
      createdAt: new Date().toISOString()
    };
    state.users.push(newUser);
    saveToDisk();
    return newUser;
  },
  async verifyPassword(user, plainPassword) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(plainPassword, user.passwordHash);
  }
};

// Job methods
const jobs = {
  getAll() {
    return state.jobs;
  },
  getById(id) {
    const numId = parseInt(id, 10);
    return state.jobs.find(j => j.id === numId) || null;
  },
  create(data) {
    const maxId = state.jobs.reduce((max, j) => (j.id > max ? j.id : max), 0);
    const newJob = {
      id: maxId + 1,
      title: data.title,
      description: data.description,
      mandatory_skills: Array.isArray(data.mandatory_skills) ? data.mandatory_skills : [],
      optional_skills: Array.isArray(data.optional_skills) ? data.optional_skills : [],
      certification_enabled: Boolean(data.certification_enabled),
      certification_weight: parseFloat(data.certification_weight) || 0.2
    };
    state.jobs.push(newJob);
    saveToDisk();
    return newJob;
  },
  update(id, data) {
    const numId = parseInt(id, 10);
    const idx = state.jobs.findIndex(j => j.id === numId);
    if (idx === -1) return null;

    const existing = state.jobs[idx];
    state.jobs[idx] = {
      ...existing,
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      mandatory_skills: Array.isArray(data.mandatory_skills) ? data.mandatory_skills : existing.mandatory_skills,
      optional_skills: Array.isArray(data.optional_skills) ? data.optional_skills : existing.optional_skills,
      certification_enabled: data.certification_enabled !== undefined ? Boolean(data.certification_enabled) : existing.certification_enabled,
      certification_weight: data.certification_weight !== undefined ? parseFloat(data.certification_weight) : existing.certification_weight
    };
    saveToDisk();
    return state.jobs[idx];
  },
  delete(id) {
    const numId = parseInt(id, 10);
    const idx = state.jobs.findIndex(j => j.id === numId);
    if (idx === -1) return false;
    state.jobs.splice(idx, 1);
    saveToDisk();
    return true;
  }
};

// Application methods
const applications = {
  getAll() {
    return [...state.applications].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  },
  getByApplicant(applicantId) {
    return state.applications
      .filter(a => a.applicantId === applicantId)
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  },
  getById(id) {
    return state.applications.find(a => a._id === id) || null;
  },
  create(appData) {
    const newApp = {
      _id: 'app_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      applicantId: appData.applicantId,
      applicantName: appData.applicantName || 'Unknown Candidate',
      applicantEmail: appData.applicantEmail || 'unknown@email.com',
      jobId: parseInt(appData.jobId, 10),
      jobTitle: appData.jobTitle || 'Unknown Job',
      resumePath: appData.resumePath || '',
      certificates: appData.certificates || [],
      scores: appData.scores || {
        semantic: 0,
        skill: 0,
        experience: 0,
        certification: 0,
        final: 0
      },
      category: appData.category || 'Average',
      eligibility: appData.eligibility || 'Eligible',
      status: appData.status || 'pending',
      appliedAt: new Date().toISOString()
    };
    state.applications.push(newApp);
    saveToDisk();
    return newApp;
  },
  updateStatus(id, status) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    app.status = status;
    saveToDisk();
    return app;
  }
};

module.exports = {
  users,
  jobs,
  applications
};
