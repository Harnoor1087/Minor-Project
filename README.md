# AIRIS - AI Resume Intelligence System

> **Enterprise Talent Intelligence, Automated Resume Screening & Proctor-Enabled AI Assessment Platform**

AIRIS (AI Resume Intelligence System) is a production-grade full-stack recruitment platform and automated evaluation engine. Built with Node.js, Express, React 19, Google Gemini AI, and local in-engine Machine Learning / statistical models, AIRIS bridges candidates, recruiters, and enterprise teams with end-to-end recruitment intelligence, proctored AI interviewing, skill verification, and multi-tenant isolation.

---

## 🎯 Architecture & Highlights

- **Unified Full-Stack Architecture**: Single high-performance Node.js & Express server powering RESTful APIs, paired with a React 19 SPA client bundle (compiled with esbuild) and rich candidate/recruiter interfaces.
- **Hybrid AI/ML Intelligence Core**:
  - **In-Engine Statistical & ML Models (100% Local / Zero-API Fallback)**:
    - **Vector Space TF-IDF + Cosine Similarity**: Sublinear term weighting for document-to-job matching and keyword coverage analysis.
    - **Multinomial Naive Bayes Domain Classifier**: Classifies candidate profiles into engineering archetypes (*Backend & Distributed Systems*, *Frontend & UI*, *DevOps/SRE*, *Data & ML*, *Mobile*) with Laplace-smoothed posterior probabilities.
    - **EEOC 4/5ths Rule Adverse Impact Auditor**: Enforces Title VII compliance and detects disparate impact across candidate experience cohorts.
    - **2-Parameter Logistic (2PL) Item Response Theory (IRT)**: Latent ability ($\theta$) estimation via Newton-Raphson maximum likelihood, dynamically calibrating interview difficulty from Core Foundations to Principal Architecture.
    - **Jaccard & Vector Career Recommender**: Automatic job recommendations based on candidate skill tokens and resume experience.
  - **Server-Side Generative AI (Google Gemini via `@google/genai`)**:
    - Contextual resume parsing, OCR text extraction, certificate credential verification, tailored interview question generation, and automated scoring analysis.
- **Enterprise Multi-Tenancy & Security**:
  - Strict tenant isolation (`assertTenantAccess`) preventing cross-company data leakage.
  - Role-based access control (`admin`, `super_admin`, `applicant`).
  - Time-based 2FA (TOTP) / Email OTP multi-factor authentication with brute-force rate limiters.
  - Cloud Firestore sync with hardened security rules (`firestore.rules`).
- **Proctored AI Interviewing Room**:
  - Camera/Microphone HUD sensors, full-screen lock enforcement, tab-switch anomaly detection, and automated infraction logging.
  - Speech-to-text dictation and real-time response evaluation.

---

## 🏗️ System Components & Directory Structure

```
├── build.js                   # esbuild bundler compiling React 19 frontend
├── server.js                  # Express.js HTTP application server & API routes
├── package.json               # Project manifest, scripts, and dependencies
├── firestore.rules            # Hardened Cloud Firestore security authorization rules
├── firebase-applet-config.json# Firebase Web client configuration
├── firebase-blueprint.json    # Application database schema definition
├── data/                      # Persistent JSON file stores (jobs, users, applications)
├── db/                        # In-memory & file-backed transactional store engine
├── middleware/                # Security, tenant isolation, auth, and sanitization
│   ├── sanitizeInput.js       # Anti-XSS and prototype pollution protection
│   └── tenantIsolation.js     # Multi-tenant isolation & JWT verification
├── routes/                    # Modular Express REST API controllers
│   ├── applications.js        # Candidate applications, screening, and EEOC audit
│   ├── audit.js               # Immutable compliance audit trails
│   ├── auth.js                # Registration, login, 2FA MFA verification
│   ├── companies.js           # Multi-tenant organization profiles
│   ├── decisions.js           # Calibrated offer generation & hiring decisions
│   ├── interview.js           # Proctored sessions, IRT adaptive questions & scoring
│   ├── jobs.js                # Job postings, skills configuration, career matching
│   └── skillVerification.js   # 5-minute standalone skill assessments & badges
├── services/                  # Business logic & AI/ML processing engines
│   ├── adaptiveIrtEngine.js   # 2PL Item Response Theory adaptive question selector
│   ├── analyzer.js            # Resume parsing, skill extraction, scoring & Gemini
│   ├── biasAuditor.js         # EEOC 4/5ths rule statistical parity engine
│   ├── careerRecommender.js   # Jaccard + TF-IDF job recommendations
│   ├── certificateVerification.js # OCR & certificate credential validator
│   ├── decisionEngine.js      # Calibrated compensation & hiring decision engine
│   ├── domainClassifier.js    # Naive Bayes engineering archetype classifier
│   ├── interviewEngine.js     # Interview question generator & response evaluator
│   ├── mfaService.js          # Two-factor authentication & OTP generation
│   ├── piiRedactor.js         # Blind recruitment PII scrubbing
│   └── vectorMatcher.js       # Sublinear TF-IDF and Cosine similarity engine
├── src/                       # React 19 Frontend source code
│   ├── db.js                  # Firebase SDK client initialization & bridge
│   └── react/
│       ├── AdminDashboard.jsx # Recruiter analytics, jobs, talent matrix & audit
│       ├── App.jsx            # Unified application shell & view router
│       └── components/        # Modals, charts (recharts/d3), and candidate views
└── public/                    # Static UI pages, styles, and compiled bundles
    ├── dist/app.bundle.js     # Compiled client bundle from src/react
    ├── index.html             # Landing portal
    ├── recruiter.html         # Recruiter workspace
    ├── applicant.html         # Candidate job browsing, applications & skill passport
    ├── interview.html         # Real-time proctored AI interview stage
    ├── apply.html             # Application submission form
    ├── login.html / register.html # Authentication flows
    └── css/ & js/             # UI themes and client-side controllers
```

---

## 🚀 Quick Start & Running Locally

### Prerequisites
- **Node.js**: Version 18.x or 20.x+
- **npm**: Version 9.x+

### 1. Installation
Clone the repository and install all dependencies:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Configure your variables as needed:
```env
# Application Port
PORT=3000

# Security Secrets
JWT_SECRET=your_secure_jwt_secret_here

# Server-Side Generative AI (Gemini)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Cloud Firestore Client Overrides
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=

# Optional: SMTP for Live 2FA Emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### 3. Build Client Assets
Compile the React frontend bundle:
```bash
npm run build
```

### 4. Start the Application
Start the Node.js server:
```bash
npm start
```
The application will be live at `http://localhost:3000`.

---

## 🔑 Key Workflows

### 1. Recruiter / Company Workspace (`/recruiter` or `/admin`)
- **Job Management**: Create job openings with mandatory and preferred technical skills, experience requirements, and proctoring parameters.
- **AI Talent Screening**: Review candidate resumes automatically parsed into structured profiles with semantic matching scores, skill match percentages, and domain classification tags.
- **EEOC Adverse Impact Auditor**: Review real-time compliance metrics calculated using the 4/5ths Rule to ensure unbiased candidate progression.
- **Candidate Decisions**: Generate automated, calibrated offer proposals or feedback letters based on interview performance and market salary bands.

### 2. Candidate Portal (`/applicant` or `/students`)
- **Personalized Recommendations**: Discover best-fit job openings ranked by in-engine Jaccard and TF-IDF career matching.
- **Resume Submission**: Upload PDF or image resumes with automated OCR parsing, instant feedback, and verified credential extraction.
- **Skill Passport**: Earn verified skill badges through timed, cheat-resistant 5-minute technical micro-assessments.

### 3. Proctored AI Interview Stage (`/interview`)
- Real-time technical interview conducted by the AI interview engine.
- Continuous integrity monitoring (face tracking, tab-switching, multi-voice detection).
- 2PL IRT adaptive difficulty dynamically branching questions based on candidate depth of knowledge.

---

## 📊 Evaluation & Scoring Engine

| Dimension | Weight | Description |
| :--- | :---: | :--- |
| **Semantic Fit** | 35% | Cosine similarity of resume text embeddings to the job specification |
| **Skill Match** | 35% | Verification of mandatory and optional skill tokens |
| **Experience Fit** | 20% | Tenure, seniority calibration, and progression analysis |
| **Certifications** | 10% | Validated credentials verified through OCR and authenticity checks |

Candidates are categorized into:
- **Top Tier (≥ 80%)**: Strongly recommended for immediate technical rounds.
- **Qualified (65% – 79%)**: Meets core requirements with minor skill gaps.
- **Review Needed (< 65%)**: Missing mandatory criteria or below experience threshold.

---

## 🛡️ Security & Compliance

- **Immutable Audit Logging**: Every administrative action, candidate status change, and login attempt is logged with actor metadata, tenant ID, and timestamps.
- **Tenant Isolation**: Recruiter queries enforce tenant bounds to prevent unauthorized multi-organization data viewing.
- **Cloud Firestore Security**: Rules strictly enforce owner-only read/write access and authenticated execution.
- **Input Sanitization**: Express request bodies, query strings, and headers are recursively stripped of potential XSS payloads and prototype pollution vectors.

---

## 📝 License

Distributed under the ISC License. Designed for enterprise recruitment and talent intelligence.
