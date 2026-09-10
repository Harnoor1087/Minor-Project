const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, '../data/database.json');

// Default initial state
const defaultCompanies = [
  {
    id: 'comp_airis',
    name: 'AIRIS Talent Global',
    slug: 'airis',
    logo: '🤖',
    industry: 'AI & Enterprise HR Tech',
    website: 'https://airis.ai',
    location: 'San Francisco, CA (Hybrid)',
    tagline: 'Autonomous AI Candidate Screening & Intelligent Proctoring',
    description: 'AIRIS provides cutting-edge enterprise recruitment infrastructure powered by deep semantic evaluation, adaptive AI interviewers, and live integrity proctoring.',
    createdAt: new Date('2026-01-01T00:00:00Z').toISOString()
  },
  {
    id: 'comp_infosys',
    name: 'Infosys Technologies',
    slug: 'infosys',
    logo: '🌐',
    industry: 'Global IT & Digital Consulting',
    website: 'https://infosys.com',
    location: 'Bangalore & Global Centers',
    tagline: 'Navigate your next with enterprise digital transformation',
    description: 'Global leader in next-generation digital services, software consulting, and enterprise cloud modernization.',
    createdAt: new Date('2026-01-10T00:00:00Z').toISOString()
  },
  {
    id: 'comp_nexus',
    name: 'Nexus AI Robotics',
    slug: 'nexus',
    logo: '🚀',
    industry: 'Robotics & Autonomous Systems',
    website: 'https://nexus-robotics.io',
    location: 'Seattle, WA (Remote-Friendly)',
    tagline: 'Intelligent perception and embodied AI shaping autonomous industries',
    description: 'Engineering cutting-edge robotics perception, real-time edge computing, and autonomous machine learning workflows.',
    createdAt: new Date('2026-02-01T00:00:00Z').toISOString()
  }
];

function normalizeProctoringConfig(proctoringInput = {}) {
  const level = (proctoringInput.level || 'medium').toLowerCase();
  
  if (level === 'high') {
    return {
      level: 'high',
      require_camera: true,
      require_microphone: proctoringInput.require_microphone !== undefined ? Boolean(proctoringInput.require_microphone) : true,
      face_detection: true,
      multi_face_detection: true,
      tab_switch_detection: true,
      head_pose_detection: true,
      enforce_fullscreen: proctoringInput.enforce_fullscreen !== undefined ? Boolean(proctoringInput.enforce_fullscreen) : true,
      max_infractions: proctoringInput.max_infractions ? parseInt(proctoringInput.max_infractions, 10) : 3,
      label: 'Strict Enterprise (Anti-Malpractice Active)'
    };
  } else if (level === 'low') {
    return {
      level: 'low',
      require_camera: proctoringInput.require_camera !== undefined ? Boolean(proctoringInput.require_camera) : true,
      require_microphone: false,
      face_detection: true,
      multi_face_detection: false,
      tab_switch_detection: true,
      head_pose_detection: false,
      enforce_fullscreen: false,
      max_infractions: proctoringInput.max_infractions ? parseInt(proctoringInput.max_infractions, 10) : 10,
      label: 'Permissive (Basic Presence Check)'
    };
  }

  // Default: medium
  return {
    level: 'medium',
    require_camera: true,
    require_microphone: false,
    face_detection: true,
    multi_face_detection: proctoringInput.multi_face_detection !== undefined ? Boolean(proctoringInput.multi_face_detection) : true,
    tab_switch_detection: true,
    head_pose_detection: false,
    enforce_fullscreen: proctoringInput.enforce_fullscreen !== undefined ? Boolean(proctoringInput.enforce_fullscreen) : false,
    max_infractions: proctoringInput.max_infractions ? parseInt(proctoringInput.max_infractions, 10) : 5,
    label: 'Standard ATS (Face & Tab-Switch Monitored)'
  };
}

function normalizePreInterviewGateConfig(gateInput = {}) {
  return {
    enabled: gateInput.enabled !== undefined ? Boolean(gateInput.enabled) : true,
    cutoffScore: gateInput.cutoffScore !== undefined ? parseInt(gateInput.cutoffScore, 10) : (gateInput.cutoff ? parseInt(gateInput.cutoff, 10) : 70),
    durationMinutes: gateInput.durationMinutes ? parseInt(gateInput.durationMinutes, 10) : 5,
    allowRetakes: gateInput.allowRetakes !== undefined ? Boolean(gateInput.allowRetakes) : true,
    maxRetakes: gateInput.maxRetakes !== undefined ? parseInt(gateInput.maxRetakes, 10) : 2,
    passportBypassEnabled: gateInput.passportBypassEnabled !== undefined ? Boolean(gateInput.passportBypassEnabled) : true
  };
}

const defaultData = {
  companies: defaultCompanies,
  users: [
    {
      _id: 'usr_admin_1',
      name: 'Sarah Jenkins',
      email: 'admin@company.com',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      company: 'AIRIS Talent Global',
      companyId: 'comp_airis',
      createdAt: new Date('2026-01-15T09:00:00Z').toISOString()
    },
    {
      _id: 'usr_applicant_1',
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      passwordHash: bcrypt.hashSync('alex123', 10),
      role: 'applicant',
      company: '',
      companyId: '',
      createdAt: new Date('2026-02-01T10:30:00Z').toISOString()
    }
  ],
  jobs: [
    {
      id: 1,
      title: 'Full Stack Software Engineer',
      description: 'We are seeking a talented Full Stack Engineer to build reliable, high-performance web applications using Node.js, JavaScript, and modern web frameworks.',
      companyId: 'comp_airis',
      companyName: 'AIRIS Talent Global',
      companySlug: 'airis',
      department: 'Engineering',
      location: 'San Francisco, CA (Hybrid)',
      employmentType: 'Full-time',
      experienceLevel: 'Mid - Senior',
      mandatory_skills: ['javascript', 'nodejs', 'express', 'sql', 'git'],
      optional_skills: ['react', 'docker', 'mongodb', 'typescript', 'rest api'],
      certification_enabled: true,
      certification_weight: 0.2,
      proctoring: normalizeProctoringConfig({ level: 'high' }),
      preInterviewGate: normalizePreInterviewGateConfig({ enabled: true, cutoffScore: 70 })
    },
    {
      id: 2,
      title: 'Machine Learning & AI Engineer',
      description: 'Looking for an AI/ML Engineer to implement NLP pipelines, embedding models, and generative AI solutions for automated intelligence systems.',
      companyId: 'comp_airis',
      companyName: 'AIRIS Talent Global',
      companySlug: 'airis',
      department: 'AI Research',
      location: 'Remote',
      employmentType: 'Full-time',
      experienceLevel: 'Senior',
      mandatory_skills: ['python', 'machine learning', 'nlp', 'sql', 'deep learning'],
      optional_skills: ['tensorflow', 'pytorch', 'llm', 'numpy', 'pandas', 'git'],
      certification_enabled: true,
      certification_weight: 0.25,
      proctoring: normalizeProctoringConfig({ level: 'high' }),
      preInterviewGate: normalizePreInterviewGateConfig({ enabled: true, cutoffScore: 75 })
    },
    {
      id: 3,
      title: 'Enterprise Cloud Architect',
      description: 'Join Infosys Digital to architect scalable multi-cloud microservices, CI/CD automation, and high-availability database solutions for Fortune 500 enterprises.',
      companyId: 'comp_infosys',
      companyName: 'Infosys Technologies',
      companySlug: 'infosys',
      department: 'Cloud Solutions',
      location: 'Hybrid / Remote',
      employmentType: 'Full-time',
      experienceLevel: 'Lead / Staff',
      mandatory_skills: ['aws', 'kubernetes', 'docker', 'terraform', 'ci/cd'],
      optional_skills: ['gcp', 'python', 'security', 'microservices', 'kafka'],
      certification_enabled: true,
      certification_weight: 0.3,
      proctoring: normalizeProctoringConfig({ level: 'medium' }),
      preInterviewGate: normalizePreInterviewGateConfig({ enabled: true, cutoffScore: 70 })
    },
    {
      id: 4,
      title: 'Autonomous Robotics Software Engineer',
      description: 'Design real-time robotic motion planning, ROS2 nodes, sensor fusion, and computer vision drivers for next-gen warehouse mobile robots.',
      companyId: 'comp_nexus',
      companyName: 'Nexus AI Robotics',
      companySlug: 'nexus',
      department: 'Robotics',
      location: 'Seattle, WA',
      employmentType: 'Full-time',
      experienceLevel: 'Mid - Senior',
      mandatory_skills: ['c++', 'python', 'ros', 'linux', 'git'],
      optional_skills: ['opencv', 'cuda', 'control systems', 'slam', 'docker'],
      certification_enabled: false,
      certification_weight: 0.15,
      proctoring: normalizeProctoringConfig({ level: 'high' }),
      preInterviewGate: normalizePreInterviewGateConfig({ enabled: true, cutoffScore: 70 })
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
        
        // Ensure otps collection exists
        if (!state.otps || !Array.isArray(state.otps)) {
          state.otps = [];
        }

        // Ensure companies exist
        if (!state.companies || !Array.isArray(state.companies) || state.companies.length === 0) {
          state.companies = defaultCompanies;
        }

        // Migrate jobs to ensure companyId and proctoring exist
        state.jobs = state.jobs.map(j => {
          let companyId = j.companyId;
          let companyName = j.companyName;
          let companySlug = j.companySlug;
          if (!companyId) {
            companyId = 'comp_airis';
            companyName = 'AIRIS Talent Global';
            companySlug = 'airis';
          }
          return {
            ...j,
            companyId,
            companyName: companyName || 'AIRIS Talent Global',
            companySlug: companySlug || 'airis',
            department: j.department || 'Engineering',
            location: j.location || 'Remote',
            employmentType: j.employmentType || 'Full-time',
            experienceLevel: j.experienceLevel || 'Mid Level',
            proctoring: j.proctoring ? normalizeProctoringConfig(j.proctoring) : normalizeProctoringConfig({ level: 'medium' }),
            preInterviewGate: j.preInterviewGate ? normalizePreInterviewGateConfig(j.preInterviewGate) : normalizePreInterviewGateConfig({ enabled: true, cutoffScore: 70 })
          };
        });

        // Ensure users have companyId, verifiedSkills, and masterResume
        state.users = state.users.map(u => {
          const updatedUser = {
            ...u,
            verifiedSkills: Array.isArray(u.verifiedSkills) ? u.verifiedSkills : [],
            masterResume: u.masterResume || null
          };
          if (u.role === 'admin' && !u.companyId) {
            const matchComp = state.companies.find(c => c.name.toLowerCase() === (u.company || '').toLowerCase());
            updatedUser.companyId = matchComp ? matchComp.id : 'comp_airis';
          }
          return updatedUser;
        });

        // Ensure applications have skillVerification
        state.applications = (state.applications || []).map(a => ({
          ...a,
          skillVerification: a.skillVerification || {
            status: 'pending',
            score: null,
            passed: false,
            completedAt: null
          }
        }));

        saveToDisk();
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

// Company methods
const companies = {
  getAll() {
    return state.companies.map(c => {
      const activeJobs = state.jobs.filter(j => j.companyId === c.id);
      return {
        ...c,
        activeJobsCount: activeJobs.length
      };
    });
  },
  getById(id) {
    return state.companies.find(c => c.id === id) || null;
  },
  getBySlug(slug) {
    if (!slug) return null;
    return state.companies.find(c => c.slug.toLowerCase() === slug.toLowerCase().trim()) || null;
  },
  create(data) {
    let slug = (data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/^-+|-+$/g, '');
    if (!slug) slug = 'comp-' + Date.now();
    const existing = this.getBySlug(slug);
    if (existing) {
      if (data.attachIfExists) {
        return existing;
      }
      // If unique slug wasn't explicitly forced, make slug unique rather than crashing
      if (!data.slug) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      } else {
        return existing;
      }
    }

    const newCompany = {
      id: 'comp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: data.name.trim(),
      slug,
      logo: data.logo || '🏢',
      industry: data.industry || 'Technology & Software',
      website: data.website || '',
      location: data.location || 'Remote',
      tagline: data.tagline || '',
      description: data.description || '',
      createdAt: new Date().toISOString()
    };
    state.companies.push(newCompany);
    saveToDisk();
    return newCompany;
  },
  update(id, data) {
    const idx = state.companies.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const existing = state.companies[idx];
    state.companies[idx] = {
      ...existing,
      name: data.name ?? existing.name,
      logo: data.logo ?? existing.logo,
      industry: data.industry ?? existing.industry,
      website: data.website ?? existing.website,
      location: data.location ?? existing.location,
      tagline: data.tagline ?? existing.tagline,
      description: data.description ?? existing.description
    };
    saveToDisk();
    return state.companies[idx];
  },
  delete(id) {
    const idx = state.companies.findIndex(c => c.id === id);
    if (idx === -1) return false;
    state.companies.splice(idx, 1);
    saveToDisk();
    return true;
  }
};

// User methods
const users = {
  findByEmail(email) {
    if (!email) return null;
    return state.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
  },
  findById(id) {
    return state.users.find(u => u._id === id) || null;
  },
  async create({ name, email, password, passwordHash, role, company, companyId }) {
    const existing = this.findByEmail(email);
    if (existing) {
      throw new Error('User already exists');
    }
    const finalHash = passwordHash || (await bcrypt.hash(password, 10));

    let resolvedCompanyId = companyId || '';
    let resolvedCompanyName = company ? company.trim() : '';

    if (role === 'admin') {
      if (resolvedCompanyId) {
        const comp = companies.getById(resolvedCompanyId);
        if (comp) resolvedCompanyName = comp.name;
      } else if (resolvedCompanyName) {
        // Find or create company by name or slug
        const normName = resolvedCompanyName.toLowerCase();
        const normSlug = normName.replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
        const existingComp = state.companies.find(c => 
          c.name.toLowerCase() === normName ||
          c.slug.toLowerCase() === normName ||
          c.slug.toLowerCase() === normSlug ||
          c.name.toLowerCase().includes(normName)
        );
        if (existingComp) {
          resolvedCompanyId = existingComp.id;
          resolvedCompanyName = existingComp.name;
        } else {
          const createdComp = companies.create({ name: resolvedCompanyName, attachIfExists: true });
          resolvedCompanyId = createdComp.id;
          resolvedCompanyName = createdComp.name;
        }
      } else {
        resolvedCompanyId = 'comp_airis';
        resolvedCompanyName = 'AIRIS Talent Global';
      }
    }

    const newUser = {
      _id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: finalHash,
      role: role || 'applicant',
      company: resolvedCompanyName,
      companyId: resolvedCompanyId,
      createdAt: new Date().toISOString()
    };
    state.users.push(newUser);
    saveToDisk();
    return newUser;
  },
  async verifyPassword(user, plainPassword) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(plainPassword, user.passwordHash);
  },
  updateVerifiedSkills(id, newSkills = []) {
    const user = state.users.find(u => u._id === id);
    if (!user) return null;
    if (!Array.isArray(user.verifiedSkills)) user.verifiedSkills = [];

    // Merge or update skill badges with 90-day expiry
    const expiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    for (const item of newSkills) {
      const idx = user.verifiedSkills.findIndex(s => s.skill.toLowerCase() === item.skill.toLowerCase());
      const badgeObj = {
        skill: item.skill.toLowerCase(),
        score: item.score,
        badge: item.badge || `Verified ${item.skill.toUpperCase()} Specialist`,
        verifiedAt: new Date().toISOString(),
        expiresAt: expiryDate
      };
      if (idx !== -1) {
        user.verifiedSkills[idx] = badgeObj;
      } else {
        user.verifiedSkills.push(badgeObj);
      }
    }
    saveToDisk();
    return user;
  },
  updateMasterResume(id, resumeData) {
    const user = state.users.find(u => u._id === id);
    if (!user) return null;
    user.masterResume = {
      ...(user.masterResume || {}),
      ...resumeData,
      updatedAt: new Date().toISOString()
    };
    saveToDisk();
    return user;
  }
};

// Job methods
const jobs = {
  getAll(filter = {}) {
    let result = [...state.jobs];
    if (filter.companyId) {
      result = result.filter(j => j.companyId === filter.companyId);
    }
    if (filter.companySlug) {
      result = result.filter(j => j.companySlug.toLowerCase() === filter.companySlug.toLowerCase());
    }
    return result;
  },
  getById(id) {
    const numId = parseInt(id, 10);
    return state.jobs.find(j => j.id === numId) || null;
  },
  create(data) {
    const maxId = state.jobs.reduce((max, j) => (j.id > max ? j.id : max), 0);

    let companyId = data.companyId || 'comp_airis';
    let companyName = data.companyName;
    let companySlug = data.companySlug;

    const comp = companies.getById(companyId);
    if (comp) {
      companyName = comp.name;
      companySlug = comp.slug;
    } else {
      companyName = companyName || 'AIRIS Talent Global';
      companySlug = companySlug || 'airis';
    }

    const proctoring = normalizeProctoringConfig(data.proctoring || { level: data.proctoring_level || 'medium' });
    const preInterviewGate = normalizePreInterviewGateConfig(data.preInterviewGate || data.pre_interview_gate || {});

    const newJob = {
      id: maxId + 1,
      title: data.title,
      description: data.description,
      companyId,
      companyName,
      companySlug,
      department: data.department || 'Engineering',
      location: data.location || 'Remote',
      employmentType: data.employmentType || 'Full-time',
      experienceLevel: data.experienceLevel || 'Mid Level',
      mandatory_skills: Array.isArray(data.mandatory_skills) ? data.mandatory_skills : [],
      optional_skills: Array.isArray(data.optional_skills) ? data.optional_skills : [],
      certification_enabled: Boolean(data.certification_enabled),
      certification_weight: parseFloat(data.certification_weight) || 0.2,
      proctoring,
      preInterviewGate,
      createdAt: new Date().toISOString()
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

    let proctoring = existing.proctoring;
    if (data.proctoring || data.proctoring_level) {
      proctoring = normalizeProctoringConfig(data.proctoring || { level: data.proctoring_level, ...data });
    }

    let preInterviewGate = existing.preInterviewGate ? normalizePreInterviewGateConfig(existing.preInterviewGate) : normalizePreInterviewGateConfig({ enabled: true });
    if (data.preInterviewGate || data.pre_interview_gate) {
      preInterviewGate = normalizePreInterviewGateConfig(data.preInterviewGate || data.pre_interview_gate);
    }

    let companyId = data.companyId ?? existing.companyId;
    let companyName = existing.companyName;
    let companySlug = existing.companySlug;
    if (data.companyId && data.companyId !== existing.companyId) {
      const comp = companies.getById(data.companyId);
      if (comp) {
        companyName = comp.name;
        companySlug = comp.slug;
      }
    }

    state.jobs[idx] = {
      ...existing,
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      companyId,
      companyName,
      companySlug,
      department: data.department ?? existing.department,
      location: data.location ?? existing.location,
      employmentType: data.employmentType ?? existing.employmentType,
      experienceLevel: data.experienceLevel ?? existing.experienceLevel,
      mandatory_skills: Array.isArray(data.mandatory_skills) ? data.mandatory_skills : existing.mandatory_skills,
      optional_skills: Array.isArray(data.optional_skills) ? data.optional_skills : existing.optional_skills,
      certification_enabled: data.certification_enabled !== undefined ? Boolean(data.certification_enabled) : existing.certification_enabled,
      certification_weight: data.certification_weight !== undefined ? parseFloat(data.certification_weight) : existing.certification_weight,
      proctoring,
      preInterviewGate
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
  getAll(filter = {}) {
    let result = [...state.applications];
    if (filter.companyId) {
      result = result.filter(a => a.companyId === filter.companyId);
    }
    return result.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
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
      companyId: appData.companyId || 'comp_airis',
      companyName: appData.companyName || 'AIRIS Talent Global',
      companySlug: appData.companySlug || 'airis',
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
      proctoringLevel: appData.proctoringLevel || 'medium',
      identityVerification: appData.identityVerification || null,
      certifications: appData.certifications || null,
      skillVerification: appData.skillVerification || {
        status: 'pending', // pending, passed, failed
        score: null,
        passed: false,
        questions: [],
        completedAt: null
      },
      interview: appData.interview || {
        status: 'not_started', // not_started, in_progress, completed, disqualified
        overallScore: null,
        recommendation: null,
        questions: [],
        proctoringReport: {
          integrityStatus: 'CLEAN',
          infractionCount: 0,
          infractions: []
        },
        completedAt: null
      },
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
  },
  updateIntelligence(id, intelligence) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    app.intelligence = intelligence;
    saveToDisk();
    return app;
  },
  updateSkillVerification(id, verificationData) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    app.skillVerification = {
      ...(app.skillVerification || {
        status: 'pending',
        score: null,
        passed: false
      }),
      ...verificationData,
      updatedAt: new Date().toISOString()
    };
    saveToDisk();
    return app;
  },
  updateInterview(id, interviewUpdate) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    app.interview = {
      ...(app.interview || {
        status: 'not_started',
        overallScore: null,
        recommendation: null,
        questions: [],
        proctoringReport: {
          integrityStatus: 'CLEAN',
          infractionCount: 0,
          infractions: []
        }
      }),
      ...interviewUpdate
    };
    saveToDisk();
    return app;
  },
  recordInfraction(id, infraction) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    if (!app.interview) {
      app.interview = {
        status: 'in_progress',
        overallScore: null,
        recommendation: null,
        questions: [],
        proctoringReport: {
          integrityStatus: 'CLEAN',
          infractionCount: 0,
          infractions: []
        }
      };
    }
    if (!app.interview.proctoringReport) {
      app.interview.proctoringReport = {
        integrityStatus: 'CLEAN',
        infractionCount: 0,
        infractions: []
      };
    }

    const report = app.interview.proctoringReport;
    const newInfraction = {
      id: 'inf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      type: infraction.type || 'MALPRACTICE_ALERT',
      message: infraction.message || 'Suspicious activity detected',
      details: infraction.details || '',
      timestamp: new Date().toISOString()
    };

    report.infractions.push(newInfraction);
    report.infractionCount = report.infractions.length;

    const maxInfractions = infraction.maxInfractions || 3;
    if (report.infractionCount >= maxInfractions) {
      report.integrityStatus = 'DISQUALIFIED';
      app.interview.status = 'disqualified';
      app.interview.recommendation = 'Disqualified (Cheating / Malpractice Detected)';
    } else if (report.infractionCount > 0) {
      report.integrityStatus = 'FLAGGED';
    }

    saveToDisk();
    return { app, infraction: newInfraction, report };
  },
  updateDecision(id, decisionData) {
    const app = state.applications.find(a => a._id === id);
    if (!app) return null;
    app.decision = {
      ...(app.decision || {}),
      ...decisionData,
      updatedAt: new Date().toISOString()
    };
    if (decisionData.status) {
      app.status = decisionData.status;
    } else if (decisionData.verdict === 'STRONG_HIRE' || decisionData.verdict === 'HIRE') {
      if (decisionData.decisionLetter && decisionData.decisionLetter.type === 'offer') {
        app.status = 'accepted';
      } else {
        app.status = 'reviewed';
      }
    } else if (decisionData.verdict === 'REJECT') {
      app.status = 'rejected';
    }
    saveToDisk();
    return app;
  }
};

// One-Time Password (OTP) verification store
const otps = {
  async create({ email, code, purpose, metadata = {}, expiresInMinutes = 10, resendCount = 0 }) {
    if (!state.otps) state.otps = [];
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check if an existing OTP exists for this email & purpose to preserve session resend counter
    const existing = state.otps.find(o => o.email === normalizedEmail && o.purpose === purpose);
    const count = typeof resendCount === 'number' && resendCount > 0 
      ? resendCount 
      : (existing ? (existing.resendCount || 0) : 0);

    // Invalidate old OTP records for the same email and purpose
    state.otps = state.otps.filter(o => !(o.email === normalizedEmail && o.purpose === purpose));

    const codeHash = await bcrypt.hash(code.trim(), 8);
    const now = new Date();
    const newOtp = {
      id: 'otp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      email: normalizedEmail,
      codeHash,
      purpose, // 'registration' | 'login'
      metadata,
      attempts: 0,
      resendCount: count,
      createdAt: now.toISOString(),
      lastSentAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString()
    };
    state.otps.push(newOtp);
    saveToDisk();
    return newOtp;
  },

  getCooldownInfo(optsOrEmail, maybePurpose) {
    if (!state.otps) return { remainingSeconds: 0, resendCount: 0, maxResends: 5, maxReached: false, cooldownPeriod: 30 };
    const email = typeof optsOrEmail === 'string' ? optsOrEmail : (optsOrEmail && optsOrEmail.email);
    const purpose = typeof optsOrEmail === 'string' ? maybePurpose : (optsOrEmail && optsOrEmail.purpose);
    if (!email) return { remainingSeconds: 0, resendCount: 0, maxResends: 5, maxReached: false, cooldownPeriod: 30 };

    const normalizedEmail = email.toLowerCase().trim();
    const existing = state.otps.find(o => o.email === normalizedEmail && o.purpose === purpose);
    if (!existing) return { remainingSeconds: 0, resendCount: 0, maxResends: 5, maxReached: false, cooldownPeriod: 30 };
    
    const count = existing.resendCount || 0;
    const maxResends = 5;

    if (count >= maxResends) {
      return {
        remainingSeconds: 600, // 10 minutes lock
        resendCount: count,
        maxResends,
        maxReached: true,
        cooldownPeriod: 600
      };
    }

    // Progressive cooldown to prevent spam: 30s -> 45s -> 60s
    let cooldownPeriod = 30;
    if (count === 1) cooldownPeriod = 45;
    else if (count >= 2) cooldownPeriod = 60;

    const referenceTime = new Date(existing.lastSentAt || existing.createdAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - referenceTime) / 1000);

    if (elapsedSeconds < cooldownPeriod) {
      return {
        remainingSeconds: cooldownPeriod - elapsedSeconds,
        resendCount: count,
        maxResends,
        maxReached: false,
        cooldownPeriod
      };
    }

    return {
      remainingSeconds: 0,
      resendCount: count,
      maxResends,
      maxReached: false,
      cooldownPeriod
    };
  },

  getCooldown(optsOrEmail, maybePurpose) {
    const info = this.getCooldownInfo(optsOrEmail, maybePurpose);
    return info.remainingSeconds;
  },

  getActive(optsOrEmail, maybePurpose) {
    if (!state.otps) return null;
    const email = typeof optsOrEmail === 'string' ? optsOrEmail : (optsOrEmail && optsOrEmail.email);
    const purpose = typeof optsOrEmail === 'string' ? maybePurpose : (optsOrEmail && optsOrEmail.purpose);
    if (!email) return null;
    const normalizedEmail = email.toLowerCase().trim();
    return state.otps.find(o => o.email === normalizedEmail && o.purpose === purpose) || null;
  },

  async recordResend(optsOrEmail, maybePurpose, maybeCode, maybeExpiresInMinutes) {
    if (!state.otps) state.otps = [];
    const email = typeof optsOrEmail === 'string' ? optsOrEmail : (optsOrEmail && optsOrEmail.email);
    const purpose = typeof optsOrEmail === 'string' ? maybePurpose : (optsOrEmail && optsOrEmail.purpose);
    const code = typeof optsOrEmail === 'string' ? maybeCode : (optsOrEmail && optsOrEmail.code);
    const expiresInMinutes = typeof optsOrEmail === 'string' ? (maybeExpiresInMinutes || 10) : (optsOrEmail && optsOrEmail.expiresInMinutes || 10);
    if (!email) return null;

    const normalizedEmail = email.toLowerCase().trim();
    const existing = state.otps.find(o => o.email === normalizedEmail && o.purpose === purpose);
    if (!existing) return null;

    const codeHash = code ? await bcrypt.hash(code.trim(), 8) : existing.codeHash;
    const now = new Date();
    existing.codeHash = codeHash;
    existing.attempts = 0; // reset failed verification attempts for fresh code
    existing.resendCount = (existing.resendCount || 0) + 1;
    existing.lastSentAt = now.toISOString();
    existing.expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000).toISOString();

    saveToDisk();
    return existing;
  },

  async verify({ email, code, purpose }) {
    if (!state.otps) state.otps = [];
    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    const index = state.otps.findIndex(o => o.email === normalizedEmail && o.purpose === purpose);
    if (index === -1) {
      return { valid: false, error: 'No active verification code found for this email. Please request a new code.' };
    }

    const otp = state.otps[index];

    // Check expiration
    if (now > new Date(otp.expiresAt)) {
      state.otps.splice(index, 1);
      saveToDisk();
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }

    // Check attempts limit (max 5 attempts)
    if (otp.attempts >= 5) {
      state.otps.splice(index, 1);
      saveToDisk();
      return { valid: false, error: 'Too many incorrect attempts. For security, this code has been invalidated. Please request a new code.' };
    }

    // Compare code
    const isMatch = await bcrypt.compare(code.trim(), otp.codeHash);
    if (!isMatch) {
      otp.attempts = (otp.attempts || 0) + 1;
      const remainingAttempts = 5 - otp.attempts;
      saveToDisk();
      return {
        valid: false,
        error: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
      };
    }

    // Valid code: consume OTP
    const metadata = otp.metadata || {};
    state.otps.splice(index, 1);
    saveToDisk();
    return { valid: true, metadata };
  }
};

module.exports = {
  companies,
  users,
  jobs,
  applications,
  otps,
  normalizeProctoringConfig
};
