// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
    window.location.href = '/login';
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Get job ID from URL
const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('jobId');

if (!jobId) {
    alert('No job selected');
    window.location.href = '/applicant';
}

// Load job details
async function loadJobDetails() {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        
        document.getElementById('jobId').textContent = job.job_id;
        document.getElementById('jobTitle').textContent = job.title;
        document.getElementById('job_id').value = job.job_id;
        document.getElementById('confirmJobIdText').textContent = job.job_id;
        
        // Pre-fill user data
        document.getElementById('name').value = user.name;
        document.getElementById('email').value = user.email;
    } catch (error) {
        console.error('Error loading job:', error);
        alert('Error loading job details');
    }
}

// Handle form submission
const applyForm = document.getElementById('applyForm');
applyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('applyError');
    
    // Validate
    if (!document.getElementById('confirmJobId').checked) {
        errorDiv.textContent = 'Please confirm that you have noted the Job ID';
        errorDiv.classList.add('show');
        return;
    }
    
    const resumeFile = document.getElementById('resume').files[0];
    const isDoc = resumeFile && (
        resumeFile.type.includes('pdf') ||
        resumeFile.name.toLowerCase().endsWith('.pdf') ||
        resumeFile.type.includes('text') ||
        resumeFile.name.toLowerCase().endsWith('.txt')
    );
    if (!resumeFile || !isDoc) {
        errorDiv.textContent = 'Please upload a valid PDF or text resume';
        errorDiv.classList.add('show');
        return;
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('jobId', document.getElementById('job_id').value);
    formData.append('name', document.getElementById('name').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('resume', resumeFile);
    
    // Add certificates
    const certFiles = document.getElementById('certificates').files;
    for (let i = 0; i < certFiles.length; i++) {
        formData.append('certificates', certFiles[i]);
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    errorDiv.classList.remove('show');
    
    // Hide form and show analysis container
    document.getElementById('applicationForm').style.display = 'none';
    document.getElementById('analysisContainer').classList.add('active');
    const loaderEl = document.getElementById('analyzingLoader');
    if (loaderEl) loaderEl.style.display = 'block';

    // Progressive status updates during analysis
    const loaderDetailEl = document.getElementById('loaderDetail');
    const statusMessages = [
        'Parsing resume structure and credentials...',
        'Scanning mandatory & optional skill proficiencies...',
        'Evaluating semantic alignment with role responsibilities...',
        'Synthesizing AI candidate intelligence and recommendations...'
    ];
    let msgIdx = 0;
    const progressInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % statusMessages.length;
        if (loaderDetailEl) loaderDetailEl.textContent = statusMessages[msgIdx];
    }, 1800);
    
    try {
        const response = await fetch('/api/applications/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        clearInterval(progressInterval);
        
        if (response.ok) {
            // Smooth reveal
            setTimeout(() => {
                displayAnalysis(data.analysis, certFiles.length, data.intelligence, data.application);
            }, 300);
        } else {
            const err = new Error(data.message || 'Error submitting application');
            err.identityMismatch = data.identityMismatch;
            err.claimedName = data.claimedName;
            err.resumeName = data.resumeName;
            throw err;
        }
    } catch (error) {
        clearInterval(progressInterval);
        if (loaderEl) loaderEl.style.display = 'none';
        document.getElementById('analysisContainer').classList.remove('active');
        document.getElementById('applicationForm').style.display = 'block';
        if (error.identityMismatch) {
            errorDiv.innerHTML = `
                <div style="display: flex; gap: 0.75rem; align-items: flex-start; text-align: left;">
                    <span style="font-size: 1.6rem; line-height: 1;">🛑</span>
                    <div>
                        <strong style="display: block; font-size: 0.95rem; margin-bottom: 0.25rem; color: #ef4444;">Identity Verification Failed</strong>
                        <p style="margin: 0; font-size: 0.88rem; line-height: 1.4; color: var(--text-secondary);">${error.message}</p>
                    </div>
                </div>
            `;
        } else {
            errorDiv.textContent = error.message || 'Could not process resume. Please try again.';
        }
        errorDiv.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});

// Display analysis results with animation
function displayAnalysis(analysis, certCount = 0, intelligence = null, application = null) {
    try {
        // Hide loader
        const loaderEl = document.getElementById('analyzingLoader');
        if (loaderEl) loaderEl.style.display = 'none';
        
        // Show results
        const resultsDiv = document.getElementById('analysisResults');
        if (resultsDiv) resultsDiv.classList.add('active');
        
        const safeScores = analysis?.scores || {
            final: 0.6,
            semantic: 0.6,
            skill: 0.6,
            experience: 0.6,
            certification: 0
        };

        const finalScoreVal = typeof safeScores.final === 'number' ? safeScores.final : 0.6;
        const semanticVal = typeof safeScores.semantic === 'number' ? safeScores.semantic : 0.6;
        const skillVal = typeof safeScores.skill === 'number' ? safeScores.skill : 0.6;
        const expVal = typeof safeScores.experience === 'number' ? safeScores.experience : 0.6;
        const certVal = typeof safeScores.certification === 'number' ? safeScores.certification : 0;

        // Animate final score
        animateScore('finalScore', Math.round(finalScoreVal * 100));
        
        // Set eligibility
        const eligibilityBadge = document.getElementById('eligibilityBadge');
        if (eligibilityBadge) {
            const eligibilityText = analysis?.eligibility || 'Eligible';
            eligibilityBadge.textContent = eligibilityText;
            if (eligibilityText.includes('Rejected')) {
                eligibilityBadge.classList.add('rejected');
                eligibilityBadge.classList.remove('eligible');
            } else {
                eligibilityBadge.classList.add('eligible');
                eligibilityBadge.classList.remove('rejected');
            }
        }
        
        // Animate score bars
        setTimeout(() => {
            animateBar('semantic', Math.round(semanticVal * 100));
        }, 200);
        
        setTimeout(() => {
            animateBar('skill', Math.round(skillVal * 100));
        }, 400);
        
        setTimeout(() => {
            animateBar('experience', Math.round(expVal * 100));
        }, 600);
        
        // Show certification if available
        if (certVal > 0) {
            const certBarItem = document.getElementById('certificationBarItem');
            if (certBarItem) certBarItem.style.display = 'block';
            setTimeout(() => {
                animateBar('certification', Math.round(certVal * 100));
            }, 800);
            
            // Show certificate info
            if (certCount > 0 && analysis?.certifications) {
                const certInfo = document.getElementById('certificateInfo');
                if (certInfo) certInfo.style.display = 'block';
                const totalCertsEl = document.getElementById('totalCerts');
                const relCertsEl = document.getElementById('relevantCerts');
                if (totalCertsEl) totalCertsEl.textContent = analysis.certifications.total_uploaded || certCount;
                if (relCertsEl) relCertsEl.textContent = analysis.certifications.relevant || 0;

                const auditsListEl = document.getElementById('certificateAuditsList');
                if (auditsListEl && Array.isArray(analysis.certifications.audits) && analysis.certifications.audits.length > 0) {
                    auditsListEl.innerHTML = analysis.certifications.audits.map(c => {
                        const forensics = c.forensics || {};
                        const sigs = forensics.signatures || {};
                        const format = forensics.formatting || {};
                        const validity = forensics.validity || {};
                        const statusBadge = c.isAuthentic
                            ? `<span style="color: var(--success); font-weight: 700; font-size: 0.75rem; background: rgba(16, 185, 129, 0.12); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--success);">✓ Verified Authentic</span>`
                            : `<span style="color: var(--danger); font-weight: 700; font-size: 0.75rem; background: rgba(239, 68, 68, 0.12); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--danger);">⚠ ${c.authenticityStatus.replace(/_/g, ' ')}</span>`;

                        return `
                            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem 1rem; text-align: left; font-size: 0.82rem;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                                    <div>
                                        <strong style="color: var(--text-primary); font-size: 0.88rem;">${c.title || 'Certification Credential'}</strong>
                                        <div style="color: var(--text-secondary); font-size: 0.78rem; margin-top: 0.1rem;">
                                            Issuer: ${c.issuer || 'Accredited Issuer'} ${c.recipientName ? `• Awarded to: <strong>${c.recipientName}</strong>` : ''}
                                        </div>
                                    </div>
                                    ${statusBadge}
                                </div>
                                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.4rem; font-size: 0.75rem; color: var(--text-secondary);">
                                    ${sigs.primarySigner ? `<span>✍️ Signer: ${sigs.primarySigner}</span>` : ''}
                                    ${format.layoutClassification ? `<span>🏛️ ${format.layoutClassification.replace(/_/g, ' ')}</span>` : ''}
                                    ${validity.issueDate ? `<span>📅 Issued: ${validity.issueDate}</span>` : ''}
                                    ${validity.isLifetime ? `<span>♾️ Lifetime</span>` : (validity.expirationDate && validity.expirationDate !== 'LIFETIME_VALIDITY' ? `<span>⌛ Exp: ${validity.expirationDate}</span>` : '')}
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            }
        }
        
        // Display matched skills
        const matchedSkillsDiv = document.getElementById('matchedSkills');
        if (matchedSkillsDiv) {
            const matched = analysis?.skills?.matched || [];
            if (matched.length > 0) {
                matchedSkillsDiv.innerHTML = matched
                    .filter(skill => skill && skill.trim())
                    .map(skill => `<div class="skill-item matched">✓ ${skill}</div>`)
                    .join('');
            } else {
                matchedSkillsDiv.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">No direct mandatory skills matched</p>';
            }
        }
        
        // Display missing skills
        const missingSkillsDiv = document.getElementById('missingSkills');
        if (missingSkillsDiv) {
            const missing = analysis?.skills?.missing || [];
            if (missing.length > 0) {
                missingSkillsDiv.innerHTML = missing
                    .filter(skill => skill && skill.trim())
                    .map(skill => `<div class="skill-item missing">✗ ${skill}</div>`)
                    .join('');
            } else {
                missingSkillsDiv.innerHTML = '<p style="color: var(--success); font-size: 0.9rem; font-weight: 600;">✓ All mandatory skills matched!</p>';
            }
        }

        // Display AI Intelligence Insights
        const intelBlock = document.getElementById('aiIntelligenceBlock');
        const summaryText = document.getElementById('aiExecutiveSummaryText');
        const recPill = document.getElementById('aiRecommendationPill');
        const tipsSection = document.getElementById('aiTipsSection');
        const tipsList = document.getElementById('aiTipsList');

        if (intelligence && intelBlock) {
            intelBlock.style.display = 'block';

            if (summaryText) {
                summaryText.textContent = intelligence.executiveSummary || 'Your resume has been comprehensively indexed and evaluated by the AIRIS AI Screening Engine.';
            }

            if (recPill && intelligence.hiringRecommendation) {
                recPill.textContent = intelligence.hiringRecommendation.decision || 'Screened';
            }

            if (tipsSection && tipsList && intelligence.applicantFeedback && Array.isArray(intelligence.applicantFeedback.resumeTips)) {
                tipsSection.style.display = 'block';
                tipsList.innerHTML = intelligence.applicantFeedback.resumeTips.map(t => `<li style="margin-bottom: 0.35rem;">${t}</li>`).join('');
            }
        }

        // Check if initial screening passed or failed
        const isScreeningRejected = (application && application.status === 'rejected') ||
            (analysis?.eligibility && analysis.eligibility.includes('Rejected')) ||
            (analysis?.scores && (analysis.scores.final || 0) < 0.65);

        // Setup Post-Screening Recovery & Optimization Suite or Proceed to Skill Verification Gate
        const skillBtn = document.getElementById('btnProceedSkillTest');
        const defaultBox = document.getElementById('defaultDashboardBtnBox');
        const stepBox = document.getElementById('skillVerificationStepBox');
        const recoverySection = document.getElementById('screeningRecoverySection');

        if (isScreeningRejected && application && application._id) {
            // Lock and hide Pre-Interview Skill Verification Gate until screening passes
            if (stepBox) stepBox.style.display = 'none';
            if (defaultBox) defaultBox.style.display = 'none';
            
            // Initialize and display recovery & optimization suite
            initScreeningOptimizationSuite(application, analysis, intelligence);
        } else if (application && application._id) {
            if (recoverySection) recoverySection.style.display = 'none';
            if (skillBtn) {
                skillBtn.onclick = () => {
                    window.location.href = `/skill-test/${application._id}`;
                };
            }
            if (stepBox) stepBox.style.display = 'block';
            if (defaultBox) defaultBox.style.display = 'none';
        } else {
            if (recoverySection) recoverySection.style.display = 'none';
            if (stepBox) stepBox.style.display = 'none';
            if (defaultBox) defaultBox.style.display = 'block';
        }
    } catch (renderErr) {
        console.error('Error rendering analysis results:', renderErr);
        // Ensure loader is closed and results visible even if a subcomponent fails
        const loaderEl = document.getElementById('analyzingLoader');
        if (loaderEl) loaderEl.style.display = 'none';
        const resultsDiv = document.getElementById('analysisResults');
        if (resultsDiv) resultsDiv.classList.add('active');
    }
}

// Global state for resume studio
let currentActiveApplicationId = null;
let currentActiveOptimizedResume = null;

/**
 * Initialize the Post-Screening Recovery & Optimization Suite
 */
async function initScreeningOptimizationSuite(application, analysis, intelligence) {
    const recoverySection = document.getElementById('screeningRecoverySection');
    if (!recoverySection) return;

    currentActiveApplicationId = application._id;
    recoverySection.style.display = 'block';

    const currentScorePct = Math.round((analysis?.scores?.final || 0.45) * 100);
    const scoreEl = document.getElementById('recoveryCurrentScore');
    if (scoreEl) scoreEl.textContent = `${currentScorePct}%`;

    // Populate initial missing skills from analysis while fetching deep feedback
    const missing = analysis?.skills?.missing || [];
    const critDiv = document.getElementById('recoveryCriticalSkills');
    if (critDiv) {
        critDiv.innerHTML = missing.length > 0
            ? missing.map(s => `<span class="skill-tag-pill mandatory">✗ ${s}</span>`).join('')
            : '<span style="color: var(--text-secondary); font-size: 0.85rem;">None identified</span>';
    }

    const optDiv = document.getElementById('recoveryOptionalSkills');
    if (optDiv) {
        optDiv.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.82rem;">Analyzing optional proficiencies...</span>';
    }

    // Set up Generate button
    const genBtn = document.getElementById('btnGenerateOptimizedResume');
    if (genBtn) {
        genBtn.onclick = () => handleGenerateOptimizedResume(application._id);
    }

    // Fetch comprehensive recommendations from server
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/applications/${application._id}/screening-feedback`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (res.ok) {
            const data = await res.json();
            renderRecoveryRecommendations(data);
        }
    } catch (err) {
        console.warn('[ScreeningRecovery] Could not fetch deep feedback:', err);
    }
}

/**
 * Render structured feedback returned from backend
 */
function renderRecoveryRecommendations(feedbackData) {
    const rec = feedbackData.recommendations || {};
    
    // Update score projections
    const projScoreEl = document.getElementById('recoveryProjectedScore');
    const upliftEl = document.getElementById('recoveryScoreUplift');
    const atsExpEl = document.getElementById('recoveryAtsExplanation');

    if (projScoreEl && rec.projectedScorePct) {
        projScoreEl.textContent = `${rec.projectedScorePct}%`;
    }
    if (upliftEl && rec.scoreUpliftPct !== undefined) {
        upliftEl.textContent = `+${rec.scoreUpliftPct}% Potential Uplift`;
    }
    if (atsExpEl && rec.atsImpactExplanation) {
        atsExpEl.textContent = rec.atsImpactExplanation;
    }

    // Critical missing skills
    const critDiv = document.getElementById('recoveryCriticalSkills');
    if (critDiv) {
        const critSkills = rec.criticalMissingSkills || [];
        critDiv.innerHTML = critSkills.length > 0
            ? critSkills.map(s => `<span class="skill-tag-pill mandatory">⚠️ Mandatory: ${s}</span>`).join('')
            : '<span style="color: var(--success); font-size: 0.85rem;">✓ Mandatory requirements fulfilled</span>';
    }

    // Optional recommended skills
    const optDiv = document.getElementById('recoveryOptionalSkills');
    if (optDiv) {
        const optSkills = rec.recommendedOptionalSkills || [];
        optDiv.innerHTML = optSkills.length > 0
            ? optSkills.map(s => `<span class="skill-tag-pill optional">✨ Preferred: ${s}</span>`).join('')
            : '<span style="color: var(--text-secondary); font-size: 0.85rem;">All target skills listed</span>';
    }

    // Section modifications
    const modsDiv = document.getElementById('recoverySectionMods');
    if (modsDiv && Array.isArray(rec.sectionModifications)) {
        modsDiv.innerHTML = rec.sectionModifications.map(mod => `
            <div class="mod-item">
                <strong>📍 ${mod.section}:</strong>
                <div style="color: var(--text-secondary); margin-bottom: 0.35rem;">${mod.instruction}</div>
                <code>${mod.suggestedContent}</code>
            </div>
        `).join('');
    }

    // If an optimized resume already exists, update button text
    if (feedbackData.hasOptimizedResume) {
        const genBtnText = document.getElementById('genBtnText');
        if (genBtnText) genBtnText.textContent = 'View / Regenerate Optimized Resume';
    }
}

/**
 * Trigger on-demand generation of template-preserved resume
 */
async function handleGenerateOptimizedResume(applicationId) {
    const genBtn = document.getElementById('btnGenerateOptimizedResume');
    const loadingBox = document.getElementById('optimizerLoadingBox');
    const stepText = document.getElementById('optimizerStepText');

    if (genBtn) genBtn.disabled = true;
    if (loadingBox) loadingBox.style.display = 'block';

    const steps = [
        '1. Extracting original resume structure, headers & typography...',
        '2. Synthesizing STAR achievements with target competencies (Gemini)...',
        '3. Rendering template-preserved ATS document...'
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        if (stepText) stepText.textContent = steps[stepIdx];
    }, 1800);

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/applications/${applicationId}/generate-optimized-resume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        clearInterval(interval);
        if (loadingBox) loadingBox.style.display = 'none';
        if (genBtn) genBtn.disabled = false;

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to generate optimized resume');
        }

        const data = await res.json();
        currentActiveOptimizedResume = data.optimizedResume;
        currentActiveApplicationId = applicationId;

        // Open modal
        openResumeStudioModal(data.optimizedResume, applicationId);
    } catch (err) {
        clearInterval(interval);
        if (loadingBox) loadingBox.style.display = 'none';
        if (genBtn) genBtn.disabled = false;
        console.error('[ResumeOptimizer] Generation error:', err);
        alert('Could not generate optimized resume: ' + err.message);
    }
}

/**
 * Open the Template-Preserved Resume Studio Modal
 */
function openResumeStudioModal(optimizedResume, applicationId) {
    const modal = document.getElementById('optimizedResumeModal');
    if (!modal) return;

    modal.classList.add('active');

    // Update score badge
    const badge = document.getElementById('modalProjectedScoreBadge');
    if (badge && optimizedResume.projectedScore) {
        badge.textContent = `Projected ATS Match: ${optimizedResume.projectedScore}%`;
    }

    // Set preview iframe content
    const iframe = document.getElementById('resumePreviewIframe');
    if (iframe) {
        iframe.srcdoc = optimizedResume.styledHtml || '<p style="padding: 2rem;">No styled HTML content available.</p>';
    }

    // Set summary and changelog
    const summaryEl = document.getElementById('modalEnhancementSummary');
    if (summaryEl) {
        summaryEl.textContent = optimizedResume.summaryOfEnhancements || 'Resume enhanced with mandatory job competencies while strictly preserving authentic career history.';
    }

    const changelogList = document.getElementById('modalChangelogList');
    if (changelogList && Array.isArray(optimizedResume.changelog)) {
        changelogList.innerHTML = optimizedResume.changelog.map(item => `<li style="margin-bottom: 0.4rem;">${item}</li>`).join('');
    }

    // Set markdown text
    const mdText = document.getElementById('modalMarkdownText');
    if (mdText) {
        mdText.value = optimizedResume.markdownText || '';
    }

    // Tab switching handlers
    const tabBtns = modal.querySelectorAll('.modal-tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.getAttribute('data-tab');
            document.getElementById('tabContentPreview').style.display = targetTab === 'preview' ? 'block' : 'none';
            document.getElementById('tabContentChangelog').style.display = targetTab === 'changelog' ? 'block' : 'none';
            document.getElementById('tabContentMarkdown').style.display = targetTab === 'markdown' ? 'block' : 'none';
        };
    });

    // Close handlers
    const closeBtn = document.getElementById('btnCloseResumeModal');
    const cancelBtn = document.getElementById('btnModalCancel');
    const closeModal = () => modal.classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Print button
    const printBtn = document.getElementById('btnPrintResume');
    if (printBtn) {
        printBtn.onclick = () => {
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            }
        };
    }

    // Copy markdown button
    const copyBtn = document.getElementById('btnCopyMarkdown');
    if (copyBtn) {
        copyBtn.onclick = () => {
            if (mdText) {
                navigator.clipboard.writeText(mdText.value);
                const prev = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied!';
                setTimeout(() => { copyBtn.textContent = prev; }, 2000);
            }
        };
    }

    // Re-screen button
    const rescreenBtn = document.getElementById('btnSubmitAndRescreen');
    if (rescreenBtn) {
        rescreenBtn.onclick = () => handleSubmitAndRescreen(applicationId);
    }
}

/**
 * Submit optimized resume and trigger re-screening
 */
async function handleSubmitAndRescreen(applicationId) {
    const rescreenBtn = document.getElementById('btnSubmitAndRescreen');
    const rescreenBtnText = document.getElementById('rescreenBtnText');
    const modal = document.getElementById('optimizedResumeModal');

    if (rescreenBtn) rescreenBtn.disabled = true;
    if (rescreenBtnText) rescreenBtnText.textContent = 'Re-screening Application...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/applications/${applicationId}/rescreen`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                optimizedResume: currentActiveOptimizedResume
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || 'Failed to re-screen application');
        }

        const result = await res.json();

        // Close modal
        if (modal) modal.classList.remove('active');
        if (rescreenBtn) rescreenBtn.disabled = false;
        if (rescreenBtnText) rescreenBtnText.textContent = 'Submit & Re-Screen My Application';

        // Update page state with new re-screened results!
        applyRescreenSuccessState(result);
    } catch (err) {
        if (rescreenBtn) rescreenBtn.disabled = false;
        if (rescreenBtnText) rescreenBtnText.textContent = 'Submit & Re-Screen My Application';
        alert('Re-screening error: ' + err.message);
    }
}

/**
 * Apply updated results to the page after re-screening passes
 */
function applyRescreenSuccessState(result) {
    const app = result.application;
    const analysis = result.analysis;

    // 1. Hide recovery section
    const recoverySection = document.getElementById('screeningRecoverySection');
    if (recoverySection) recoverySection.style.display = 'none';

    // 2. Show celebratory banner
    const successBanner = document.getElementById('rescreenSuccessBanner');
    if (successBanner) {
        successBanner.style.display = 'block';
        const viewBtn = document.getElementById('btnViewActiveOptimizedResume');
        if (viewBtn) {
            viewBtn.onclick = () => {
                if (currentActiveOptimizedResume) {
                    openResumeStudioModal(currentActiveOptimizedResume, app._id);
                }
            };
        }
    }

    // 3. Update score cards & badges
    const finalScore = analysis?.scores?.final ? Math.round(analysis.scores.final * 100) : 88;
    const finalScoreEl = document.getElementById('finalScore');
    if (finalScoreEl) finalScoreEl.textContent = `${finalScore}%`;

    const elBadge = document.getElementById('eligibilityBadge');
    if (elBadge) {
        elBadge.textContent = 'Eligible (Optimized)';
        elBadge.className = 'eligibility-badge eligible';
    }

    // Animate score bars
    animateBar('semantic', (analysis?.scores?.semantic || 0.85) * 100);
    animateBar('skill', (analysis?.scores?.skill || 0.9) * 100);
    animateBar('experience', (analysis?.scores?.experience || 0.8) * 100);

    // Update matched / missing skills
    const matchedDiv = document.getElementById('matchedSkills');
    if (matchedDiv && analysis?.skills?.matched) {
        matchedDiv.innerHTML = analysis.skills.matched.map(s => `<div class="skill-item matched">✓ ${s}</div>`).join('');
    }

    const missingDiv = document.getElementById('missingSkills');
    if (missingDiv) {
        const missing = analysis?.skills?.missing || [];
        if (missing.length > 0) {
            missingDiv.innerHTML = missing.map(s => `<div class="skill-item missing">✗ ${s}</div>`).join('');
        } else {
            missingDiv.innerHTML = '<p style="color: var(--success); font-size: 0.9rem; font-weight: 600;">✓ All mandatory skills matched with optimized resume!</p>';
        }
    }

    // 4. Unlock and reveal the Pre-Interview Skill Verification Gate!
    const stepBox = document.getElementById('skillVerificationStepBox');
    const skillBtn = document.getElementById('btnProceedSkillTest');
    if (stepBox) {
        stepBox.style.display = 'block';
        stepBox.style.border = '2px solid var(--success)';
        stepBox.style.background = 'rgba(16, 185, 129, 0.08)';
    }

    if (skillBtn) {
        skillBtn.onclick = () => {
            window.location.href = result.nextStepUrl || `/skill-test/${app._id}`;
        };
        skillBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Animate score number
function animateScore(elementId, targetValue) {
    const element = document.getElementById(elementId);
    let current = 0;
    const increment = targetValue / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(timer);
        }
        element.textContent = Math.round(current) + '%';
    }, 20);
}

// Animate bar chart
function animateBar(type, percentage) {
    const bar = document.getElementById(type + 'Bar');
    const scoreLabel = document.getElementById(type + 'Score');
    
    bar.style.width = percentage + '%';
    bar.textContent = Math.round(percentage) + '%';
    scoreLabel.textContent = Math.round(percentage) + '%';
}

// Load job details on page load
loadJobDetails();
