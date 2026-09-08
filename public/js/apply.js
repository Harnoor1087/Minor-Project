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
                displayAnalysis(data.analysis, certFiles.length, data.intelligence);
            }, 300);
        } else {
            throw new Error(data.message || 'Error submitting application');
        }
    } catch (error) {
        clearInterval(progressInterval);
        if (loaderEl) loaderEl.style.display = 'none';
        document.getElementById('analysisContainer').classList.remove('active');
        document.getElementById('applicationForm').style.display = 'block';
        errorDiv.textContent = error.message || 'Could not process resume. Please try again.';
        errorDiv.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});

// Display analysis results with animation
function displayAnalysis(analysis, certCount = 0, intelligence = null) {
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
    } catch (renderErr) {
        console.error('Error rendering analysis results:', renderErr);
        // Ensure loader is closed and results visible even if a subcomponent fails
        const loaderEl = document.getElementById('analyzingLoader');
        if (loaderEl) loaderEl.style.display = 'none';
        const resultsDiv = document.getElementById('analysisResults');
        if (resultsDiv) resultsDiv.classList.add('active');
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
