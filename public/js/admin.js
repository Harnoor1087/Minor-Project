// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
    window.location.href = '/login';
}

// Display user name in profile chip
const userNameEl = document.getElementById('userName');
if (userNameEl) {
    userNameEl.innerHTML = `👤 <span>${user.name}</span> <span style="font-size: 0.75rem; opacity: 0.8; margin-left: 4px;">(Admin)</span>`;
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Data cache for fast filtering and live statistics
let allJobs = [];
let allApplications = [];
let allCompanies = [];
let currentCompany = null;
let currentSelectedProctoringTier = 'medium';

// Load Company Workspace and Brand Settings
async function loadCompanyWorkspace() {
    try {
        const [meRes, allRes] = await Promise.all([
            fetch('/api/companies/me/workspace', {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch('/api/companies')
        ]);

        if (meRes.ok) {
            const meData = await meRes.json();
            currentCompany = meData.company || meData;
            updateWorkspaceBanner();
        }

        if (allRes.ok) {
            const allData = await allRes.json();
            allCompanies = Array.isArray(allData) ? allData : (allData.companies || []);
            populateCompanySelects();
        }
    } catch (err) {
        console.error('Error loading company workspace:', err);
    }
}

// Update workspace banner in header
function updateWorkspaceBanner() {
    if (!currentCompany) return;
    const logoEl = document.getElementById('adminCompLogo');
    const nameEl = document.getElementById('adminCompName');
    const indEl = document.getElementById('adminCompIndustryBadge');
    const tagEl = document.getElementById('adminCompTagline');
    const linkEl = document.getElementById('adminPublicCareersLink');

    if (logoEl) logoEl.textContent = currentCompany.logo || '🏢';
    if (nameEl) nameEl.textContent = currentCompany.name || 'Company Workspace';
    if (indEl) indEl.textContent = currentCompany.industry || 'Technology';
    if (tagEl) tagEl.textContent = currentCompany.tagline || currentCompany.description || 'Enterprise Proctored Hiring Portal';
    if (linkEl && currentCompany.slug) {
        linkEl.href = `/company/${currentCompany.slug}`;
        linkEl.title = `View public careers page for ${currentCompany.name}`;
    }
}

// Populate company dropdown options
function populateCompanySelects() {
    const jobFilter = document.getElementById('jobCompanyFilter');
    const appFilter = document.getElementById('appCompanyFilter');
    const matrixCompFilter = document.getElementById('matrixCompanyFilter');
    const createSelect = document.getElementById('create_companyId');
    const editSelect = document.getElementById('edit_companyId');

    const optionsHtml = allCompanies.map(c => 
        `<option value="${c.id}">${c.logo || '🏢'} ${c.name}</option>`
    ).join('');

    if (jobFilter) {
        jobFilter.innerHTML = '<option value="all">🏢 All Companies</option>' + optionsHtml;
    }
    if (appFilter) {
        appFilter.innerHTML = '<option value="all">🏢 All Companies</option>' + optionsHtml;
    }
    if (matrixCompFilter) {
        matrixCompFilter.innerHTML = '<option value="all">🏢 All Companies</option>' + optionsHtml;
    }
    if (createSelect) {
        createSelect.innerHTML = optionsHtml;
        if (currentCompany && currentCompany.id) {
            createSelect.value = currentCompany.id;
        }
    }
    if (editSelect) {
        editSelect.innerHTML = optionsHtml;
    }
}

// Company Settings Modal Controls
function openCompanySettingsModal() {
    if (!currentCompany) return;
    document.getElementById('comp_logo').value = currentCompany.logo || '🏢';
    document.getElementById('comp_name').value = currentCompany.name || '';
    document.getElementById('comp_industry').value = currentCompany.industry || '';
    document.getElementById('comp_location').value = currentCompany.location || '';
    document.getElementById('comp_website').value = currentCompany.website || '';
    document.getElementById('comp_tagline').value = currentCompany.tagline || '';
    document.getElementById('comp_description').value = currentCompany.description || '';
    
    const errDiv = document.getElementById('companySettingsError');
    if (errDiv) errDiv.classList.remove('show');
    
    const modal = document.getElementById('companySettingsModal');
    if (modal) modal.classList.add('active');
}

function closeCompanySettingsModal() {
    const modal = document.getElementById('companySettingsModal');
    if (modal) modal.classList.remove('active');
}

const companySettingsForm = document.getElementById('companySettingsForm');
if (companySettingsForm) {
    companySettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            logo: document.getElementById('comp_logo').value.trim() || '🏢',
            name: document.getElementById('comp_name').value.trim(),
            industry: document.getElementById('comp_industry').value.trim(),
            location: document.getElementById('comp_location').value.trim(),
            website: document.getElementById('comp_website').value.trim(),
            tagline: document.getElementById('comp_tagline').value.trim(),
            description: document.getElementById('comp_description').value.trim()
        };

        const errDiv = document.getElementById('companySettingsError');
        if (errDiv) errDiv.classList.remove('show');

        try {
            const res = await fetch('/api/companies/me/workspace', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                currentCompany = data.company;
                updateWorkspaceBanner();
                closeCompanySettingsModal();
                if (window.showToast) window.showToast('Company settings updated successfully!', 'success');
                // Refresh list of all companies
                const allRes = await fetch('/api/companies');
                if (allRes.ok) {
                    allCompanies = await allRes.json();
                    populateCompanySelects();
                }
            } else {
                if (errDiv) {
                    errDiv.textContent = data.message || 'Error updating settings';
                    errDiv.classList.add('show');
                }
            }
        } catch (err) {
            console.error('Failed to update company settings:', err);
            if (errDiv) {
                errDiv.textContent = 'Network error saving settings';
                errDiv.classList.add('show');
            }
        }
    });
}

// Proctoring Tier Selector
function selectProctoringTier(tier) {
    currentSelectedProctoringTier = tier;
    const tiers = ['low', 'medium', 'high'];
    
    tiers.forEach(t => {
        const card = document.getElementById(`tierCard-${t}`);
        const radio = document.getElementById(`tierRadio-${t}`);
        if (card) {
            if (t === tier) {
                card.style.borderColor = t === 'high' ? '#ef4444' : (t === 'medium' ? 'var(--accent)' : '#10b981');
                card.style.background = t === 'high' ? 'rgba(239, 68, 68, 0.05)' : (t === 'medium' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(16, 185, 129, 0.05)');
            } else {
                card.style.borderColor = 'var(--border-color)';
                card.style.background = 'transparent';
            }
        }
        if (radio) radio.checked = (t === tier);
    });

    const fsCb = document.getElementById('proctor_fullscreen');
    const micCb = document.getElementById('proctor_microphone');
    const mfCb = document.getElementById('proctor_multi_face');

    if (tier === 'high') {
        if (fsCb) fsCb.checked = true;
        if (micCb) micCb.checked = true;
        if (mfCb) mfCb.checked = true;
    } else if (tier === 'medium') {
        if (fsCb) fsCb.checked = false;
        if (micCb) micCb.checked = false;
        if (mfCb) mfCb.checked = true;
    } else {
        if (fsCb) fsCb.checked = false;
        if (micCb) micCb.checked = false;
        if (mfCb) mfCb.checked = false;
    }
}

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
    
    if (tabName === 'jobs') {
        loadJobs();
    } else if (tabName === 'applications') {
        loadApplications();
    } else if (tabName === 'matrix') {
        loadTalentMatrix();
    }
}

// Update KPI Stats Bar
function updateStatsOverview() {
    const totalJobsEl = document.getElementById('statTotalJobs');
    const totalAppsEl = document.getElementById('statTotalApps');
    const strongMatchesEl = document.getElementById('statStrongMatches');
    const pendingAppsEl = document.getElementById('statPendingApps');

    if (totalJobsEl) totalJobsEl.textContent = allJobs.length;
    if (totalAppsEl) totalAppsEl.textContent = allApplications.length;

    let strongMatches = 0;
    let pendingCount = 0;

    allApplications.forEach(app => {
        const finalScore = app.scores && typeof app.scores.final === 'number' ? app.scores.final : 0;
        if (finalScore >= 0.7) {
            strongMatches++;
        }
        if (app.status === 'pending') {
            pendingCount++;
        }
    });

    if (strongMatchesEl) strongMatchesEl.textContent = strongMatches;
    if (pendingAppsEl) pendingAppsEl.textContent = pendingCount;
}

// Score tier helper
function getScoreTier(val) {
    if (val >= 0.7) return 'tier-high';
    if (val >= 0.5) return 'tier-mid';
    return 'tier-low';
}

// Render Job Card HTML
function renderJobCard(job) {
    const mandatorySkills = Array.isArray(job.mandatory_skills) ? job.mandatory_skills : [];
    const optionalSkills = Array.isArray(job.optional_skills) ? job.optional_skills : [];
    const company = allCompanies.find(c => c.id === job.companyId) || { name: job.companyName || 'AIRIS Talent Global', logo: '🏢' };

    let proctorBadge = '';
    const pLevel = job.proctoring_level || (job.proctoring_config && job.proctoring_config.level) || 'medium';
    if (pLevel === 'high') {
        proctorBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);">🔴 Strict Enterprise Proctoring</span>`;
    } else if (pLevel === 'low') {
        proctorBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3);">🟢 Permissive Proctoring</span>`;
    } else {
        proctorBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3);">🟡 Standard Proctoring</span>`;
    }

    return `
        <div class="job-card" id="jobCard-${job.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.25rem; flex-wrap: wrap;">
                        <span class="skill-tag" style="background: rgba(99, 102, 241, 0.1); color: var(--accent); font-weight: 600;">${company.logo || '🏢'} ${company.name}</span>
                        ${job.department ? `<span class="skill-tag" style="background: var(--bg-subtle);">${job.department}</span>` : ''}
                        ${job.location ? `<span class="skill-tag" style="background: var(--bg-subtle);">📍 ${job.location}</span>` : ''}
                        ${job.employmentType ? `<span class="skill-tag" style="background: var(--bg-subtle);">⏱️ ${job.employmentType}</span>` : ''}
                        ${job.experienceLevel ? `<span class="skill-tag" style="background: var(--bg-subtle);">🎓 ${job.experienceLevel}</span>` : ''}
                    </div>
                    <h3 style="margin: 0; font-size: 1.2rem;">${job.title}</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    ${proctorBadge}
                    <span class="skill-tag" style="background: var(--bg-subtle);">Job ID: <strong>#${job.id}</strong></span>
                </div>
            </div>
            <p>${job.description}</p>
            <div class="job-skills">
                <strong>Mandatory Skills:</strong>
                ${mandatorySkills.map(skill => 
                    `<span class="skill-tag mandatory">⚠️ ${skill}</span>`
                ).join('') || '<span>None</span>'}
            </div>
            <div class="job-skills">
                <strong>Optional Skills:</strong>
                ${optionalSkills.map(skill => 
                    `<span class="skill-tag">💡 ${skill}</span>`
                ).join('') || '<span style="color: var(--text-muted); font-size: 0.85rem;">None</span>'}
            </div>
            <div style="display: flex; gap: 1rem; align-items: center; margin: 0.75rem 0; font-size: 0.9rem; color: var(--text-secondary); flex-wrap: wrap;">
                <span><strong>Certification Scoring:</strong> ${job.certification_enabled ? '✅ Enabled' : '❌ Disabled'}</span>
                ${job.certification_enabled ? `<span><strong>Weight:</strong> ${job.certification_weight}</span>` : ''}
                ${job.proctoring_config && job.proctoring_config.enforce_fullscreen ? '<span>🖥️ Fullscreen Locked</span>' : ''}
                ${job.proctoring_config && job.proctoring_config.require_microphone ? '<span>🎙️ Mic Monitored</span>' : ''}
            </div>
            <div class="job-actions">
                <button class="btn-primary" onclick="editJob(${job.id})">✏️ Edit Role</button>
                <a href="/apply.html?jobId=${job.id}" target="_blank" class="btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">🚀 Preview Candidate Apply</a>
                <button class="btn-danger" onclick="deleteJob(${job.id})">🗑️ Delete</button>
            </div>
        </div>
    `;
}

// Filter and render Jobs List
function filterJobsList() {
    const query = (document.getElementById('jobSearchInput')?.value || '').toLowerCase().trim();
    const compFilter = document.getElementById('jobCompanyFilter')?.value || 'all';
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    const filtered = allJobs.filter(job => {
        const titleMatch = (job.title || '').toLowerCase().includes(query);
        const descMatch = (job.description || '').toLowerCase().includes(query);
        const skillMatch = (job.mandatory_skills || []).some(s => s.toLowerCase().includes(query)) ||
                           (job.optional_skills || []).some(s => s.toLowerCase().includes(query));
        const searchMatch = titleMatch || descMatch || skillMatch;
        const compMatch = (compFilter === 'all') || (job.companyId === compFilter);
        return searchMatch && compMatch;
    });

    if (filtered.length > 0) {
        jobsList.innerHTML = filtered.map(renderJobCard).join('');
    } else {
        jobsList.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 No job listings match your search.</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">Try a different keyword or switch company filter.</p>
            </div>
        `;
    }
}

// Load jobs from API
async function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;
    jobsList.innerHTML = '<div class="loading"><span>⏳ Loading jobs...</span></div>';
    
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        
        allJobs = data.jobs || [];
        updateStatsOverview();
        filterJobsList();
        populateMatrixJobFilter();
    } catch (error) {
        console.error('Error loading jobs:', error);
        jobsList.innerHTML = '<p class="error-message show">Error loading jobs. Please refresh.</p>';
    }
}

// Render Application Card HTML
function renderApplicationCard(app) {
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

    const comp = allCompanies.find(c => c.id === app.companyId) || { name: 'AIRIS Talent Global', logo: '🏢' };
    const pLevel = app.proctoringLevel || 'medium';
    let proctorTag = '';
    if (pLevel === 'high') {
        proctorTag = `<span style="font-size: 0.75rem; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 0.15rem 0.5rem; border-radius: 6px;">🛡️ Strict Proctored</span>`;
    } else if (pLevel === 'low') {
        proctorTag = `<span style="font-size: 0.75rem; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 0.15rem 0.5rem; border-radius: 6px;">🟢 Basic Proctored</span>`;
    } else {
        proctorTag = `<span style="font-size: 0.75rem; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 0.15rem 0.5rem; border-radius: 6px;">🟡 Standard Proctored</span>`;
    }

    let interviewTag = '';
    if (app.interview) {
        if (app.interview.status === 'completed') {
            const isClean = app.interview.proctoringReport?.integrityStatus === 'CLEAN';
            interviewTag = `<span class="skill-tag" style="background: rgba(16, 185, 129, 0.12); color: var(--success); font-size: 0.78rem; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3);">🎯 Interview: ${app.interview.overallScore}% (${isClean ? '🛡️ Clean' : '⚠️ Flagged'})</span>`;
        } else if (app.interview.status === 'disqualified') {
            interviewTag = `<span class="skill-tag" style="background: rgba(239, 68, 68, 0.12); color: var(--danger); font-size: 0.78rem; font-weight: 700; border: 1px solid rgba(239, 68, 68, 0.3);">🚫 Disqualified (Cheating)</span>`;
        } else if (app.interview.status === 'in_progress') {
            interviewTag = `<span class="skill-tag" style="background: rgba(245, 158, 11, 0.12); color: var(--warning-text); font-size: 0.78rem; font-weight: 600;">⏳ Interview in Progress</span>`;
        }
    }

    return `
        <div class="application-card" id="appCard-${app._id}">
            <div class="application-header">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.25rem; flex-wrap: wrap;">
                        <span class="skill-tag" style="background: rgba(99, 102, 241, 0.1); color: var(--accent); font-size: 0.78rem;">${comp.logo || '🏢'} ${comp.name}</span>
                        ${proctorTag}
                        ${interviewTag}
                    </div>
                    <h3>👤 ${app.applicantName || 'Anonymous Candidate'}</h3>
                    <p>✉️ <a href="mailto:${app.applicantEmail}">${app.applicantEmail}</a></p>
                </div>
                <span class="status-badge status-${app.status}">${(app.status || 'pending').toUpperCase()}</span>
            </div>
            
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; font-size: 0.92rem; color: var(--text-secondary);">
                <span><strong>Role Applied:</strong> ${app.jobTitle} (Job #${app.jobId})</span>
                <span>•</span>
                <span><strong>Applied:</strong> ${formattedDate}</span>
                ${app.category ? `<span>•</span><span><strong>Category:</strong> ${app.category}</span>` : ''}
            </div>
            
            ${app.scores ? `
                <div class="score-grid">
                    <div class="score-item">
                        <div class="score-value ${finalTier}">${finalPct}%</div>
                        <div class="score-label">Final Match</div>
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
                        <div class="score-label">Skills Fit</div>
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
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; flex-wrap: wrap; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-subtle);">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        <strong>Eligibility:</strong> <span style="font-weight: 600; color: ${app.eligibility === 'Eligible' ? 'var(--success)' : 'var(--text-secondary)'};">${app.eligibility || 'Screened'}</span>
                    </div>
                    ${app.decision ? `
                        <span class="badge" style="background: ${app.decision.verdict === 'STRONG_HIRE' ? 'var(--success-light)' : (app.decision.verdict === 'REJECT' ? 'var(--danger-light)' : 'var(--warning-light)')}; color: ${app.decision.verdict === 'STRONG_HIRE' ? 'var(--success-text)' : (app.decision.verdict === 'REJECT' ? 'var(--danger-text)' : 'var(--warning-text)')}; font-weight: 700; border: 1px solid currentColor;">
                            ${app.decision.verdict === 'STRONG_HIRE' ? '🟢 Offer Ready' : (app.decision.verdict === 'REJECT' ? '🔴 Rejected' : '🟡 Review')}
                        </span>
                    ` : ''}
                    <button class="btn-primary" style="padding: 0.4rem 0.85rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;" onclick="openCandidateIntelligence('${app._id}')">
                        <span>🧠</span> Dossier
                    </button>
                    <button class="btn-secondary" style="padding: 0.4rem 0.85rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;" onclick="openDecisionModal('${app._id}')">
                        <span>📝</span> Decision & Offer
                    </button>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <label for="statusSelect-${app._id}" style="font-size: 0.88rem; font-weight: 600; color: var(--text-secondary);">Stage:</label>
                    <select id="statusSelect-${app._id}" class="filter-select" style="padding: 0.4rem 0.8rem;" onchange="updateStatus('${app._id}', this.value)">
                        <option value="pending" ${app.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                        <option value="reviewed" ${app.status === 'reviewed' ? 'selected' : ''}>👀 Reviewed</option>
                        <option value="accepted" ${app.status === 'accepted' ? 'selected' : ''}>✅ Accepted</option>
                        <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
                    </select>
                </div>
            </div>
        </div>
    `;
}

// Filter and render Applications List
function filterApplicationsList() {
    const query = (document.getElementById('appSearchInput')?.value || '').toLowerCase().trim();
    const compFilter = document.getElementById('appCompanyFilter')?.value || 'all';
    const statusFilter = document.getElementById('appStatusFilter')?.value || 'all';
    const matchFilter = document.getElementById('appMatchFilter')?.value || 'all';
    const appsList = document.getElementById('applicationsList');
    if (!appsList) return;

    const filtered = allApplications.filter(app => {
        const textMatch = (app.applicantName || '').toLowerCase().includes(query) ||
                          (app.applicantEmail || '').toLowerCase().includes(query) ||
                          (app.jobTitle || '').toLowerCase().includes(query);
        
        const compMatch = (compFilter === 'all') || (app.companyId === compFilter);
        const statusMatch = (statusFilter === 'all') || (app.status === statusFilter);

        let matchScoreMatch = true;
        const finalScore = app.scores && typeof app.scores.final === 'number' ? app.scores.final : 0;
        if (matchFilter === 'high') matchScoreMatch = finalScore >= 0.7;
        if (matchFilter === 'mid') matchScoreMatch = finalScore >= 0.5 && finalScore < 0.7;
        if (matchFilter === 'low') matchScoreMatch = finalScore < 0.5;

        return textMatch && compMatch && statusMatch && matchScoreMatch;
    });

    if (filtered.length > 0) {
        appsList.innerHTML = filtered.map(renderApplicationCard).join('');
    } else {
        appsList.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 No applications match your filter criteria.</p>
                <p style="font-size: 0.9rem; color: var(--text-muted);">Try resetting search filters or switching company filter.</p>
            </div>
        `;
    }
}

// Load applications from API
async function loadApplications() {
    const appsList = document.getElementById('applicationsList');
    if (!appsList) return;
    appsList.innerHTML = '<div class="loading"><span>⏳ Loading applications...</span></div>';
    
    try {
        const response = await fetch('/api/applications/all', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const applications = await response.json();
        
        allApplications = Array.isArray(applications) ? applications : [];
        updateStatsOverview();
        filterApplicationsList();
    } catch (error) {
        console.error('Error loading applications:', error);
        appsList.innerHTML = '<p class="error-message show">Error loading applications. Please refresh.</p>';
    }
}

// Update application status with Toast notification
async function updateStatus(appId, status) {
    if (!status) return;
    
    try {
        const response = await fetch(`/api/applications/${appId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            const app = allApplications.find(a => a._id === appId);
            if (app) app.status = status;
            
            if (window.showToast) {
                window.showToast(`Candidate status updated to ${status.toUpperCase()}`, 'success');
            }
            updateStatsOverview();
            filterApplicationsList();
        } else {
            if (window.showToast) window.showToast('Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        if (window.showToast) window.showToast('Network error updating status', 'error');
    }
}

// Create job form handling
const createJobForm = document.getElementById('createJobForm');
const certEnabledCheckbox = document.getElementById('certification_enabled');
const certWeightGroup = document.getElementById('certWeightGroup');

if (certEnabledCheckbox && certWeightGroup) {
    certEnabledCheckbox.addEventListener('change', (e) => {
        certWeightGroup.style.display = e.target.checked ? 'block' : 'none';
    });
}

if (createJobForm) {
    createJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectedProctorLevel = document.querySelector('input[name="proctoring_level"]:checked')?.value || 'medium';
        const formData = {
            companyId: document.getElementById('create_companyId')?.value || (currentCompany ? currentCompany.id : 'comp-airis-001'),
            department: document.getElementById('department')?.value || 'Engineering',
            location: document.getElementById('location')?.value || 'Remote',
            employmentType: document.getElementById('employmentType')?.value || 'Full-time',
            experienceLevel: document.getElementById('experienceLevel')?.value || 'Mid Level',
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            mandatory_skills: document.getElementById('mandatory_skills').value.split(',').map(s => s.trim()).filter(Boolean),
            optional_skills: document.getElementById('optional_skills').value.split(',').map(s => s.trim()).filter(Boolean),
            certification_enabled: document.getElementById('certification_enabled').checked,
            certification_weight: parseFloat(document.getElementById('certification_weight').value) || 0.2,
            proctoring_level: selectedProctorLevel,
            proctoring_config: {
                level: selectedProctorLevel,
                enforce_fullscreen: !!document.getElementById('proctor_fullscreen')?.checked,
                require_microphone: !!document.getElementById('proctor_microphone')?.checked,
                multi_face_detection: !!document.getElementById('proctor_multi_face')?.checked
            }
        };
        
        const errorDiv = document.getElementById('createJobError');
        if (errorDiv) errorDiv.classList.remove('show');
        
        try {
            const response = await fetch('/api/jobs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (window.showToast) window.showToast('Job listing created successfully with proctoring suite!', 'success');
                createJobForm.reset();
                if (certWeightGroup) certWeightGroup.style.display = 'none';
                selectProctoringTier('medium');
                showTab('jobs');
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.message || 'Error creating job';
                    errorDiv.classList.add('show');
                }
            }
        } catch (error) {
            console.error('Error creating job:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Error connecting to server';
                errorDiv.classList.add('show');
            }
        }
    });
}

// Edit job modal logic
async function editJob(jobId) {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        
        document.getElementById('edit_job_id').value = job.job_id || job.id;
        if (document.getElementById('edit_companyId')) {
            document.getElementById('edit_companyId').value = job.companyId || (currentCompany ? currentCompany.id : 'comp-airis-001');
        }
        if (document.getElementById('edit_department')) {
            document.getElementById('edit_department').value = job.department || 'Engineering';
        }
        if (document.getElementById('edit_location')) {
            document.getElementById('edit_location').value = job.location || 'Remote';
        }
        if (document.getElementById('edit_employmentType')) {
            document.getElementById('edit_employmentType').value = job.employmentType || 'Full-time';
        }
        if (document.getElementById('edit_experienceLevel')) {
            document.getElementById('edit_experienceLevel').value = job.experienceLevel || 'Mid Level';
        }
        document.getElementById('edit_title').value = job.title;
        document.getElementById('edit_description').value = job.description;
        document.getElementById('edit_mandatory_skills').value = (job.mandatory_skills || []).join(', ');
        document.getElementById('edit_optional_skills').value = (job.optional_skills || []).join(', ');
        document.getElementById('edit_certification_enabled').checked = !!job.certification_enabled;
        document.getElementById('edit_certification_weight').value = job.certification_weight || 0.2;
        
        const pLevel = job.proctoring_level || (job.proctoring_config && job.proctoring_config.level) || 'medium';
        if (document.getElementById('edit_proctoring_level')) {
            document.getElementById('edit_proctoring_level').value = pLevel;
        }
        if (document.getElementById('edit_proctor_fullscreen')) {
            document.getElementById('edit_proctor_fullscreen').checked = !!(job.proctoring_config && job.proctoring_config.enforce_fullscreen);
        }
        if (document.getElementById('edit_proctor_microphone')) {
            document.getElementById('edit_proctor_microphone').checked = !!(job.proctoring_config && job.proctoring_config.require_microphone);
        }
        if (document.getElementById('edit_proctor_multi_face')) {
            document.getElementById('edit_proctor_multi_face').checked = !(job.proctoring_config && job.proctoring_config.multi_face_detection === false);
        }

        document.getElementById('editModal').classList.add('active');
    } catch (error) {
        console.error('Error loading job details:', error);
        if (window.showToast) window.showToast('Error loading job details', 'error');
    }
}

function closeEditModal() {
    const editModal = document.getElementById('editModal');
    if (editModal) editModal.classList.remove('active');
}

const editJobForm = document.getElementById('editJobForm');
if (editJobForm) {
    editJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const jobId = document.getElementById('edit_job_id').value;
        const pLevel = document.getElementById('edit_proctoring_level')?.value || 'medium';
        const formData = {
            companyId: document.getElementById('edit_companyId')?.value,
            department: document.getElementById('edit_department')?.value,
            location: document.getElementById('edit_location')?.value,
            employmentType: document.getElementById('edit_employmentType')?.value,
            experienceLevel: document.getElementById('edit_experienceLevel')?.value,
            title: document.getElementById('edit_title').value,
            description: document.getElementById('edit_description').value,
            mandatory_skills: document.getElementById('edit_mandatory_skills').value.split(',').map(s => s.trim()).filter(Boolean),
            optional_skills: document.getElementById('edit_optional_skills').value.split(',').map(s => s.trim()).filter(Boolean),
            certification_enabled: document.getElementById('edit_certification_enabled').checked,
            certification_weight: parseFloat(document.getElementById('edit_certification_weight').value) || 0.2,
            proctoring_level: pLevel,
            proctoring_config: {
                level: pLevel,
                enforce_fullscreen: !!document.getElementById('edit_proctor_fullscreen')?.checked,
                require_microphone: !!document.getElementById('edit_proctor_microphone')?.checked,
                multi_face_detection: !!document.getElementById('edit_proctor_multi_face')?.checked
            }
        };
        
        const errorDiv = document.getElementById('editJobError');
        if (errorDiv) errorDiv.classList.remove('show');
        
        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (window.showToast) window.showToast('Job updated successfully!', 'success');
                closeEditModal();
                loadJobs();
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.message || 'Error updating job';
                    errorDiv.classList.add('show');
                }
            }
        } catch (error) {
            console.error('Error updating job:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Error updating job';
                errorDiv.classList.add('show');
            }
        }
    });
}

// Delete job with confirmation toast
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job listing?')) return;
    
    try {
        const response = await fetch(`/api/jobs/${jobId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            if (window.showToast) window.showToast('Job listing deleted', 'success');
            loadJobs();
        } else {
            if (window.showToast) window.showToast('Error deleting job', 'error');
        }
    } catch (error) {
        console.error('Error deleting job:', error);
        if (window.showToast) window.showToast('Error deleting job', 'error');
    }
}

// Initial prefetch of workspace, jobs, and applications for live KPI counters
loadCompanyWorkspace();
selectProctoringTier('medium');
loadJobs();
(async function prefetchApplications() {
    try {
        const response = await fetch('/api/applications/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const applications = await response.json();
        allApplications = Array.isArray(applications) ? applications : [];
        updateStatsOverview();
    } catch (e) {
        console.error('Error prefetching applications:', e);
    }
})();

// ==========================================
// AI Candidate Intelligence Dossier Controls
// ==========================================
let currentIntelligenceAppId = null;
let currentIntelligenceData = null;

async function openCandidateIntelligence(appId, forceRefresh = false) {
    currentIntelligenceAppId = appId;
    const modal = document.getElementById('intelligenceModal');
    if (!modal) return;

    modal.classList.add('active');

    const nameEl = document.getElementById('intelModalCandidateName');
    const roleEl = document.getElementById('intelModalRoleTitle');
    const summaryEl = document.getElementById('intelExecutiveSummary');
    const badgeEl = document.getElementById('intelRecommendationBadge');
    const scoreGridEl = document.getElementById('intelScoreGrid');
    const strengthsEl = document.getElementById('intelStrengthsList');
    const gapsEl = document.getElementById('intelGapsList');
    const questionsEl = document.getElementById('intelQuestionsList');
    const askResponseEl = document.getElementById('recruiterAskResponse');
    const askInputEl = document.getElementById('recruiterAskInput');

    if (askResponseEl) askResponseEl.style.display = 'none';
    if (askInputEl) askInputEl.value = '';

    if (summaryEl) {
        summaryEl.innerHTML = '<div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary);"><span>⏳</span> Synthesizing AI Candidate Intelligence Dossier...</div>';
    }
    if (strengthsEl) strengthsEl.innerHTML = '<li>Analyzing skills and competencies...</li>';
    if (gapsEl) gapsEl.innerHTML = '<li>Evaluating job requirement alignment...</li>';
    if (questionsEl) questionsEl.innerHTML = '<div style="padding: 1rem; color: var(--text-muted);">Generating role-specific technical questions...</div>';

    // Find local app cache for initial details
    const localApp = allApplications.find(a => a._id === appId);
    if (localApp) {
        if (nameEl) nameEl.textContent = `${localApp.applicantName} • AI Dossier`;
        if (roleEl) roleEl.textContent = `Applied for: ${localApp.jobTitle} • ID #${localApp.jobId}`;
        
        if (scoreGridEl && localApp.scores) {
            const finalPct = Math.round((localApp.scores.final || 0) * 100);
            const semanticPct = Math.round((localApp.scores.semantic || 0) * 100);
            const skillPct = Math.round((localApp.scores.skill || 0) * 100);
            const expPct = Math.round((localApp.scores.experience || 0) * 100);

            scoreGridEl.innerHTML = `
                <div class="score-item">
                    <div class="score-value ${getScoreTier(localApp.scores.final)}">${finalPct}%</div>
                    <div class="score-label">Final Match</div>
                </div>
                <div class="score-item">
                    <div class="score-value ${getScoreTier(localApp.scores.semantic)}">${semanticPct}%</div>
                    <div class="score-label">Semantic Match</div>
                </div>
                <div class="score-item">
                    <div class="score-value ${getScoreTier(localApp.scores.skill)}">${skillPct}%</div>
                    <div class="score-label">Skills Match</div>
                </div>
                <div class="score-item">
                    <div class="score-value ${getScoreTier(localApp.scores.experience)}">${expPct}%</div>
                    <div class="score-label">Experience</div>
                </div>
            `;
        }
    }

    try {
        const url = `/api/applications/${appId}/intelligence${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        currentIntelligenceData = data;
        renderIntelligenceModalData(data);
    } catch (err) {
        console.error('Error fetching intelligence:', err);
        if (summaryEl) {
            summaryEl.innerHTML = `<span style="color: var(--danger);">Failed to load candidate intelligence: ${err.message}. Please try clicking Refresh Analysis.</span>`;
        }
    }
}

function renderIntelligenceModalData(data) {
    const intel = data.intelligence || {};
    const nameEl = document.getElementById('intelModalCandidateName');
    const roleEl = document.getElementById('intelModalRoleTitle');
    const summaryEl = document.getElementById('intelExecutiveSummary');
    const badgeEl = document.getElementById('intelRecommendationBadge');
    const strengthsEl = document.getElementById('intelStrengthsList');
    const gapsEl = document.getElementById('intelGapsList');
    const questionsEl = document.getElementById('intelQuestionsList');
    const genTextEl = document.getElementById('intelGeneratedByText');

    if (nameEl) nameEl.textContent = `${data.candidateName || 'Candidate'} • Intelligence Dossier`;
    if (roleEl) roleEl.textContent = `Applied for: ${data.jobTitle || 'Role'}`;

    // Recommendation Badge
    if (badgeEl && intel.hiringRecommendation) {
        const decision = intel.hiringRecommendation.decision || 'Screened';
        let badgeColor = 'var(--accent)';
        let badgeBg = 'var(--accent-light)';
        if (decision.toLowerCase().includes('strong') || decision.toLowerCase().includes('advance')) {
            badgeColor = 'var(--success)';
            badgeBg = 'rgba(16, 185, 129, 0.15)';
        } else if (decision.toLowerCase().includes('not') || decision.toLowerCase().includes('hold')) {
            badgeColor = 'var(--danger)';
            badgeBg = 'rgba(239, 68, 68, 0.15)';
        }
        badgeEl.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 0.4rem 0.9rem; border-radius: 9999px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 700; font-size: 0.88rem; border: 1px solid ${badgeColor};">
                <span>🎯</span> ${decision}
            </span>
        `;
    }

    // Summary
    if (summaryEl) {
        summaryEl.textContent = intel.executiveSummary || 'No summary generated.';
    }

    // Strengths
    if (strengthsEl) {
        const strengths = Array.isArray(intel.coreStrengths) && intel.coreStrengths.length > 0
            ? intel.coreStrengths
            : ['Demonstrated relevant technical background.'];
        strengthsEl.innerHTML = strengths.map(s => `<li style="margin-bottom: 0.35rem;">${s}</li>`).join('');
    }

    // Gaps
    if (gapsEl) {
        const gaps = Array.isArray(intel.skillGaps) && intel.skillGaps.length > 0
            ? intel.skillGaps
            : ['No major skill blockers detected.'];
        gapsEl.innerHTML = gaps.map(g => `<li style="margin-bottom: 0.35rem;">${g}</li>`).join('');
    }

    // Interview Questions
    if (questionsEl) {
        const questions = Array.isArray(intel.interviewQuestions) ? intel.interviewQuestions : [];
        if (questions.length > 0) {
            questionsEl.innerHTML = questions.map((q, idx) => `
                <div style="background: var(--bg-card); border-radius: 8px; padding: 1rem; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.25rem;">
                        <span style="font-weight: 700; font-size: 0.85rem; color: var(--accent); text-transform: uppercase;">
                            Question ${idx + 1}: ${q.focus || 'Technical Depth'}
                        </span>
                    </div>
                    <p style="margin: 0 0 0.5rem 0; font-weight: 600; font-size: 0.95rem; color: var(--text-primary); line-height: 1.5;">
                        "${q.question}"
                    </p>
                    <div style="background: var(--bg-subtle); padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.82rem; color: var(--text-secondary);">
                        <strong style="color: var(--text-primary);">Target Signals:</strong> ${q.expectedSignals || 'Assess technical depth and clarity of communication.'}
                    </div>
                </div>
            `).join('');
        } else {
            questionsEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No interview questions available.</p>';
        }
    }

    if (genTextEl) {
        genTextEl.textContent = intel.generatedBy ? `${intel.generatedBy} • Analyzed on ${new Date().toLocaleDateString()}` : 'Powered by AIRIS Intelligence Engine';
    }

    // Render Proctored Interview & Telemetry Section
    renderInterviewTelemetrySection(data);

    // Phase 5: Render Enterprise Decision & Leveling Calibration Section
    renderDecisionIntelligenceSection(data);
}

function renderInterviewTelemetrySection(data) {
    const headerBadges = document.getElementById('intelInterviewHeaderBadges');
    const content = document.getElementById('intelInterviewContent');
    if (!content) return;

    // Resolve interview data from application payload or local app cache
    const app = allApplications.find(a => a._id === (data.applicationId || currentIntelligenceAppId)) || {};
    const interview = data.interview || app.interview;

    if (!interview || interview.status === 'not_started' || !interview.status) {
        if (headerBadges) {
            headerBadges.innerHTML = `<span class="badge" style="background: var(--bg-subtle); color: var(--text-muted);">Status: Assessment Not Started</span>`;
        }
        content.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; background: var(--bg-subtle); border-radius: 10px; border: 1px dashed var(--border-color);">
                <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: var(--text-primary);">Candidate has not taken the AI Technical Assessment yet.</p>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">The applicant can launch the proctored session anytime from their candidate portal.</p>
            </div>
        `;
        return;
    }

    const proctorReport = interview.proctoringReport || { integrityStatus: 'CLEAN', infractionCount: 0, infractions: [] };
    const infractions = Array.isArray(proctorReport.infractions) ? proctorReport.infractions : [];
    const questions = Array.isArray(interview.questions) ? interview.questions : [];
    const score = typeof interview.overallScore === 'number' ? interview.overallScore : '--';
    const isDisqualified = interview.status === 'disqualified' || proctorReport.integrityStatus === 'DISQUALIFIED';

    // Header Badges
    if (headerBadges) {
        let statusBadge = `<span class="badge badge-success">Completed</span>`;
        if (isDisqualified) {
            statusBadge = `<span class="badge badge-danger">Disqualified (Cheating)</span>`;
        } else if (interview.status === 'in_progress') {
            statusBadge = `<span class="badge badge-warning">In Progress</span>`;
        }

        let integrityBadge = `<span class="badge badge-success" style="background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success);">🛡️ Clean (0 Infractions)</span>`;
        if (isDisqualified) {
            integrityBadge = `<span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger);">🚫 Breached Integrity (${proctorReport.infractionCount || infractions.length} Infractions)</span>`;
        } else if (proctorReport.integrityStatus === 'FLAGGED' || (proctorReport.infractionCount > 0)) {
            integrityBadge = `<span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.15); color: var(--warning-text); border: 1px solid var(--warning);">⚠️ Flagged (${proctorReport.infractionCount || infractions.length} Infractions)</span>`;
        }

        headerBadges.innerHTML = `
            ${statusBadge}
            ${integrityBadge}
            <span style="font-weight: 800; font-size: 0.95rem; color: var(--primary);">Score: ${score}%</span>
        `;
    }

    // Build Content HTML
    let infractionsHtml = '';
    if (infractions.length > 0) {
        infractionsHtml = `
            <div style="background: rgba(239, 68, 68, 0.08); border-radius: 10px; padding: 1rem; border-left: 3px solid var(--danger); margin-bottom: 1.25rem;">
                <h5 style="margin: 0 0 0.5rem 0; color: var(--danger); font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                    <span>🚨</span> Recorded Proctoring Infractions Timeline (${infractions.length})
                </h5>
                <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem; font-family: monospace;">
                    ${infractions.map(inf => `
                        <div style="display: flex; justify-content: space-between; gap: 0.5rem; color: var(--danger-text);">
                            <span>• [${inf.type}] ${inf.message}</span>
                            <span style="opacity: 0.75;">${new Date(inf.timestamp).toLocaleTimeString()}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        infractionsHtml = `
            <div style="background: rgba(16, 185, 129, 0.08); border-radius: 10px; padding: 0.75rem 1rem; border-left: 3px solid var(--success); margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--success-text);">
                ✅ <strong>Zero Malpractice Infractions:</strong> Complete webcam presence, audio integrity, and browser lock maintained throughout the assessment.
            </div>
        `;
    }

    // Questions Transcript
    let questionsHtml = '';
    if (questions.length > 0) {
        questionsHtml = `
            <h5 style="margin: 0 0 0.75rem 0; font-size: 0.92rem; color: var(--text-primary);">Evaluated Assessment Questions (${questions.length})</h5>
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${questions.map((q, idx) => {
                    const qScore = q.evaluation?.score ?? '--';
                    return `
                        <div style="background: var(--bg-subtle); border-radius: 10px; padding: 1rem; border: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.5rem;">
                                <strong style="font-size: 0.88rem; color: var(--primary);">Q${idx + 1}: ${q.category || 'Competency'} • <span style="font-weight: normal; color: var(--text-secondary);">${q.targetArea || ''}</span></strong>
                                <span class="badge" style="background: var(--bg-surface); border: 1px solid var(--border-color); font-weight: 700; font-size: 0.82rem;">Score: ${qScore}%</span>
                            </div>
                            <p style="margin: 0 0 0.6rem 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 500;">${q.question}</p>
                            
                            <div style="background: var(--bg-surface); padding: 0.65rem 0.85rem; border-radius: 6px; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.6rem; border: 1px solid var(--border-subtle); max-height: 100px; overflow-y: auto;">
                                <strong>Candidate Answer:</strong> "${q.candidateAnswer || '(No answer provided)'}"
                            </div>
                            
                            ${q.evaluation ? `
                                <div style="display: flex; gap: 1rem; font-size: 0.8rem; margin-bottom: 0.4rem; color: var(--text-secondary); flex-wrap: wrap;">
                                    <span>Accuracy: <strong>${q.evaluation.technicalAccuracy || q.evaluation.score}%</strong></span>
                                    <span>Depth: <strong>${q.evaluation.depthAndPracticality || q.evaluation.score}%</strong></span>
                                    <span>Clarity: <strong>${q.evaluation.clarityAndCommunication || q.evaluation.score}%</strong></span>
                                </div>
                                <div style="font-size: 0.82rem; color: var(--text-muted);">
                                    <strong>AI Feedback:</strong> ${q.evaluation.feedback || 'Evaluated successfully.'}
                                </div>
                            ` : '<div style="font-size: 0.8rem; color: var(--text-muted);">Evaluation in progress...</div>'}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    content.innerHTML = `
        ${infractionsHtml}
        ${questionsHtml}
    `;
}

function closeIntelligenceModal() {
    const modal = document.getElementById('intelligenceModal');
    if (modal) modal.classList.remove('active');
}

async function refreshCandidateIntelligence() {
    if (!currentIntelligenceAppId) return;
    if (window.showToast) window.showToast('Regenerating AI candidate intelligence...', 'info');
    await openCandidateIntelligence(currentIntelligenceAppId, true);
    if (window.showToast) window.showToast('Candidate intelligence refreshed!', 'success');
}

function copyInterviewKit() {
    if (!currentIntelligenceData || !currentIntelligenceData.intelligence) {
        if (window.showToast) window.showToast('No interview kit to copy', 'error');
        return;
    }
    const intel = currentIntelligenceData.intelligence;
    const questions = intel.interviewQuestions || [];
    let text = `AIRIS Candidate Interview Kit\nCandidate: ${currentIntelligenceData.candidateName}\nRole: ${currentIntelligenceData.jobTitle}\nRecommendation: ${intel.hiringRecommendation?.decision || 'N/A'}\n\n`;
    text += `Summary:\n${intel.executiveSummary}\n\nQuestions:\n`;
    questions.forEach((q, idx) => {
        text += `${idx + 1}. [${q.focus}] ${q.question}\nTarget Signals: ${q.expectedSignals}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast('Interview Kit copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        if (window.showToast) window.showToast('Could not copy to clipboard', 'error');
    });
}

async function submitRecruiterAsk() {
    const input = document.getElementById('recruiterAskInput');
    const responseEl = document.getElementById('recruiterAskResponse');
    const btn = document.getElementById('recruiterAskBtn');
    if (!input || !currentIntelligenceAppId) return;

    const question = input.value.trim();
    if (!question) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Thinking...';
    }
    if (responseEl) {
        responseEl.style.display = 'block';
        responseEl.innerHTML = '<div style="color: var(--text-muted); display: flex; align-items: center; gap: 8px;"><span>⏳</span> Consulting AIRIS AI Intelligence...</div>';
    }

    try {
        const res = await fetch(`/api/applications/${currentIntelligenceAppId}/ask-candidate-ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question })
        });

        const data = await res.json();
        if (responseEl) {
            responseEl.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 0.35rem; color: var(--accent); font-size: 0.85rem;">AIRIS Recruiter Co-Pilot:</div>
                <div style="color: var(--text-primary); white-space: pre-line;">${data.answer || 'No response generated.'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">${data.generatedBy || 'AIRIS Intelligence'}</div>
            `;
        }
    } catch (err) {
        if (responseEl) {
            responseEl.innerHTML = `<span style="color: var(--danger);">Error asking AI: ${err.message}</span>`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Ask AI';
        }
    }
}

// ==========================================================================
// Phase 5: Enterprise Talent Matrix, Calibration & Decision Engine
// ==========================================================================

let currentMatrixData = [];
let selectedForComparison = new Set();
let currentDecisionAppId = null;
let currentDecisionCalibration = null;

// Populate Matrix Job filter dropdown
function populateMatrixJobFilter() {
    const jobSelect = document.getElementById('matrixJobFilter');
    if (!jobSelect) return;
    const optionsHtml = allJobs.map(j => `<option value="${j.id}">#${j.id} - ${j.title}</option>`).join('');
    jobSelect.innerHTML = '<option value="all">💼 All Job Openings</option>' + optionsHtml;
}

// Render Decision Section in Candidate Intelligence Modal
async function renderDecisionIntelligenceSection(data) {
    const section = document.getElementById('intelDecisionSection');
    const badgeContainer = document.getElementById('intelChiBadgeContainer');
    const levelEl = document.getElementById('intelCalibratedLevel');
    const compEl = document.getElementById('intelSalaryBenchmark');
    const rampEl = document.getElementById('intelRampUpWeeks');
    const statusEl = document.getElementById('intelCurrentDecisionStatus');

    if (!section) return;

    const appId = data.applicationId || currentIntelligenceAppId;
    const localApp = allApplications.find(a => a._id === appId) || {};

    // Initial placeholder state
    if (badgeContainer) badgeContainer.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Calibrating index...</span>`;
    if (levelEl) levelEl.textContent = 'Calculating...';
    if (compEl) compEl.textContent = 'Benchmarking...';
    if (rampEl) rampEl.textContent = 'Estimating...';

    try {
        const res = await fetch(`/api/decisions/calibrate/${appId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const calData = await res.json();
            const chi = calData.chi || {};
            const leveling = calData.leveling || {};
            const comp = leveling.compensation || {};

            // Render CHI Badge
            if (badgeContainer) {
                const chiClass = chi.score >= 80 ? 'chi-high' : (chi.score >= 70 ? 'chi-mid' : (chi.score >= 50 ? 'chi-low' : 'chi-disqualified'));
                badgeContainer.innerHTML = `
                    <div class="chi-badge ${chiClass}" title="Resume (35%) + Interview (45%) + Integrity (20%)">
                        <span>⚡ CHI:</span>
                        <span>${chi.score}%</span>
                        <span class="badge" style="font-size: 0.75rem; background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color);">${chi.verdict}</span>
                    </div>
                `;
            }

            if (levelEl) levelEl.textContent = `${leveling.level || 'L4'} (${leveling.title || 'Software Engineer'})`;
            if (compEl) compEl.textContent = comp.baseSalary || '$145,000 - $165,000 USD';
            if (rampEl) rampEl.textContent = `${leveling.rampUpWeeks || 3} Weeks`;

            // Existing finalized decision check
            const decision = calData.decision || localApp.decision;
            if (statusEl) {
                if (decision && decision.finalized) {
                    const vColor = decision.verdict === 'STRONG_HIRE' ? 'var(--success)' : (decision.verdict === 'REJECT' ? 'var(--danger)' : 'var(--warning)');
                    statusEl.innerHTML = `
                        <span style="font-weight: 700; color: ${vColor};">
                            ${decision.verdict === 'STRONG_HIRE' ? '✅ Formal Offer Extended' : (decision.verdict === 'REJECT' ? '🔴 Constructive Rejection Dispatched' : '🟡 Review in Progress')}
                        </span>
                        <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(${new Date(decision.finalizedAt).toLocaleDateString()})</span>
                    `;
                } else {
                    statusEl.innerHTML = `<span style="color: var(--text-secondary);">No formal verdict recorded yet. Recommended: <strong>${chi.verdict}</strong></span>`;
                }
            }
        }
    } catch (e) {
        console.error('Error calibrating intelligence decision:', e);
        if (badgeContainer) badgeContainer.innerHTML = '';
        if (levelEl) levelEl.textContent = 'L4 Intermediate';
        if (compEl) compEl.textContent = '$135,000 - $155,000 USD';
        if (rampEl) rampEl.textContent = '4 Weeks';
    }
}

// Print Dossier sheet
function exportCandidateDossierPrint() {
    window.print();
}

// Open Decision modal directly from Intelligence view
function openDecisionModalFromIntel() {
    if (!currentIntelligenceAppId) return;
    openDecisionModal(currentIntelligenceAppId);
}

// Load Cohort Talent Matrix from Backend
async function loadTalentMatrix() {
    const tbody = document.getElementById('matrixTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
                <span>⏳ Computing Composite Hiring Index (CHI) and calibrating candidate cohort...</span>
            </td>
        </tr>
    `;

    const jobFilter = document.getElementById('matrixJobFilter')?.value || 'all';
    const compFilter = document.getElementById('matrixCompanyFilter')?.value || 'all';

    let url = '/api/decisions/matrix';
    const params = [];
    if (jobFilter !== 'all') params.push(`jobId=${encodeURIComponent(jobFilter)}`);
    if (compFilter !== 'all') params.push(`companyId=${encodeURIComponent(compFilter)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Matrix request failed with status ${res.status}`);

        const data = await res.json();
        currentMatrixData = Array.isArray(data.matrix) ? data.matrix : [];

        // Update Cohort KPI cards
        const totalEl = document.getElementById('cohortTotalCandidates');
        const completedEl = document.getElementById('cohortCompletedAssessments');
        const avgChiEl = document.getElementById('cohortAvgChi');
        const topEl = document.getElementById('cohortTopCandidate');

        if (totalEl) totalEl.textContent = currentMatrixData.length;
        
        let completedCount = 0;
        let chiSum = 0;
        currentMatrixData.forEach(c => {
            if (c.interview && (c.interview.status === 'completed' || c.interview.status === 'disqualified')) {
                completedCount++;
            }
            chiSum += (c.chi?.score || 0);
        });

        if (completedEl) completedEl.textContent = completedCount;
        if (avgChiEl) {
            const avg = currentMatrixData.length ? Math.round(chiSum / currentMatrixData.length) : 0;
            avgChiEl.textContent = `${avg}%`;
        }
        if (topEl) {
            topEl.textContent = currentMatrixData[0] ? currentMatrixData[0].applicantName : 'None';
            topEl.title = currentMatrixData[0] ? `${currentMatrixData[0].applicantName} (${currentMatrixData[0].chi?.score || 0}% CHI)` : '';
        }

        filterMatrixCandidates();
    } catch (err) {
        console.error('Error loading talent matrix:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--danger);">
                    Error loading talent matrix: ${err.message}. Click Refresh Matrix to retry.
                </td>
            </tr>
        `;
    }
}

// Filter the Matrix Leaderboard locally
function filterMatrixCandidates() {
    const minChi = parseInt(document.getElementById('matrixMinChiFilter')?.value || '0', 10);
    const search = (document.getElementById('matrixSearchInput')?.value || '').toLowerCase().trim();

    const filtered = currentMatrixData.filter(cand => {
        const score = cand.chi?.score || 0;
        if (score < minChi) return false;

        if (search) {
            const name = (cand.applicantName || '').toLowerCase();
            const email = (cand.applicantEmail || '').toLowerCase();
            const role = (cand.jobTitle || '').toLowerCase();
            const skills = (cand.skills || []).join(' ').toLowerCase();
            if (!name.includes(search) && !email.includes(search) && !role.includes(search) && !skills.includes(search)) {
                return false;
            }
        }
        return true;
    });

    renderTalentMatrixTable(filtered);
}

// Render the Stack-Ranked Leaderboard Table
function renderTalentMatrixTable(candidates) {
    const tbody = document.getElementById('matrixTableBody');
    if (!tbody) return;

    if (!candidates || candidates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">🔍 No candidates found in this matrix view</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Adjust your search keyword or change filter criteria.</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = candidates.map((cand, index) => {
        const rank = cand.rank || (index + 1);
        let rankBadgeClass = 'rank-other';
        let rankIcon = `#${rank}`;
        if (rank === 1) {
            rankBadgeClass = 'rank-1';
            rankIcon = '🥇 1';
        } else if (rank === 2) {
            rankBadgeClass = 'rank-2';
            rankIcon = '🥈 2';
        } else if (rank === 3) {
            rankBadgeClass = 'rank-3';
            rankIcon = '🥉 3';
        }

        const chi = cand.chi || { score: 0, breakdown: {}, verdict: 'Screened' };
        const score = chi.score || 0;
        let chiTheme = 'chi-low';
        if (score >= 80) chiTheme = 'chi-high';
        else if (score >= 70) chiTheme = 'chi-mid';
        else if (chi.verdict === 'DISQUALIFIED') chiTheme = 'chi-disqualified';

        // Triad details
        const resumePct = chi.breakdown?.resumeScorePct ?? Math.round((cand.scores?.final || 0) * 100);
        const intPct = chi.breakdown?.interviewScorePct ?? (cand.interview?.overallScore ?? '--');
        const proctorStatus = cand.interview?.proctoringReport?.integrityStatus || 'CLEAN';
        const isDisqualified = proctorStatus === 'DISQUALIFIED';

        // Decision status
        let decisionBadge = `<span class="badge" style="background: var(--bg-subtle); color: var(--text-secondary);">Pending Review</span>`;
        if (cand.decision && cand.decision.finalized) {
            if (cand.decision.verdict === 'STRONG_HIRE') {
                decisionBadge = `<span class="badge" style="background: var(--success-light); color: var(--success-text); font-weight: 700;">🟢 Offer Extended</span>`;
            } else if (cand.decision.verdict === 'REJECT') {
                decisionBadge = `<span class="badge" style="background: var(--danger-light); color: var(--danger-text); font-weight: 700;">🔴 Feedback Sent</span>`;
            } else {
                decisionBadge = `<span class="badge" style="background: var(--warning-light); color: var(--warning-text); font-weight: 700;">🟡 Second Round</span>`;
            }
        }

        const isChecked = selectedForComparison.has(cand._id);

        return `
            <tr id="matrixRow-${cand._id}">
                <td style="text-align: center;">
                    <input type="checkbox" value="${cand._id}" ${isChecked ? 'checked' : ''} onchange="toggleSelectMatrixCandidate('${cand._id}', this.checked)">
                </td>
                <td style="text-align: center;">
                    <span class="rank-badge ${rankBadgeClass}">${rankIcon}</span>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.98rem;">${cand.applicantName}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${cand.applicantEmail}</div>
                    ${cand.experienceYears ? `<span class="badge" style="margin-top: 4px; font-size: 0.72rem; background: var(--bg-subtle);">${cand.experienceYears} yrs exp</span>` : ''}
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--text-primary);">${cand.jobTitle || 'Role'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${cand.companyName || 'AIRIS Talent'}</div>
                </td>
                <td>
                    <div class="chi-meter ${chiTheme}">
                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                            <span class="chi-badge">⚡ ${score}%</span>
                            <span style="font-size: 0.75rem; font-weight: 600;">${chi.verdict}</span>
                        </div>
                        <div class="chi-bar-bg">
                            <div class="chi-bar-fill" style="width: ${Math.min(100, Math.max(5, score))}%;"></div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="triad-group">
                        <div class="triad-row">
                            <span>📄 Resume Match:</span>
                            <strong>${resumePct}%</strong>
                        </div>
                        <div class="triad-row">
                            <span>🎙️ Assessment:</span>
                            <strong>${typeof intPct === 'number' ? `${intPct}%` : intPct}</strong>
                        </div>
                        <div class="triad-row">
                            <span>🛡️ Integrity:</span>
                            <span style="font-weight: 700; color: ${isDisqualified ? 'var(--danger)' : 'var(--success)'};">${isDisqualified ? 'FLAGGED' : 'CLEAN'}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--accent);">${cand.leveling?.level || 'L4'} ${cand.leveling?.title || 'Engineer'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">${cand.leveling?.compensation?.baseSalary || '$145,000 - $165,000'}</div>
                </td>
                <td>
                    ${decisionBadge}
                </td>
                <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                        <button class="btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.8rem;" onclick="openCandidateIntelligence('${cand._id}')" title="Full Dossier">
                            🧠 Dossier
                        </button>
                        <button class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: var(--primary);" onclick="openDecisionModal('${cand._id}')" title="Decision & Offer Suite">
                            📝 Decision
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Select/Deselect single candidate for comparison
function toggleSelectMatrixCandidate(appId, isChecked) {
    if (isChecked) {
        if (selectedForComparison.size >= 4) {
            if (window.showToast) window.showToast('You can compare up to 4 candidates at once.', 'warning');
            const rowCheck = document.querySelector(`input[value="${appId}"]`);
            if (rowCheck) rowCheck.checked = false;
            return;
        }
        selectedForComparison.add(appId);
    } else {
        selectedForComparison.delete(appId);
    }
    updateMatrixBottomBar();
}

// Select All / Deselect All
function toggleSelectAllMatrix(isChecked) {
    selectedForComparison.clear();
    const checkboxes = document.querySelectorAll('#matrixTableBody input[type="checkbox"]');
    if (isChecked) {
        let count = 0;
        checkboxes.forEach(cb => {
            if (count < 4) {
                cb.checked = true;
                selectedForComparison.add(cb.value);
                count++;
            } else {
                cb.checked = false;
            }
        });
        if (checkboxes.length > 4 && window.showToast) {
            window.showToast('Selected top 4 candidates for comparison.', 'info');
        }
    } else {
        checkboxes.forEach(cb => cb.checked = false);
    }
    updateMatrixBottomBar();
}

// Update sticky bottom action bar
function updateMatrixBottomBar() {
    const bar = document.getElementById('matrixBottomBar');
    const countEl = document.getElementById('selectedCompareCount');
    const btn = document.getElementById('launchCompareBtn');
    if (!bar) return;

    const size = selectedForComparison.size;
    if (size > 0) {
        bar.style.display = 'flex';
        if (countEl) countEl.textContent = `${size} candidate${size > 1 ? 's' : ''} selected`;
        if (btn) {
            if (size >= 2) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.textContent = `Compare ${size} Candidates Head-to-Head ➔`;
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.6';
                btn.textContent = 'Select at least 2 candidates';
            }
        }
    } else {
        bar.style.display = 'none';
    }
}

// Clear selected comparison list
function clearSelectedComparisons() {
    selectedForComparison.clear();
    const checkboxes = document.querySelectorAll('#matrixTable input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateMatrixBottomBar();
}

// Open Head-to-Head Comparison Modal
async function openHeadToHeadComparison() {
    if (selectedForComparison.size < 2) {
        if (window.showToast) window.showToast('Please select at least 2 candidates to compare.', 'warning');
        return;
    }

    const modal = document.getElementById('comparisonModal');
    const content = document.getElementById('comparisonModalContent');
    if (!modal || !content) return;

    modal.classList.add('active');
    content.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary); width: 100%;"><span>⏳ Generating comparative multi-attribute matrix...</span></div>';

    try {
        const appIds = Array.from(selectedForComparison);
        const res = await fetch('/api/decisions/compare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ applicationIds: appIds })
        });

        if (!res.ok) throw new Error(`Comparison API returned ${res.status}`);
        const data = await res.json();
        const candidates = data.candidates || [];
        const topCandidateId = data.topPickId || (candidates[0] ? candidates[0]._id : null);

        content.innerHTML = candidates.map(cand => {
            const isTop = cand._id === topCandidateId;
            const chi = cand.chi || { score: 0 };
            const triad = cand.triad || {};
            const leveling = cand.leveling || {};
            const skills = Array.isArray(cand.skills) ? cand.skills : [];

            return `
                <div class="comparison-card ${isTop ? 'top-pick' : ''}">
                    ${isTop ? '<span class="top-pick-badge">⭐ Top Cohort Fit</span>' : ''}
                    <div>
                        <div style="font-weight: 800; font-size: 1.25rem; color: var(--text-primary); margin-bottom: 0.2rem;">${cand.applicantName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">${cand.jobTitle || 'Role'}</div>
                    </div>

                    <!-- CHI Metric -->
                    <div style="background: var(--bg-subtle); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-color); text-align: center;">
                        <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 700; margin-bottom: 0.2rem;">Composite Hiring Index</div>
                        <div style="font-size: 2rem; font-weight: 800; color: ${isTop ? 'var(--primary)' : 'var(--accent)'};">${chi.score}%</div>
                        <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${chi.verdict}</div>
                    </div>

                    <!-- Multi Attribute Breakdown -->
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
                            <span style="color: var(--text-secondary);">📄 Resume Semantic Fit:</span>
                            <strong>${triad.resumeScorePct}%</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
                            <span style="color: var(--text-secondary);">🎙️ Technical Assessment:</span>
                            <strong>${typeof triad.interviewScorePct === 'number' ? `${triad.interviewScorePct}%` : triad.interviewScorePct}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
                            <span style="color: var(--text-secondary);">🛡️ Proctoring Integrity:</span>
                            <strong style="color: ${triad.integrityScorePct < 100 ? 'var(--danger)' : 'var(--success)'};">${triad.integrityScorePct < 100 ? 'Flagged Anomaly' : 'Clean (100%)'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
                            <span style="color: var(--text-secondary);">🎯 Calibrated Level:</span>
                            <strong>${leveling.level || 'L4'}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
                            <span style="color: var(--text-secondary);">💰 Target Salary:</span>
                            <strong style="color: var(--primary);">${leveling.compensation?.baseSalary || '$150k'}</strong>
                        </div>
                    </div>

                    <!-- Skills Pills -->
                    <div>
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.4rem; text-transform: uppercase;">Top Technical Proficiencies</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${skills.slice(0, 6).map(s => `<span class="badge" style="background: var(--bg-subtle); font-size: 0.75rem;">${s}</span>`).join('')}
                        </div>
                    </div>

                    <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-subtle); display: flex; gap: 0.5rem;">
                        <button class="btn-primary" style="flex: 1; padding: 0.5rem; font-size: 0.85rem;" onclick="closeComparisonModal(); openDecisionModal('${cand._id}');">
                            Draft Decision & Offer
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error rendering comparison modal:', err);
        content.innerHTML = `<div style="padding: 2rem; color: var(--danger); text-align: center;">Failed to generate candidate comparison: ${err.message}</div>`;
    }
}

function closeComparisonModal() {
    const modal = document.getElementById('comparisonModal');
    if (modal) modal.classList.remove('active');
}

function exportComparisonPrint() {
    window.print();
}

// Export Cohort Leaderboard to CSV
function exportCohortSummaryReport() {
    if (!currentMatrixData || currentMatrixData.length === 0) {
        if (window.showToast) window.showToast('No cohort candidates to export.', 'warning');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Rank,Candidate Name,Email,Role,Company,Composite Hiring Index (CHI),Verdict,Resume Match %,Interview Score %,Integrity Status,Level,Base Salary Benchmark,Decision Status\n';

    currentMatrixData.forEach((cand, idx) => {
        const rank = cand.rank || (idx + 1);
        const name = `"${(cand.applicantName || '').replace(/"/g, '""')}"`;
        const email = cand.applicantEmail || '';
        const role = `"${(cand.jobTitle || '').replace(/"/g, '""')}"`;
        const company = `"${(cand.companyName || '').replace(/"/g, '""')}"`;
        const chi = cand.chi?.score || 0;
        const verdict = cand.chi?.verdict || 'Screened';
        const resume = cand.chi?.breakdown?.resumeScorePct ?? Math.round((cand.scores?.final || 0) * 100);
        const interview = cand.chi?.breakdown?.interviewScorePct ?? (cand.interview?.overallScore ?? 'N/A');
        const integrity = cand.interview?.proctoringReport?.integrityStatus || 'CLEAN';
        const level = cand.leveling?.level || 'L4';
        const salary = `"${(cand.leveling?.compensation?.baseSalary || '').replace(/"/g, '""')}"`;
        const decStatus = cand.decision?.verdict || 'PENDING';

        csvContent += `${rank},${name},${email},${role},${company},${chi}%,${verdict},${resume}%,${interview}%,${integrity},${level},${salary},${decStatus}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AIRIS_Talent_Cohort_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) window.showToast('Cohort summary exported to CSV successfully!', 'success');
}

// ==========================================================================
// Phase 5: Decision & Offer Suite Logic
// ==========================================================================

async function openDecisionModal(appId) {
    currentDecisionAppId = appId;
    const modal = document.getElementById('decisionModal');
    if (!modal) return;

    modal.classList.add('active');

    const subEl = document.getElementById('decisionCandidateSub');
    const headerBadge = document.getElementById('decisionChiHeaderBadge');
    const letterBody = document.getElementById('decisionLetterBody');
    const salaryInput = document.getElementById('offerBaseSalary');
    const equityInput = document.getElementById('offerEquity');
    const startDateInput = document.getElementById('offerStartDate');

    if (letterBody) letterBody.value = 'Synthesizing tailored corporate offer letter via Gemini AI...';

    // Default start date = 30 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    if (startDateInput) startDateInput.value = defaultDate.toISOString().split('T')[0];

    try {
        const res = await fetch(`/api/decisions/calibrate/${appId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(`Calibration returned ${res.status}`);
        const calData = await res.json();
        currentDecisionCalibration = calData;

        const candName = calData.candidateName || 'Candidate';
        const jobTitle = calData.jobTitle || 'Role';
        const comp = calData.leveling?.compensation || {};
        const chi = calData.chi || {};

        if (subEl) subEl.textContent = `Calibrating ${candName} for ${jobTitle}`;

        if (headerBadge) {
            headerBadge.innerHTML = `
                <div class="chi-badge chi-high" style="font-size: 1.1rem; padding: 0.4rem 0.8rem; background: var(--bg-subtle); border-radius: 8px; border: 1px solid var(--border-color);">
                    <span>⚡ CHI: ${chi.score || 85}%</span>
                    <span class="badge" style="font-size: 0.75rem; background: var(--primary-light); color: var(--primary);">${chi.verdict || 'STRONG_HIRE'}</span>
                </div>
            `;
        }

        // Set inputs
        if (salaryInput) salaryInput.value = comp.baseSalary || '$155,000 USD';
        if (equityInput) equityInput.value = comp.equity || '0.15% Options';

        // Check if decision was already recorded
        if (calData.decision && calData.decision.finalized) {
            const savedVerdict = calData.decision.verdict || 'STRONG_HIRE';
            const radio = document.querySelector(`input[name="decisionVerdict"][value="${savedVerdict}"]`);
            if (radio) radio.checked = true;

            if (savedVerdict === 'REJECT') {
                toggleDecisionForm('reject');
            } else if (savedVerdict === 'CONSIDER_WITH_RESERVATIONS') {
                toggleDecisionForm('consider');
            } else {
                toggleDecisionForm('offer');
            }

            if (calData.decision.letter) {
                if (letterBody) letterBody.value = calData.decision.letter;
                updateOfferLivePreview();
                return;
            }
        } else {
            // Default to offer
            toggleDecisionForm('offer');
        }

        // Generate letter
        await regenerateDecisionLetterAI();
    } catch (err) {
        console.error('Error opening decision modal:', err);
        if (letterBody) letterBody.value = 'Failed to load candidate calibration data. Please try again.';
    }
}

function closeDecisionModal() {
    const modal = document.getElementById('decisionModal');
    if (modal) modal.classList.remove('active');
}

// Toggle verdict selection in Decision Modal
function toggleDecisionForm(mode) {
    const offerTerms = document.getElementById('offerTermsContainer');
    const rejTerms = document.getElementById('rejectionTermsContainer');
    const badgeType = document.getElementById('letterBadgeType');
    const compGrid = document.getElementById('letterCompensationGrid');

    const cardOffer = document.getElementById('verdictCardOffer');
    const cardConsider = document.getElementById('verdictCardConsider');
    const cardReject = document.getElementById('verdictCardReject');

    [cardOffer, cardConsider, cardReject].forEach(c => {
        if (c) {
            c.style.borderColor = 'var(--border-color)';
            c.style.background = 'var(--bg-card)';
        }
    });

    if (mode === 'reject') {
        if (cardReject) {
            cardReject.style.borderColor = 'var(--danger)';
            cardReject.style.background = 'var(--danger-light)';
        }
        if (offerTerms) offerTerms.style.display = 'none';
        if (rejTerms) rejTerms.style.display = 'block';
        if (compGrid) compGrid.style.display = 'none';
        if (badgeType) {
            badgeType.textContent = 'CONSTRUCTIVE FEEDBACK';
            badgeType.style.background = 'var(--danger)';
        }
    } else if (mode === 'consider') {
        if (cardConsider) {
            cardConsider.style.borderColor = 'var(--warning)';
            cardConsider.style.background = 'var(--warning-light)';
        }
        if (offerTerms) offerTerms.style.display = 'block';
        if (rejTerms) rejTerms.style.display = 'none';
        if (compGrid) compGrid.style.display = 'grid';
        if (badgeType) {
            badgeType.textContent = 'PROVISIONAL REVIEW';
            badgeType.style.background = 'var(--warning)';
        }
    } else {
        if (cardOffer) {
            cardOffer.style.borderColor = 'var(--success)';
            cardOffer.style.background = 'var(--success-light)';
        }
        if (offerTerms) offerTerms.style.display = 'block';
        if (rejTerms) rejTerms.style.display = 'none';
        if (compGrid) compGrid.style.display = 'grid';
        if (badgeType) {
            badgeType.textContent = 'OFFICIAL OFFER';
            badgeType.style.background = 'var(--success)';
        }
    }

    updateOfferLivePreview();
}

// Update live preview document callouts
function updateOfferLivePreview() {
    const salary = document.getElementById('offerBaseSalary')?.value || '$155,000 USD';
    const equity = document.getElementById('offerEquity')?.value || '0.15%';
    const startDate = document.getElementById('offerStartDate')?.value || '';

    const pSal = document.getElementById('previewCompSalary');
    const pEq = document.getElementById('previewCompEquity');
    const pDate = document.getElementById('previewCompStartDate');
    const compTitle = document.getElementById('letterCompanyBrand');
    const sigComp = document.getElementById('signatureCompany');

    if (pSal) pSal.textContent = salary;
    if (pEq) pEq.textContent = equity;
    if (pDate) pDate.textContent = startDate ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'To Be Agreed';

    const companyName = currentCompany?.name || 'AIRIS Talent Global';
    if (compTitle) compTitle.textContent = companyName;
    if (sigComp) sigComp.textContent = companyName;
}

// Sync changes on input typing
['offerBaseSalary', 'offerEquity', 'offerStartDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateOfferLivePreview);
});

// Regenerate AI Letter using Gemini 3.8 Flash
async function regenerateDecisionLetterAI() {
    if (!currentDecisionAppId) return;

    const letterBody = document.getElementById('decisionLetterBody');
    if (letterBody) letterBody.value = 'Drafting formal letter with Gemini 3.8 Flash...';

    const selectedVerdict = document.querySelector('input[name="decisionVerdict"]:checked')?.value || 'STRONG_HIRE';
    const salary = document.getElementById('offerBaseSalary')?.value || '$155,000 USD';
    const equity = document.getElementById('offerEquity')?.value || '0.15%';
    const startDate = document.getElementById('offerStartDate')?.value || '';
    const customNotes = (selectedVerdict === 'REJECT' ? document.getElementById('rejectionCustomNotes')?.value : document.getElementById('offerCustomNotes')?.value) || '';

    try {
        const res = await fetch('/api/decisions/generate-letter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                applicationId: currentDecisionAppId,
                verdict: selectedVerdict,
                compensation: {
                    baseSalary: salary,
                    equity: equity,
                    startDate: startDate
                },
                customNotes: customNotes
            })
        });

        if (!res.ok) throw new Error(`Letter generation failed: ${res.status}`);
        const data = await res.json();
        if (letterBody) {
            letterBody.value = data.letter || 'Offer letter successfully drafted.';
        }
        updateOfferLivePreview();
        if (window.showToast) window.showToast('Decision letter drafted successfully!', 'success');
    } catch (err) {
        console.error('Error generating letter:', err);
        if (letterBody) letterBody.value = 'Failed to generate tailored letter. You may edit this letter draft manually.';
    }
}

// Finalize & Dispatch Decision Action
async function finalizeDecisionAction() {
    if (!currentDecisionAppId) return;

    const btn = document.getElementById('finalizeDecisionBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Dispatching & Persisting Decision...';
    }

    const verdict = document.querySelector('input[name="decisionVerdict"]:checked')?.value || 'STRONG_HIRE';
    const letter = document.getElementById('decisionLetterBody')?.value || '';
    const salary = document.getElementById('offerBaseSalary')?.value || '';
    const equity = document.getElementById('offerEquity')?.value || '';
    const startDate = document.getElementById('offerStartDate')?.value || '';
    const leveling = currentDecisionCalibration?.leveling || {};

    try {
        const res = await fetch('/api/decisions/finalize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                applicationId: currentDecisionAppId,
                verdict: verdict,
                letter: letter,
                compensation: {
                    baseSalary: salary,
                    equity: equity,
                    startDate: startDate
                },
                leveling: leveling
            })
        });

        if (!res.ok) throw new Error(`Failed to finalize decision: ${res.status}`);
        const data = await res.json();

        // Update local state cache
        const localApp = allApplications.find(a => a._id === currentDecisionAppId);
        if (localApp) {
            localApp.decision = data.decision;
            localApp.status = data.application?.status || (verdict === 'STRONG_HIRE' ? 'accepted' : (verdict === 'REJECT' ? 'rejected' : 'reviewed'));
        }

        if (window.showToast) window.showToast(`Decision finalized! Status updated to ${localApp ? localApp.status : 'updated'}.`, 'success');

        closeDecisionModal();
        loadTalentMatrix();
        filterApplicationsList();
    } catch (err) {
        console.error('Error finalizing decision:', err);
        if (window.showToast) window.showToast(`Error finalizing decision: ${err.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📨 Dispatch Official Decision & Update Status';
        }
    }
}

// Copy decision letter text
function copyDecisionLetterText() {
    const text = document.getElementById('decisionLetterBody')?.value || '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast('Decision letter copied to clipboard!', 'success');
    }).catch(() => {
        if (window.showToast) window.showToast('Could not copy to clipboard', 'error');
    });
}

