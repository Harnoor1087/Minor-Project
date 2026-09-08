// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'applicant') {
    window.location.href = '/login';
}

// Display user name in profile chip
const userNameEl = document.getElementById('userName');
if (userNameEl) {
    userNameEl.innerHTML = `👤 <span>${user.name}</span> <span style="font-size: 0.75rem; opacity: 0.8; margin-left: 4px;">(Applicant)</span>`;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Local cache
let allJobs = [];
let myApplications = [];

// Tab switching
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) targetTab.classList.add('active');
    
    const targetBtn = document.getElementById('tabBtn' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (targetBtn) {
        targetBtn.classList.add('active');
    } else if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    }
    
    if (tabName === 'browse') {
        loadJobs();
    } else if (tabName === 'myapps') {
        loadMyApplications();
    }
}

// Update applicant stats overview
function updateApplicantStats() {
    const jobsCountEl = document.getElementById('appTotalJobs');
    const appliedCountEl = document.getElementById('appTotalApplied');
    const avgScoreEl = document.getElementById('appAvgScore');

    if (jobsCountEl) jobsCountEl.textContent = allJobs.length;
    if (appliedCountEl) appliedCountEl.textContent = myApplications.length;

    if (avgScoreEl) {
        if (myApplications.length > 0) {
            let total = 0;
            let scoredCount = 0;
            myApplications.forEach(app => {
                if (app.scores && typeof app.scores.final === 'number') {
                    total += app.scores.final;
                    scoredCount++;
                }
            });
            if (scoredCount > 0) {
                const avg = (total / scoredCount) * 100;
                avgScoreEl.textContent = `${avg.toFixed(0)}%`;
            } else {
                avgScoreEl.textContent = '--';
            }
        } else {
            avgScoreEl.textContent = '--';
        }
    }
}

// Helper to calculate score tier
function getScoreTier(val) {
    if (val >= 0.7) return 'tier-high';
    if (val >= 0.5) return 'tier-mid';
    return 'tier-low';
}

// Render Job Card for Applicants
function renderJobCard(job) {
    const title = job.title || 'Untitled Role';
    const description = job.description || 'No description available';
    const mandatorySkills = Array.isArray(job.mandatory_skills) ? job.mandatory_skills : [];
    const optionalSkills = Array.isArray(job.optional_skills) ? job.optional_skills : [];

    return `
        <div class="job-card" id="applicantJobCard-${job.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                <h3 style="margin: 0;">${title}</h3>
                <span class="skill-tag" style="background: var(--bg-subtle);">Job ID: <strong>#${job.id}</strong></span>
            </div>
            <p>${description}</p>
            <div class="job-skills">
                <strong>Key Required Skills:</strong>
                ${mandatorySkills.map(skill => 
                    `<span class="skill-tag mandatory">⚠️ ${skill.trim()}</span>`
                ).join('') || '<span style="color: var(--text-muted); font-size: 0.85rem;">None specified</span>'}
            </div>
            <div class="job-skills">
                <strong>Preferred / Bonus Skills:</strong>
                ${optionalSkills.map(skill => 
                    `<span class="skill-tag">💡 ${skill.trim()}</span>`
                ).join('') || '<span style="color: var(--text-muted); font-size: 0.85rem;">None specified</span>'}
            </div>
            ${job.certification_enabled ? '<p style="font-size: 0.9rem; color: var(--success); font-weight: 500;">🏅 Certifications are actively evaluated for this role</p>' : ''}
            <div class="job-actions" style="margin-top: 1rem;">
                <button class="btn-primary" onclick="window.location.href='/apply.html?jobId=${job.id}'">🚀 Apply with Resume</button>
            </div>
        </div>
    `;
}

// Filter applicant jobs
function filterApplicantJobs() {
    const query = (document.getElementById('applicantJobSearchInput')?.value || '').toLowerCase().trim();
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    const filtered = allJobs.filter(job => {
        const titleMatch = (job.title || '').toLowerCase().includes(query);
        const descMatch = (job.description || '').toLowerCase().includes(query);
        const skillMatch = (job.mandatory_skills || []).some(s => s.toLowerCase().includes(query)) ||
                           (job.optional_skills || []).some(s => s.toLowerCase().includes(query));
        return titleMatch || descMatch || skillMatch;
    });

    if (filtered.length > 0) {
        jobsList.innerHTML = filtered.map(renderJobCard).join('');
    } else {
        jobsList.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 No roles match your search.</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">Try a broader keyword or check back soon for new postings.</p>
            </div>
        `;
    }
}

// Load jobs
async function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;
    jobsList.innerHTML = '<div class="loading"><span>⏳ Loading available positions...</span></div>';
    
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        
        allJobs = data.jobs || [];
        updateApplicantStats();
        filterApplicantJobs();
    } catch (error) {
        console.error('Error loading jobs:', error);
        jobsList.innerHTML = '<p class="error-message show">Error loading jobs. Please refresh.</p>';
    }
}

// Load my applications
async function loadMyApplications() {
    const appsList = document.getElementById('myApplicationsList');
    if (!appsList) return;
    appsList.innerHTML = '<div class="loading"><span>⏳ Loading your applications...</span></div>';
    
    try {
        const response = await fetch('/api/applications/my-applications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const applications = await response.json();
        
        myApplications = Array.isArray(applications) ? applications : [];
        updateApplicantStats();
        
        if (myApplications.length > 0) {
            appsList.innerHTML = myApplications.map(app => {
                const finalVal = app.scores && typeof app.scores.final === 'number' ? app.scores.final : 0;
                const semanticVal = app.scores && typeof app.scores.semantic === 'number' ? app.scores.semantic : 0;
                const skillVal = app.scores && typeof app.scores.skill === 'number' ? app.scores.skill : 0;
                const expVal = app.scores && typeof app.scores.experience === 'number' ? app.scores.experience : 0;

                const finalPct = (finalVal * 100).toFixed(0);
                const semanticPct = (semanticVal * 100).toFixed(0);
                const skillPct = (skillVal * 100).toFixed(0);
                const expPct = (expVal * 100).toFixed(0);

                const finalTier = getScoreTier(finalVal);
                const semanticTier = getScoreTier(semanticVal);
                const skillTier = getScoreTier(skillVal);
                const expTier = getScoreTier(expVal);

                const formattedDate = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric'
                }) : 'Recent';

                let interviewBtn = `
                    <button class="btn-primary" style="padding: 0.45rem 1.15rem; font-size: 0.88rem; background: linear-gradient(135deg, #4f46e5, #06b6d4); border: none; display: inline-flex; align-items: center; gap: 6px; font-weight: 700;" onclick="window.location.href='/interview/${app._id}'">
                        <span>🎙️</span> Take AI Technical Assessment
                    </button>
                `;

                if (app.interview) {
                    if (app.interview.status === 'completed') {
                        interviewBtn = `
                            <button class="btn-secondary" style="padding: 0.45rem 1.15rem; font-size: 0.88rem; border-color: var(--success); color: var(--success); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="window.location.href='/interview/${app._id}'">
                                <span>🎯</span> AI Assessment: ${app.interview.overallScore}%
                            </button>
                        `;
                    } else if (app.interview.status === 'disqualified') {
                        interviewBtn = `
                            <span class="badge badge-danger" style="padding: 0.45rem 0.9rem; font-size: 0.85rem;">
                                🚫 Disqualified (Cheating Violation)
                            </span>
                        `;
                    } else if (app.interview.status === 'in_progress') {
                        interviewBtn = `
                            <button class="btn-primary" style="padding: 0.45rem 1.15rem; font-size: 0.88rem; background: var(--warning); border-color: var(--warning); display: inline-flex; align-items: center; gap: 6px; font-weight: 700;" onclick="window.location.href='/interview/${app._id}'">
                                <span>⚡</span> Resume Proctored Assessment
                            </button>
                        `;
                    }
                }

                let pTierTag = `<span class="badge badge-info" style="font-size: 0.78rem;">Proctoring: Standard</span>`;
                if (app.proctoringLevel === 'high') {
                    pTierTag = `<span class="badge badge-danger" style="font-size: 0.78rem;">Proctoring: Strict (Webcam & Fullscreen)</span>`;
                } else if (app.proctoringLevel === 'low') {
                    pTierTag = `<span class="badge badge-success" style="font-size: 0.78rem;">Proctoring: Basic</span>`;
                }

                // Phase 5: Decision status badge & Action Button
                let decisionBadge = '';
                let decisionActionBtn = '';
                if (app.decision && app.decision.finalized) {
                    if (app.decision.verdict === 'STRONG_HIRE') {
                        decisionBadge = `<span class="badge" style="background: var(--success-light); color: var(--success-text); font-weight: 700; border: 1px solid currentColor;">🎉 Official Offer Extended</span>`;
                        decisionActionBtn = `
                            <button class="btn-primary" style="padding: 0.45rem 1.15rem; font-size: 0.88rem; background: linear-gradient(135deg, #059669, #10b981); border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);" onclick="openApplicantOfferModal('${app._id}')">
                                <span>🎉</span> View Official Offer
                            </button>
                        `;
                    } else if (app.decision.verdict === 'REJECT') {
                        decisionBadge = `<span class="badge" style="background: var(--danger-light); color: var(--danger-text); font-weight: 700; border: 1px solid currentColor;">Feedback Ready</span>`;
                        decisionActionBtn = `
                            <button class="btn-secondary" style="padding: 0.45rem 1.15rem; font-size: 0.88rem; border-color: var(--accent); color: var(--accent); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;" onclick="openApplicantFeedbackModal('${app._id}')">
                                <span>🌱</span> Career Growth Roadmap
                            </button>
                        `;
                    } else {
                        decisionBadge = `<span class="badge" style="background: var(--warning-light); color: var(--warning-text); font-weight: 700; border: 1px solid currentColor;">🟡 Under Review</span>`;
                    }
                }

                return `
                    <div class="application-card" id="appCard-${app._id}">
                        <div class="application-header">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.35rem; flex-wrap: wrap;">
                                    ${pTierTag}
                                    ${decisionBadge}
                                </div>
                                <h3>${app.jobTitle}</h3>
                                <p style="color: var(--text-secondary); font-size: 0.9rem;">Job ID: <strong>#${app.jobId}</strong></p>
                            </div>
                            <span class="status-badge status-${app.status}">${(app.status || 'pending').toUpperCase()}</span>
                        </div>
                        
                        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; font-size: 0.9rem; color: var(--text-secondary);">
                            <span>📅 <strong>Applied:</strong> ${formattedDate}</span>
                            ${app.category ? `<span>•</span><span>🏷️ <strong>Category:</strong> ${app.category}</span>` : ''}
                            <span>•</span>
                            <span>🎯 <strong>Evaluation:</strong> <span style="font-weight: 600; color: ${app.eligibility === 'Eligible' ? 'var(--success)' : 'var(--text-secondary)'};">${app.eligibility || 'Screened'}</span></span>
                        </div>
                        
                        ${app.scores ? `
                            <div class="score-grid">
                                <div class="score-item">
                                    <div class="score-value ${finalTier}">${finalPct}%</div>
                                    <div class="score-label">Overall Match</div>
                                    <div class="score-bar-bg">
                                        <div class="score-bar-fill ${finalTier}" style="width: ${finalPct}%;"></div>
                                    </div>
                                </div>
                                <div class="score-item">
                                    <div class="score-value ${semanticTier}">${semanticPct}%</div>
                                    <div class="score-label">Semantic Match</div>
                                    <div class="score-bar-bg">
                                        <div class="score-bar-fill ${semanticTier}" style="width: ${semanticPct}%;"></div>
                                    </div>
                                </div>
                                <div class="score-item">
                                    <div class="score-value ${skillTier}">${skillPct}%</div>
                                    <div class="score-label">Skills Match</div>
                                    <div class="score-bar-bg">
                                        <div class="score-bar-fill ${skillTier}" style="width: ${skillPct}%;"></div>
                                    </div>
                                </div>
                                <div class="score-item">
                                    <div class="score-value ${expTier}">${expPct}%</div>
                                    <div class="score-label">Experience</div>
                                    <div class="score-bar-bg">
                                        <div class="score-bar-fill ${expTier}" style="width: ${expPct}%;"></div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="job-actions" style="margin-top: 1rem; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
                            ${interviewBtn}
                            ${decisionActionBtn}
                            <button class="btn-secondary" style="padding: 0.45rem 1rem; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px;" onclick="viewDetails('${app._id}')">
                                <span>✨</span> AI Coaching & Feedback
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            appsList.innerHTML = `
                <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border-radius: 14px; border: 1px dashed var(--border-color);">
                    <p style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">You haven't applied to any roles yet.</p>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Explore available openings and get instant AI-powered compatibility feedback.</p>
                    <button class="btn-primary" onclick="showTab('browse')">🔍 Browse Available Jobs</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading applications:', error);
        appsList.innerHTML = '<p class="error-message show">Error loading applications. Please refresh.</p>';
    }
}

// View application details and AI Coaching Modal
async function viewDetails(appId) {
    const app = myApplications.find(a => a._id === appId);
    if (!app) return;

    const modal = document.getElementById('detailsModal');
    if (!modal) return;

    modal.classList.add('active');

    const titleEl = document.getElementById('detailJobTitle');
    const subtitleEl = document.getElementById('detailJobSubtitle');
    const statusEl = document.getElementById('detailStatusBadge');
    const scoreGridEl = document.getElementById('detailScoreGrid');
    const summaryEl = document.getElementById('detailExecutiveSummary');
    const strengthsEl = document.getElementById('detailStrengthsList');
    const tipsEl = document.getElementById('detailTipsList');
    const actionsEl = document.getElementById('detailActionsList');

    if (titleEl) titleEl.textContent = app.jobTitle;
    if (subtitleEl) subtitleEl.textContent = `Application ID: #${app.jobId} • Evaluation & Personalized Coaching`;
    if (statusEl) {
        statusEl.innerHTML = `<span class="status-badge status-${app.status}">${(app.status || 'pending').toUpperCase()}</span>`;
    }

    if (scoreGridEl && app.scores) {
        const finalPct = Math.round((app.scores.final || 0) * 100);
        const semanticPct = Math.round((app.scores.semantic || 0) * 100);
        const skillPct = Math.round((app.scores.skill || 0) * 100);
        const expPct = Math.round((app.scores.experience || 0) * 100);

        scoreGridEl.innerHTML = `
            <div class="score-item">
                <div class="score-value ${getScoreTier(app.scores.final)}">${finalPct}%</div>
                <div class="score-label">Overall Match</div>
            </div>
            <div class="score-item">
                <div class="score-value ${getScoreTier(app.scores.semantic)}">${semanticPct}%</div>
                <div class="score-label">Semantic Alignment</div>
            </div>
            <div class="score-item">
                <div class="score-value ${getScoreTier(app.scores.skill)}">${skillPct}%</div>
                <div class="score-label">Skill Coverage</div>
            </div>
            <div class="score-item">
                <div class="score-value ${getScoreTier(app.scores.experience)}">${expPct}%</div>
                <div class="score-label">Experience</div>
            </div>
        `;
    }

    if (summaryEl) {
        summaryEl.innerHTML = '<div style="color: var(--text-secondary);">⏳ Loading personalized AI assessment...</div>';
    }
    if (strengthsEl) strengthsEl.innerHTML = '<li>Evaluating resume highlights...</li>';
    if (tipsEl) tipsEl.innerHTML = '<li>Generating customized optimization tips...</li>';
    if (actionsEl) actionsEl.innerHTML = '<li>Analyzing next skill milestones...</li>';

    try {
        const response = await fetch(`/api/applications/${appId}/intelligence`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const intel = data.intelligence || {};

        if (summaryEl) {
            summaryEl.textContent = intel.executiveSummary || 'Your resume has been analyzed and indexed against this role.';
        }

        if (strengthsEl) {
            const strengths = Array.isArray(intel.coreStrengths) && intel.coreStrengths.length > 0
                ? intel.coreStrengths
                : ['Solid foundational background detected.'];
            strengthsEl.innerHTML = strengths.map(s => `<li style="margin-bottom: 0.35rem;">${s}</li>`).join('');
        }

        if (tipsEl) {
            const tips = intel.applicantFeedback && Array.isArray(intel.applicantFeedback.resumeTips) && intel.applicantFeedback.resumeTips.length > 0
                ? intel.applicantFeedback.resumeTips
                : [
                    'Quantify your impact using measurable outcomes and metrics.',
                    'Feature target role keywords explicitly in recent experience sections.'
                ];
            tipsEl.innerHTML = tips.map(t => `<li style="margin-bottom: 0.35rem;">${t}</li>`).join('');
        }

        if (actionsEl) {
            const actions = intel.applicantFeedback && Array.isArray(intel.applicantFeedback.suggestedActions) && intel.applicantFeedback.suggestedActions.length > 0
                ? intel.applicantFeedback.suggestedActions
                : [
                    'Explore technical certifications to formally validate domain knowledge.',
                    'Build and share open-source projects highlighting modern toolsets.'
                ];
            actionsEl.innerHTML = actions.map(a => `<li style="margin-bottom: 0.35rem;">${a}</li>`).join('');
        }
    } catch (err) {
        console.error('Error fetching intelligence:', err);
        if (summaryEl) {
            summaryEl.textContent = 'Unable to fetch real-time AI feedback at this moment. Please check your network connection or try again later.';
        }
    }
}

function closeDetailsModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.classList.remove('active');
}

// ==========================================================================
// Phase 5: Official Offer & Constructive Feedback Modal Functions
// ==========================================================================

function openApplicantOfferModal(appId) {
    const app = myApplications.find(a => a._id === appId);
    if (!app || !app.decision) return;

    const modal = document.getElementById('applicantOfferModal');
    if (!modal) return;

    const companySub = document.getElementById('applicantOfferCompanySub');
    const companyTitle = document.getElementById('appOfferCompanyTitle');
    const dateText = document.getElementById('appOfferDateText');
    const salaryVal = document.getElementById('appOfferSalaryVal');
    const equityVal = document.getElementById('appOfferEquityVal');
    const dateVal = document.getElementById('appOfferDateVal');
    const bodyText = document.getElementById('appOfferBodyText');
    const signerOrg = document.getElementById('appOfferSignerOrg');

    const companyName = app.companyName || 'AIRIS Talent Global';
    const comp = app.decision.compensation || {};

    if (companySub) companySub.textContent = `Issued by ${companyName}`;
    if (companyTitle) companyTitle.textContent = companyName;
    if (dateText) dateText.textContent = app.decision.finalizedAt ? new Date(app.decision.finalizedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString();

    if (salaryVal) salaryVal.textContent = comp.baseSalary || '$160,000 USD';
    if (equityVal) equityVal.textContent = comp.equity || '0.15%';
    if (dateVal) dateVal.textContent = comp.startDate ? new Date(comp.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'To Be Agreed';

    if (bodyText) {
        bodyText.textContent = app.decision.letter || `Dear ${app.applicantName},\n\nWe are absolutely delighted to extend an official offer of employment for the position of ${app.jobTitle} at ${companyName}.`;
    }

    if (signerOrg) signerOrg.textContent = companyName;

    modal.classList.add('active');
}

function closeApplicantOfferModal() {
    const modal = document.getElementById('applicantOfferModal');
    if (modal) modal.classList.remove('active');
}

function printApplicantOffer() {
    window.print();
}

function openApplicantFeedbackModal(appId) {
    const app = myApplications.find(a => a._id === appId);
    if (!app || !app.decision) return;

    const modal = document.getElementById('applicantFeedbackModal');
    if (!modal) return;

    const sub = document.getElementById('appFeedbackSub');
    const bodyText = document.getElementById('appFeedbackBodyText');

    if (sub) sub.textContent = `Target Role: ${app.jobTitle} (${app.companyName || 'AIRIS Talent'})`;
    if (bodyText) {
        bodyText.textContent = app.decision.letter || `Dear ${app.applicantName},\n\nThank you very much for your time and thoughtful engagement during our assessment process for the ${app.jobTitle} position.\n\nWhile we have decided not to advance your candidacy for this specific role at this time, our evaluation identified distinct areas of technical promise.`;
    }

    modal.classList.add('active');
}

function closeApplicantFeedbackModal() {
    const modal = document.getElementById('applicantFeedbackModal');
    if (modal) modal.classList.remove('active');
}

// Initial load
loadJobs();
(async function prefetchMyApps() {
    try {
        const response = await fetch('/api/applications/my-applications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const applications = await response.json();
        myApplications = Array.isArray(applications) ? applications : [];
        updateApplicantStats();
    } catch (e) {
        console.error('Error prefetching applications:', e);
    }
})();
