// AIRIS Skill Verification Client Engine
let currentAppId = null;
let testData = null;
let currentQuestionIndex = 0;
let userAnswers = {}; // { [questionId]: selectedIndex }
let questionTimer = null;
let secondsRemaining = 60;
let tabSwitches = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    // Resolve application ID
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const urlParams = new URLSearchParams(window.location.search);

    if (pathParts.length >= 2 && pathParts[0] === 'skill-test') {
        currentAppId = pathParts[1];
    } else {
        currentAppId = urlParams.get('appId') || urlParams.get('id');
    }

    if (!currentAppId) {
        alert('No application ID specified for this skill verification check.');
        window.location.href = '/applicant';
        return;
    }

    // Track tab switches for integrity
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && document.getElementById('stageAssessment').style.display !== 'none') {
            tabSwitches++;
            const indicator = document.getElementById('tabSwitchIndicator');
            if (indicator) {
                indicator.innerHTML = `<span style="color: #ef4444;">⚠️ Tab switch recorded (${tabSwitches})</span>`;
            }
        }
    });

    await initializeSession();
});

async function initializeSession() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/skill-verification/session/${currentAppId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to initialize skill verification check');
        }

        const data = await res.json();

        // Update Nav user info
        const userChip = document.getElementById('navUserBadge');
        if (userChip) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            userChip.textContent = user.name || 'Candidate';
        }

        // If already completed and passed
        if (data.alreadyCompleted && data.passed) {
            showAlreadyCompleted(data);
            return;
        }

        // If already completed and failed
        if (data.alreadyCompleted && !data.passed) {
            showAlreadyFailed(data);
            return;
        }

        testData = data.test;
        const job = data.job || {};

        // Render briefing stage
        document.getElementById('briefingTitle').textContent = `Skill Verification: ${job.title || 'Technical Role'}`;
        document.getElementById('briefingSubtitle').textContent = `Testing claimed competencies for ${job.companyName || 'Enterprise Partner'}`;
        document.getElementById('briefingCutoffText').textContent = `${job.cutoff || 70}%`;

        const skillsContainer = document.getElementById('briefingTargetSkills');
        skillsContainer.innerHTML = '';
        const targetSkills = testData.targetSkills || ['python', 'sql'];
        targetSkills.forEach(skill => {
            const chip = document.createElement('span');
            chip.className = 'skill-badge-chip';
            chip.textContent = `⚡ ${skill.toUpperCase()}`;
            skillsContainer.appendChild(chip);
        });

        document.getElementById('btnStartSkillTest').addEventListener('click', () => {
            startAssessment();
        });

    } catch (err) {
        console.error('Session init error:', err);
        alert(err.message || 'Error loading skill test');
        window.location.href = '/applicant';
    }
}

function showAlreadyCompleted(data) {
    document.getElementById('stageBriefing').style.display = 'none';
    document.getElementById('stageAssessment').style.display = 'none';
    const resultsStage = document.getElementById('stageResults');
    resultsStage.style.display = 'block';

    document.getElementById('resultIcon').textContent = '✅';
    document.getElementById('resultTitle').textContent = 'Skills Already Verified!';
    document.getElementById('resultSubtitle').textContent = `You scored ${data.score || 85}% and verified your competencies. You are eligible for the AI interview.`;
    document.getElementById('resultScorePct').textContent = `${data.score || 85}%`;
    document.getElementById('resultVerdictBadge').textContent = 'Verified Technical Competency';
    document.getElementById('resultVerdictBadge').style.color = 'var(--success)';

    const skillsList = document.getElementById('resultSkillsList');
    skillsList.innerHTML = '';
    (data.verifiedSkills || []).forEach(vs => {
        const item = document.createElement('div');
        item.style.background = 'var(--bg-subtle)';
        item.style.padding = '0.75rem 1rem';
        item.style.borderRadius = '8px';
        item.style.border = '1px solid var(--border-color)';
        item.innerHTML = `<strong>⚡ ${vs.skill.toUpperCase()}</strong>: Verified (${vs.score}%)`;
        skillsList.appendChild(item);
    });

    const proceedBtn = document.getElementById('btnProceedToInterview');
    proceedBtn.onclick = () => {
        window.location.href = `/interview/${currentAppId}`;
    };
}

function showAlreadyFailed(data) {
    document.getElementById('stageBriefing').style.display = 'none';
    document.getElementById('stageAssessment').style.display = 'none';
    const resultsStage = document.getElementById('stageResults');
    resultsStage.style.display = 'block';

    document.getElementById('resultIcon').textContent = '⚠️';
    document.getElementById('resultTitle').textContent = 'Pre-Interview Skill Gate Not Cleared';
    document.getElementById('resultSubtitle').textContent = data.summary || 'Previous score did not meet the role cutoff. Competencies must be verified before unlocking the AI interview.';
    document.getElementById('resultScorePct').textContent = `${data.score || 0}%`;
    document.getElementById('resultVerdictBadge').textContent = data.antiInflationVerdict === 'SUSPECTED_KEYWORD_INFLATION'
        ? '⚠️ Potential Keyword Mismatch Detected'
        : '⚠️ Score Below Cutoff Threshold';
    document.getElementById('resultVerdictBadge').style.color = '#ef4444';
    document.getElementById('resultCorrectStats').textContent = `Attempts used: ${data.attemptsCount || 1} of ${data.maxAttempts || 2} allowed (Cutoff: ${data.job?.cutoff || 70}%)`;

    const proceedBtn = document.getElementById('btnProceedToInterview');
    proceedBtn.style.display = 'none';

    // Check if retake is possible
    const actionsBox = document.getElementById('resultActions');
    const existingRetakeBtn = document.getElementById('btnRetakeSkillTest');
    if (existingRetakeBtn) existingRetakeBtn.remove();
    const existingMsg = document.getElementById('retakeExhaustedMsg');
    if (existingMsg) existingMsg.remove();

    if (data.canRetake) {
        const retakeBtn = document.createElement('button');
        retakeBtn.id = 'btnRetakeSkillTest';
        retakeBtn.className = 'btn-primary';
        retakeBtn.style.cssText = 'padding: 0.65rem 1.75rem; font-weight: 700; background: linear-gradient(135deg, #4f46e5, #06b6d4); border: none;';
        retakeBtn.innerHTML = `<span>🔄</span> Retake Skill Verification (Attempt ${(data.attemptsCount || 0) + 1} of ${data.maxAttempts || 2})`;
        retakeBtn.onclick = () => {
            window.location.href = `/skill-test/${currentAppId}?retake=true`;
        };
        actionsBox.appendChild(retakeBtn);
    } else {
        const infoMsg = document.createElement('div');
        infoMsg.id = 'retakeExhaustedMsg';
        infoMsg.style.cssText = 'width: 100%; font-size: 0.88rem; color: var(--text-muted); margin-top: 0.5rem;';
        infoMsg.textContent = 'Maximum attempts reached. Your application has been logged for manual recruiter review.';
        actionsBox.appendChild(infoMsg);
    }
}

function startAssessment() {
    if (!testData || !Array.isArray(testData.questions) || testData.questions.length === 0) {
        alert('Test questions could not be loaded. Please refresh.');
        return;
    }

    document.getElementById('stageBriefing').style.display = 'none';
    document.getElementById('stageAssessment').style.display = 'block';
    currentQuestionIndex = 0;
    userAnswers = {};

    renderQuestion(0);
}

function renderQuestion(index) {
    if (index >= testData.questions.length) {
        submitAssessment();
        return;
    }

    currentQuestionIndex = index;
    const q = testData.questions[index];

    // Tracker & Category
    document.getElementById('questionCategoryBadge').textContent = (q.skill || 'TECHNICAL').toUpperCase();
    document.getElementById('questionProgressText').textContent = `Question ${index + 1} of ${testData.questions.length}`;

    // Progress bar fill
    const pct = Math.round(((index) / testData.questions.length) * 100);
    document.getElementById('stepProgressFill').style.width = `${Math.max(5, pct)}%`;

    // Parse question text and any code blocks
    const qTextElem = document.getElementById('questionText');
    const qCodeElem = document.getElementById('questionCodeBlock');

    if (q.question.includes('```')) {
        const parts = q.question.split('```');
        const mainPrompt = parts[0].trim();
        let codeSnippet = parts[1] || '';
        // remove language tag like python or javascript at start
        codeSnippet = codeSnippet.replace(/^[a-zA-Z0-9_-]+\n/, '');

        qTextElem.textContent = mainPrompt;
        qCodeElem.style.display = 'block';
        qCodeElem.textContent = codeSnippet.trim();
    } else {
        qTextElem.textContent = q.question;
        qCodeElem.style.display = 'none';
        qCodeElem.textContent = '';
    }

    // Render Options
    const optionsContainer = document.getElementById('optionsList');
    optionsContainer.innerHTML = '';

    const selectedAnswer = userAnswers[q.id];

    q.options.forEach((optText, optIdx) => {
        const optCard = document.createElement('div');
        optCard.className = `option-card ${selectedAnswer === optIdx ? 'selected' : ''}`;
        optCard.id = `option_${optIdx}`;

        const radio = document.createElement('div');
        radio.className = 'option-radio';

        const label = document.createElement('div');
        label.style.fontSize = '0.95rem';
        label.style.lineHeight = '1.5';
        label.textContent = optText;

        optCard.appendChild(radio);
        optCard.appendChild(label);

        optCard.addEventListener('click', () => {
            document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            optCard.classList.add('selected');
            userAnswers[q.id] = optIdx;
        });

        optionsContainer.appendChild(optCard);
    });

    // Reset and start countdown timer
    startQuestionTimer(q.timeLimit || 60);

    // Setup Next button
    const nextBtn = document.getElementById('btnNextQuestion');
    nextBtn.textContent = index === testData.questions.length - 1 ? 'Finish & View Score →' : 'Confirm & Next →';
    nextBtn.onclick = () => {
        if (userAnswers[q.id] === undefined) {
            if (!confirm('You have not selected an option for this question. Skip anyway?')) {
                return;
            }
        }
        clearInterval(questionTimer);
        renderQuestion(currentQuestionIndex + 1);
    };
}

function startQuestionTimer(duration = 60) {
    if (questionTimer) clearInterval(questionTimer);

    secondsRemaining = duration;
    const timerElem = document.getElementById('timerCountdown');
    const badge = document.getElementById('questionTimerBadge');
    badge.classList.remove('timer-warning');

    timerElem.textContent = `${secondsRemaining}s`;

    questionTimer = setInterval(() => {
        secondsRemaining--;
        timerElem.textContent = `${secondsRemaining}s`;

        if (secondsRemaining <= 15) {
            badge.classList.add('timer-warning');
        }

        if (secondsRemaining <= 0) {
            clearInterval(questionTimer);
            // Auto advance
            const currentQ = testData.questions[currentQuestionIndex];
            renderQuestion(currentQuestionIndex + 1);
        }
    }, 1000);
}

async function submitAssessment() {
    if (questionTimer) clearInterval(questionTimer);

    document.getElementById('stageAssessment').style.display = 'none';
    const resultsStage = document.getElementById('stageResults');
    resultsStage.style.display = 'block';

    document.getElementById('resultTitle').textContent = 'Evaluating Technical Competencies...';
    document.getElementById('resultSubtitle').textContent = 'Cross-referencing answers against industry rubric and anti-inflation models...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/skill-verification/submit/${currentAppId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                answers: userAnswers,
                tabSwitches
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Submission failed');
        }

        const data = await res.json();
        const ev = data.evaluation;

        // Render Results
        document.getElementById('resultScorePct').textContent = `${ev.scorePercentage}%`;
        document.getElementById('resultCorrectStats').textContent = `${ev.correctCount} of ${ev.totalQuestions} questions correct (Cutoff: ${ev.passingCutoff}%)`;

        const iconElem = document.getElementById('resultIcon');
        const titleElem = document.getElementById('resultTitle');
        const subElem = document.getElementById('resultSubtitle');
        const verdictBadge = document.getElementById('resultVerdictBadge');
        const proceedBtn = document.getElementById('btnProceedToInterview');

        if (ev.passed) {
            iconElem.textContent = '🎉';
            titleElem.textContent = 'Skill Verification Passed!';
            subElem.textContent = 'Your resume skills have been authenticated. You are qualified to schedule the AI Technical Interview.';
            verdictBadge.textContent = '✅ Authentic Competency Verified';
            verdictBadge.style.color = 'var(--success)';

            proceedBtn.style.display = 'inline-block';
            proceedBtn.onclick = () => {
                window.location.href = `/interview/${currentAppId}`;
            };
        } else {
            iconElem.textContent = '⚠️';
            titleElem.textContent = 'Skill Verification Gate Not Cleared';
            subElem.textContent = ev.summary || 'Score did not meet the role threshold. Reinforce core concepts before proceeding.';
            verdictBadge.textContent = ev.antiInflationVerdict === 'SUSPECTED_KEYWORD_INFLATION'
                ? '⚠️ Potential Keyword Gap Detected'
                : '⚠️ Foundational Knowledge Refresh Needed';
            verdictBadge.style.color = '#ef4444';

            proceedBtn.style.display = 'none';

            const actionsBox = document.getElementById('resultActions');
            const existingRetakeBtn = document.getElementById('btnRetakeSkillTest');
            if (existingRetakeBtn) existingRetakeBtn.remove();
            const existingMsg = document.getElementById('retakeExhaustedMsg');
            if (existingMsg) existingMsg.remove();

            if (ev.canRetake) {
                const retakeBtn = document.createElement('button');
                retakeBtn.id = 'btnRetakeSkillTest';
                retakeBtn.className = 'btn-primary';
                retakeBtn.style.cssText = 'padding: 0.65rem 1.75rem; font-weight: 700; background: linear-gradient(135deg, #4f46e5, #06b6d4); border: none;';
                retakeBtn.innerHTML = `<span>🔄</span> Retake Skill Verification (Attempt ${(ev.attemptsCount || 0) + 1} of ${ev.maxAttempts || 2})`;
                retakeBtn.onclick = () => {
                    window.location.href = `/skill-test/${currentAppId}?retake=true`;
                };
                actionsBox.appendChild(retakeBtn);
            } else {
                const infoMsg = document.createElement('div');
                infoMsg.id = 'retakeExhaustedMsg';
                infoMsg.style.cssText = 'width: 100%; font-size: 0.88rem; color: var(--text-muted); margin-top: 0.5rem;';
                infoMsg.textContent = 'Maximum attempts reached. Your application has been logged for manual recruiter review.';
                actionsBox.appendChild(infoMsg);
            }
        }

        // Render skill breakdown
        const skillsContainer = document.getElementById('resultSkillsList');
        skillsContainer.innerHTML = '';

        (ev.verifiedSkills || []).forEach(s => {
            const item = document.createElement('div');
            item.style.background = 'var(--bg-subtle)';
            item.style.padding = '0.85rem 1rem';
            item.style.borderRadius = '10px';
            item.style.border = '1px solid var(--border-color)';
            item.innerHTML = `
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--success); margin-bottom: 2px;">
                    ✅ ${s.skill.toUpperCase()}
                </div>
                <div style="font-size: 0.82rem; color: var(--text-secondary);">Score: ${s.score}% • Verified Badge Awarded</div>
            `;
            skillsContainer.appendChild(item);
        });

        // Render knowledge gaps if any
        const gapsBox = document.getElementById('resultGapsBox');
        const gapsList = document.getElementById('resultGapsList');
        if (ev.knowledgeGaps && ev.knowledgeGaps.length > 0) {
            gapsBox.style.display = 'block';
            gapsList.innerHTML = '';
            ev.knowledgeGaps.forEach(g => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${g.skill.toUpperCase()} (${g.score}%):</strong> ${g.recommendation || 'Review core syntax and practical implementations.'}`;
                gapsList.appendChild(li);
            });
        } else {
            gapsBox.style.display = 'none';
        }

    } catch (err) {
        console.error('Evaluation error:', err);
        alert(err.message || 'Error processing evaluation');
    }
}
