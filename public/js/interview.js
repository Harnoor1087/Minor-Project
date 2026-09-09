// AIRIS AI Proctored Interview & Anti-Malpractice Client Engine
let currentAppId = null;
let sessionData = null;
let currentQuestionIndex = 0;
let mediaStream = null;
let audioContext = null;
let analyserNode = null;
let speechRecognizer = null;
let isDictating = false;
let proctoringInterval = null;
let audioMeterInterval = null;
let watermarkInterval = null;
let lastFaceDetectedTime = Date.now();
let faceAbsentWarningSent = false;
let infractionCount = 0;
let maxAllowedInfractions = 3;
let isAssessmentActive = false;
let isSubmitting = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
    }

    // Resolve App ID from URL path or query parameter
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const urlParams = new URLSearchParams(window.location.search);
    
    if (pathParts.length >= 2 && pathParts[0] === 'interview') {
        currentAppId = pathParts[1];
    } else {
        currentAppId = urlParams.get('appId') || urlParams.get('id');
    }

    if (!currentAppId) {
        alert('No application ID specified for this interview session. Returning to dashboard.');
        window.location.href = '/applicant';
        return;
    }

    await loadSession();
    setupAnswerInputListener();
    setupHonorCheckboxListener();
});

// Load session data from API
async function loadSession() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/interview/session/${currentAppId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Failed to initialize interview session');
        }

        sessionData = await res.json();
        const candidate = sessionData.candidate || {};
        const job = sessionData.job || {};
        const interview = sessionData.interview || {};

        document.getElementById('navCandidateName').textContent = candidate.name || 'Candidate';
        document.getElementById('preflightRoleTitle').textContent = `${job.title || 'Technical Assessment'}`;
        document.getElementById('preflightCompanySubtitle').textContent = `${job.companyName || 'AIRIS Talent'} • Department of ${job.department || 'Engineering'}`;

        const proctoring = job.proctoring || {};
        maxAllowedInfractions = proctoring.max_infractions || 3;
        document.getElementById('hudMaxInfractions').textContent = maxAllowedInfractions;
        document.getElementById('modalMaxInfractions').textContent = maxAllowedInfractions;

        // Render Proctoring Tier badge
        const tierBadge = document.getElementById('preflightTierBadge');
        if (proctoring.level === 'high') {
            tierBadge.innerHTML = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--danger); font-size: 0.92rem; padding: 0.4rem 1.1rem; border: 1px solid var(--danger);">🔴 Strict Enterprise (Camera, Audio & Fullscreen Lock)</span>`;
        } else if (proctoring.level === 'low') {
            tierBadge.innerHTML = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--success); font-size: 0.92rem; padding: 0.4rem 1.1rem; border: 1px solid var(--success);">🟢 Permissive Screening (Tab Monitoring)</span>`;
        } else {
            tierBadge.innerHTML = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--warning-text); font-size: 0.92rem; padding: 0.4rem 1.1rem; border: 1px solid var(--warning);">🟡 Standard ATS (Face & Tab-Switch Monitored)</span>`;
        }

        // If session was already completed
        if (interview.status === 'completed' || interview.status === 'disqualified') {
            renderSummaryStage(interview);
        }
    } catch (err) {
        console.error('Session load error:', err);
        alert('Could not load interview session: ' + err.message);
        window.location.href = '/applicant';
    }
}

// Media calibration
async function calibrateMediaStream() {
    const btn = document.getElementById('calibrateMediaBtn');
    const camPill = document.getElementById('cameraStatusPill');
    const micPill = document.getElementById('micStatusPill');
    const previewContainer = document.getElementById('preflightVideoPreviewContainer');
    const previewVideo = document.getElementById('preflightVideo');

    btn.disabled = true;
    btn.textContent = '⏳ Requesting Media Permissions...';

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true
        });

        previewVideo.srcObject = mediaStream;
        previewContainer.style.display = 'block';

        camPill.className = 'hud-sensor-pill active';
        camPill.textContent = '✅ Webcam Calibrated';

        micPill.className = 'hud-sensor-pill active';
        micPill.textContent = '✅ Microphone Calibrated';

        btn.className = 'btn-primary';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        btn.textContent = '✅ Media Devices Verified';

        checkReadyToStart();
    } catch (err) {
        console.error('Media permission error:', err);
        camPill.className = 'hud-sensor-pill alert';
        camPill.textContent = '❌ Camera Access Denied';
        micPill.className = 'hud-sensor-pill alert';
        micPill.textContent = '❌ Microphone Denied';

        btn.disabled = false;
        btn.textContent = '⚠️ Retry Media Authorization';
        alert('Camera and microphone access is required for proctored technical evaluations. Please enable browser permissions to continue.');
    }
}

function setupHonorCheckboxListener() {
    const check = document.getElementById('honorPledgeCheck');
    if (check) {
        check.addEventListener('change', checkReadyToStart);
    }
}

function checkReadyToStart() {
    const pledgeChecked = document.getElementById('honorPledgeCheck')?.checked;
    const hasMedia = Boolean(mediaStream);
    const startBtn = document.getElementById('beginAssessmentBtn');
    if (startBtn) {
        startBtn.disabled = !(pledgeChecked && hasMedia);
    }
}

// Start active interview stage
async function startInterviewSession() {
    const proctoring = sessionData.job?.proctoring || {};

    // Request fullscreen if enforced
    if (proctoring.enforce_fullscreen) {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        } catch (err) {
            console.warn('Fullscreen request rejected by browser:', err.message);
        }
    }

    // Switch UI stages
    document.getElementById('preflightStage').style.display = 'none';
    document.getElementById('activeInterviewStage').style.display = 'block';
    isAssessmentActive = true;

    // Attach stream to active proctoring video
    const videoElem = document.getElementById('proctoringVideo');
    if (videoElem && mediaStream) {
        videoElem.srcObject = mediaStream;
        videoElem.play().catch(e => console.warn('[Video] Proctoring video play warning:', e));
    }
    lastFaceDetectedTime = Date.now();
    faceAbsentWarningSent = false;

    // Initialize HUD
    document.getElementById('hudRolePill').textContent = `Role: ${sessionData.job?.title || 'Engineer'}`;
    const fullscreenPill = document.getElementById('hudFullscreenPill');
    fullscreenPill.className = document.fullscreenElement ? 'hud-sensor-pill active' : 'hud-sensor-pill warning';

    // Start Real-Time Anti-Malpractice Monitors
    initAcousticMeter();
    initProctoringListeners();
    initComputerVisionFaceTracker();
    startWatermarkClock();

    // Render first question
    renderCurrentQuestion();
}

// Render active question
function renderCurrentQuestion() {
    const questions = sessionData.interview?.questions || [];
    if (questions.length === 0) {
        alert('No questions generated for this assessment.');
        return;
    }

    if (currentQuestionIndex >= questions.length) {
        completeAssessment();
        return;
    }

    const q = questions[currentQuestionIndex];
    document.getElementById('hudQuestionProgress').textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    document.getElementById('questionCategoryTag').textContent = q.category || 'Technical Competency';
    document.getElementById('questionTitleText').textContent = q.question;

    const rationaleBox = document.getElementById('questionRationaleBox');
    if (q.rationale) {
        rationaleBox.style.display = 'block';
        document.getElementById('questionRationaleText').textContent = q.rationale;
    } else {
        rationaleBox.style.display = 'none';
    }

    // Key points
    const pointsList = document.getElementById('keyPointsList');
    pointsList.innerHTML = '';
    const points = Array.isArray(q.keyFocusPoints) ? q.keyFocusPoints : [];
    if (points.length > 0) {
        points.forEach(pt => {
            const chip = document.createElement('span');
            chip.className = 'key-point-chip';
            chip.textContent = `• ${pt}`;
            pointsList.appendChild(chip);
        });
    } else {
        const chip = document.createElement('span');
        chip.className = 'key-point-chip';
        chip.textContent = '• Architectural validity & edge cases';
        pointsList.appendChild(chip);
    }

    // Reset Answer Box
    const textarea = document.getElementById('candidateAnswerText');
    textarea.value = q.candidateAnswer || '';
    textarea.disabled = false;
    updateWordCount();

    // Hide previous evaluation panel
    const evalPanel = document.getElementById('aiEvaluationPanel');
    if (q.evaluation) {
        renderEvaluationResult(q.evaluation, false);
    } else {
        evalPanel.style.display = 'none';
        document.getElementById('submitAnswerBtn').style.display = 'inline-flex';
    }

    // Scroll to top of stage
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Answer Word Counter
function setupAnswerInputListener() {
    const textarea = document.getElementById('candidateAnswerText');
    if (textarea) {
        textarea.addEventListener('input', updateWordCount);
    }
}

function updateWordCount() {
    const text = document.getElementById('candidateAnswerText')?.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lbl = document.getElementById('wordCountLabel');
    if (lbl) {
        lbl.textContent = `${words} words`;
    }
}

// Speech to Text Dictation
function toggleVoiceDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech-to-text dictation is not natively supported in this browser. Please type your response directly into the editor.');
        return;
    }

    const btn = document.getElementById('voiceDictateBtn');
    const textarea = document.getElementById('candidateAnswerText');

    if (isDictating) {
        if (speechRecognizer) {
            speechRecognizer.stop();
        }
        isDictating = false;
        btn.classList.remove('listening');
        document.getElementById('dictateLabel').textContent = 'Voice Dictation';
        return;
    }

    try {
        speechRecognizer = new SpeechRecognition();
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = true;
        speechRecognizer.lang = 'en-US';

        speechRecognizer.onstart = () => {
            isDictating = true;
            btn.classList.add('listening');
            document.getElementById('dictateLabel').textContent = 'Listening... Click to Stop';
            logProctoringTelemetry('Acoustic speech dictation active.');
        };

        speechRecognizer.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
            if (finalTranscript) {
                textarea.value = (textarea.value ? textarea.value.trim() + ' ' : '') + finalTranscript.trim();
                updateWordCount();
            }
        };

        speechRecognizer.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            isDictating = false;
            btn.classList.remove('listening');
            document.getElementById('dictateLabel').textContent = 'Voice Dictation';
        };

        speechRecognizer.onend = () => {
            isDictating = false;
            btn.classList.remove('listening');
            document.getElementById('dictateLabel').textContent = 'Voice Dictation';
        };

        speechRecognizer.start();
    } catch (err) {
        console.error('Dictation start failed:', err);
    }
}

// Submit current answer for AI evaluation
async function submitCurrentAnswer() {
    if (isSubmitting) return;

    const textarea = document.getElementById('candidateAnswerText');
    const answer = textarea.value.trim();

    if (answer.length < 20) {
        if (!confirm('Your answer is very brief. Are you sure you want to submit it for AI evaluation?')) {
            return;
        }
    }

    // Stop dictation if active
    if (isDictating && speechRecognizer) {
        speechRecognizer.stop();
    }

    const submitBtn = document.getElementById('submitAnswerBtn');
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ AI is evaluating your response...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/interview/session/${currentAppId}/submit-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                questionIndex: currentQuestionIndex,
                answer
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Evaluation error');
        }

        const data = await res.json();
        
        // Update local session question data
        if (sessionData.interview?.questions) {
            sessionData.interview.questions[currentQuestionIndex].candidateAnswer = answer;
            sessionData.interview.questions[currentQuestionIndex].evaluation = data.evaluation;
        }

        renderEvaluationResult(data.evaluation, data.isLastQuestion);
        textarea.disabled = true;
        submitBtn.style.display = 'none';

        logProctoringTelemetry(`Question ${currentQuestionIndex + 1} evaluated: Score ${data.evaluation.score}%`);
    } catch (err) {
        console.error('Submit answer error:', err);
        alert('Could not evaluate answer: ' + err.message);
    } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '✨ Submit Answer & Evaluate';
    }
}

function renderEvaluationResult(evalData, isLast) {
    const evalPanel = document.getElementById('aiEvaluationPanel');
    evalPanel.style.display = 'block';

    document.getElementById('evalOverallScorePill').textContent = `Score: ${evalData.score}%`;
    document.getElementById('evalAccuracyScore').textContent = `${evalData.technicalAccuracy || evalData.score}%`;
    document.getElementById('evalDepthScore').textContent = `${evalData.depthAndPracticality || evalData.score}%`;
    document.getElementById('evalClarityScore').textContent = `${evalData.clarityAndCommunication || evalData.score}%`;
    document.getElementById('evalFeedbackText').textContent = evalData.feedback || 'Comprehensive evaluation complete.';

    const nextBtn = document.getElementById('nextQuestionBtn');
    if (isLast) {
        nextBtn.textContent = '🏁 Finish Assessment & View Final Report';
        nextBtn.className = 'btn-primary';
        nextBtn.style.background = 'var(--success)';
        nextBtn.style.borderColor = 'var(--success)';
    } else {
        nextBtn.textContent = 'Next Question ➔';
    }

    evalPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function advanceToNextQuestion() {
    currentQuestionIndex++;
    const questions = sessionData.interview?.questions || [];
    if (currentQuestionIndex < questions.length) {
        renderCurrentQuestion();
    } else {
        completeAssessment();
    }
}

// Complete Assessment API Call
async function completeAssessment() {
    try {
        isAssessmentActive = false;
        stopMediaStream();

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/interview/session/${currentAppId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Error completing session');
        }

        const data = await res.json();
        renderSummaryStage(data.interview, data.report);
    } catch (err) {
        console.error('Complete assessment error:', err);
        alert('Could not finalize assessment: ' + err.message);
    }
}

// Render Summary / Debrief Stage
function renderSummaryStage(interview, report) {
    document.getElementById('preflightStage').style.display = 'none';
    document.getElementById('activeInterviewStage').style.display = 'none';
    document.getElementById('summaryStage').style.display = 'block';

    const isDisqualified = interview.status === 'disqualified' || interview.proctoringReport?.integrityStatus === 'DISQUALIFIED';
    const overallScore = interview.overallScore ?? (report?.overallScore || 0);

    const scoreElem = document.getElementById('summaryOverallScore');
    const emojiElem = document.getElementById('summaryEmoji');
    const recPill = document.getElementById('summaryRecommendationPill');
    const integrityBadge = document.getElementById('summaryIntegrityBadge');
    const infractionsCount = interview.proctoringReport?.infractionCount || 0;

    scoreElem.textContent = `${overallScore}%`;

    if (isDisqualified) {
        emojiElem.textContent = '🚫';
        recPill.textContent = 'Disqualified (Integrity Violation)';
        recPill.style.background = 'rgba(239, 68, 68, 0.4)';
        integrityBadge.className = 'badge badge-danger';
        integrityBadge.textContent = 'Disqualified (Cheating)';
    } else {
        emojiElem.textContent = overallScore >= 75 ? '🎉' : '📋';
        recPill.textContent = interview.recommendation || 'Hire';
        if (infractionsCount === 0) {
            integrityBadge.className = 'badge badge-success';
            integrityBadge.textContent = 'Verified Clean (0 Infractions)';
        } else {
            integrityBadge.className = 'badge badge-warning';
            integrityBadge.textContent = `Flagged (${infractionsCount} Infractions)`;
        }
    }

    document.getElementById('summaryInfractionCount').textContent = `${infractionsCount} / ${maxAllowedInfractions} allowed`;

    const infractionsList = interview.proctoringReport?.infractions || [];
    const detailsContainer = document.getElementById('summaryInfractionDetails');
    if (infractionsList.length > 0) {
        detailsContainer.innerHTML = infractionsList.map(inf => `
            <div style="padding: 0.35rem 0; border-bottom: 1px dashed var(--border-subtle); color: var(--danger-text);">
                • <strong>${inf.type}</strong>: ${inf.message} <span style="opacity: 0.7; font-size: 0.8rem;">(${new Date(inf.timestamp).toLocaleTimeString()})</span>
            </div>
        `).join('');
    } else {
        detailsContainer.textContent = 'Zero malpractice events detected. Complete browser and webcam integrity maintained throughout assessment.';
    }

    // Render questions transcript
    const qList = document.getElementById('summaryQuestionsList');
    qList.innerHTML = '';
    const questions = interview.questions || [];
    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.style.background = 'var(--bg-subtle)';
        card.style.borderRadius = '12px';
        card.style.padding = '1.25rem';
        card.style.border = '1px solid var(--border-color)';

        const score = q.evaluation?.score || 0;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="font-size: 0.95rem;">Q${idx + 1}: ${q.category || 'Question'}</strong>
                <span class="badge ${score >= 70 ? 'badge-success' : 'badge-warning'}">Score: ${score}%</span>
            </div>
            <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: var(--text-primary); font-weight: 500;">${q.question}</p>
            <div style="background: var(--bg-surface); padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 1px solid var(--border-color); font-size: 0.88rem; color: var(--text-secondary); max-height: 120px; overflow-y: auto;">
                <em>Your Answer:</em> ${q.candidateAnswer || '(No response recorded)'}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
                <strong>AI Feedback:</strong> ${q.evaluation?.feedback || 'Evaluated by AIRIS Engine'}
            </div>
        `;
        qList.appendChild(card);
    });
}

// ==========================================================================
// PHASE 4: IN-BROWSER ANTI-MALPRACTICE MONITORING & COMPUTER VISION
// ==========================================================================

function initProctoringListeners() {
    // 1. Tab Switching Detection via visibilitychange
    document.addEventListener('visibilitychange', () => {
        if (!isAssessmentActive) return;
        if (document.hidden) {
            triggerMalpracticeViolation('TAB_SWITCH', 'Browser Tab Navigated Away / Minimized', 'Assessment rules require remaining strictly in this tab.');
        }
    });

    // 2. Window Blur (Focus Lost / Alt-Tab)
    window.addEventListener('blur', () => {
        if (!isAssessmentActive) return;
        triggerMalpracticeViolation('WINDOW_BLUR', 'Window Focus Lost', 'Candidate switched active application focus or clicked outside browser.');
    });

    // 3. Fullscreen Exit Detection
    document.addEventListener('fullscreenchange', () => {
        const fullscreenPill = document.getElementById('hudFullscreenPill');
        if (document.fullscreenElement) {
            fullscreenPill.className = 'hud-sensor-pill active';
            fullscreenPill.textContent = '🖥️ Fullscreen: Locked';
        } else {
            fullscreenPill.className = 'hud-sensor-pill alert';
            fullscreenPill.textContent = '🖥️ Fullscreen: Breached';
            if (isAssessmentActive && sessionData.job?.proctoring?.enforce_fullscreen) {
                triggerMalpracticeViolation('FULLSCREEN_EXIT', 'Fullscreen Mode Exited', 'Assessment must be completed in full-screen view.');
            }
        }
    });
}

// Trigger malpractice violation, show modal and log to backend
async function triggerMalpracticeViolation(type, title, message) {
    if (!isAssessmentActive) return;

    infractionCount++;
    document.getElementById('hudInfractionCount').textContent = infractionCount;
    document.getElementById('modalInfractionCount').textContent = infractionCount;

    const hudBadge = document.getElementById('hudInfractionsBadge');
    if (infractionCount >= maxAllowedInfractions) {
        hudBadge.className = 'hud-infractions-badge breached';
    } else {
        hudBadge.className = 'hud-infractions-badge has-warnings';
    }

    // Show alert modal
    document.getElementById('malpracticeTitle').textContent = `🚨 ${title}`;
    document.getElementById('malpracticeMessage').textContent = message;
    document.getElementById('malpracticeOverlay').classList.add('active');

    logProctoringTelemetry(`[INFRACTION] ${type}: ${title}`);

    // Send to backend
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/interview/session/${currentAppId}/record-infraction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type,
                message: title,
                details: message
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.isDisqualified) {
                alert('Assessment limit exceeded. You have been disqualified due to multiple malpractice infractions.');
                completeAssessment();
            }
        }
    } catch (err) {
        console.warn('Could not record infraction on backend:', err.message);
    }
}

function dismissMalpracticeAlert() {
    document.getElementById('malpracticeOverlay').classList.remove('active');
    
    // Re-request fullscreen if required
    if (sessionData.job?.proctoring?.enforce_fullscreen && !document.fullscreenElement) {
        try {
            document.documentElement.requestFullscreen();
        } catch (e) {}
    }
}

// Enterprise-Grade In-Browser Computer Vision Face & Proctoring Tracker
function initComputerVisionFaceTracker() {
    const video = document.getElementById('proctoringVideo');
    const canvas = document.getElementById('proctoringCanvas');
    const warningBox = document.getElementById('faceAbsentWarningBox');
    const subtextEl = document.getElementById('faceAbsentSubtext');
    const badge = document.getElementById('faceTrackingBadge');
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Optional Native Hardware Face Detection API
    let nativeFaceDetector = null;
    if (typeof window.FaceDetector === 'function') {
        try {
            nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
        } catch (e) {
            nativeFaceDetector = null;
        }
    }

    let prevLuminance = null;
    let consecutiveAbsentTicks = 0;
    let consecutivePresentTicks = 0;

    // Run high-frequency vision checks every 400ms for immediate responsiveness
    proctoringInterval = setInterval(async () => {
        if (!isAssessmentActive) return;

        // Ensure video dimensions are initialized
        if (!video.videoWidth || !video.videoHeight || video.paused || video.ended) {
            return;
        }

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let faceDetected = false;
        let multipleFacesDetected = false;
        let box = null;

        // 1. Check Native Hardware Face Detector if supported
        if (nativeFaceDetector) {
            try {
                const detectedFaces = await nativeFaceDetector.detect(canvas);
                if (detectedFaces && detectedFaces.length > 0) {
                    faceDetected = true;
                    if (detectedFaces.length > 1) {
                        multipleFacesDetected = true;
                    }
                    const b = detectedFaces[0].boundingBox;
                    box = {
                        x: Math.max(10, b.x),
                        y: Math.max(10, b.y),
                        w: Math.min(canvas.width - 20, b.width),
                        h: Math.min(canvas.height - 20, b.height)
                    };
                }
            } catch (detectorErr) {
                // Fallback to computer vision algorithm
            }
        }

        // 2. High-Performance Universal Computer Vision Algorithm
        // Extracts YCbCr skin chrominance + spatial clustering + temporal motion
        if (!faceDetected) {
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = frame.data;

            const step = 6;
            const sampledCols = Math.floor(canvas.width / step);
            const sampledRows = Math.floor(canvas.height / step);
            const totalSampled = sampledCols * sampledRows;

            let skinPixelCount = 0;
            let sumX = 0;
            let sumY = 0;
            let sumSqX = 0;
            let sumSqY = 0;

            let motionFluxCount = 0;
            const currentLuminance = new Uint8Array(totalSampled);
            let sampleIdx = 0;

            for (let y = 0; y < canvas.height; y += step) {
                for (let x = 0; x < canvas.width; x += step) {
                    const i = (y * canvas.width + x) * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Convert RGB to YCbCr space (standard universal skin locus)
                    const Y = 0.299 * r + 0.587 * g + 0.114 * b;
                    const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                    const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                    currentLuminance[sampleIdx] = Y;

                    if (prevLuminance && Math.abs(Y - prevLuminance[sampleIdx]) > 10) {
                        motionFluxCount++;
                    }

                    // Strict Skin Chrominance Locus (invariant to light skin, dark skin, and ambient white balance)
                    const isSkinChroma = (
                        Cb >= 77 && Cb <= 135 &&
                        Cr >= 130 && Cr <= 175 &&
                        r > 40 && g > 30 && b > 20 &&
                        (r - g) >= 8 &&
                        Math.abs(r - g) < 100
                    );

                    if (isSkinChroma) {
                        skinPixelCount++;
                        sumX += x;
                        sumY += y;
                        sumSqX += x * x;
                        sumSqY += y * y;
                    }

                    sampleIdx++;
                }
            }

            prevLuminance = currentLuminance;

            // Compute Spatial Cluster Statistics
            if (skinPixelCount > 0) {
                const meanX = sumX / skinPixelCount;
                const meanY = sumY / skinPixelCount;
                const varX = (sumSqX / skinPixelCount) - (meanX * meanX);
                const varY = (sumSqY / skinPixelCount) - (meanY * meanY);
                const stdX = Math.sqrt(Math.max(0, varX));
                const stdY = Math.sqrt(Math.max(0, varY));

                const skinRatio = skinPixelCount / totalSampled;

                // Threshold criteria for a localized human face vs a plain background wall:
                // 1. Skin ratio: 2.5% to 42% of frame
                // 2. Spatial localization: std deviation must be compact (not spread edge-to-edge across the whole room)
                // 3. Central alignment: face is generally inside the 10% to 90% view corridor
                const isSkinRatioValid = skinRatio >= 0.025 && skinRatio <= 0.42;
                const isCompactCluster = (
                    stdX >= canvas.width * 0.05 &&
                    stdX <= canvas.width * 0.34 &&
                    stdY >= canvas.height * 0.05 &&
                    stdY <= canvas.height * 0.38
                );
                const isCentered = (
                    meanX >= canvas.width * 0.10 &&
                    meanX <= canvas.width * 0.90 &&
                    meanY >= canvas.height * 0.06 &&
                    meanY <= canvas.height * 0.90
                );

                if (isSkinRatioValid && isCompactCluster && isCentered) {
                    faceDetected = true;
                    const w = Math.max(90, Math.min(canvas.width * 0.6, stdX * 3.2));
                    const h = Math.max(110, Math.min(canvas.height * 0.7, stdY * 3.6));
                    box = {
                        x: Math.max(10, Math.min(canvas.width - w - 10, meanX - (w / 2))),
                        y: Math.max(10, Math.min(canvas.height - h - 10, meanY - (h / 2))),
                        w,
                        h
                    };
                } else if (skinRatio > 0.46) {
                    // Overwhelming skin pixels (multiple persons crowding the frame)
                    multipleFacesDetected = true;
                }
            }
        }

        // Clear canvas to draw clean HUD brackets over live stream
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // State Machine Handling
        if (multipleFacesDetected) {
            badge.style.background = 'rgba(239, 68, 68, 0.25)';
            badge.style.color = 'var(--danger)';
            badge.textContent = '🔴 Alert: Multiple Faces';

            if (warningBox) warningBox.style.display = 'flex';
            if (subtextEl) subtextEl.textContent = 'Multiple persons or silhouettes detected';

            if (sessionData.job?.proctoring?.multi_face_detection) {
                triggerMalpracticeViolation('MULTIPLE_FACES', 'Multiple Persons Detected', 'Secondary face or silhouette detected in proctored camera view.');
            }
        } else if (faceDetected && box) {
            consecutivePresentTicks++;
            consecutiveAbsentTicks = 0;
            lastFaceDetectedTime = Date.now();
            faceAbsentWarningSent = false;

            // Hide warning box immediately upon return
            if (warningBox) warningBox.style.display = 'none';

            // Draw clean High-Tech HUD brackets matching mirrored canvas coordinates
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            const bracketSize = Math.min(24, box.w * 0.2);

            // Top-left bracket
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + bracketSize);
            ctx.lineTo(box.x, box.y);
            ctx.lineTo(box.x + bracketSize, box.y);
            ctx.stroke();

            // Top-right bracket
            ctx.beginPath();
            ctx.moveTo(box.x + box.w - bracketSize, box.y);
            ctx.lineTo(box.x + box.w, box.y);
            ctx.lineTo(box.x + box.w, box.y + bracketSize);
            ctx.stroke();

            // Bottom-left bracket
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + box.h - bracketSize);
            ctx.lineTo(box.x, box.y + box.h);
            ctx.lineTo(box.x + bracketSize, box.y + box.h);
            ctx.stroke();

            // Bottom-right bracket
            ctx.beginPath();
            ctx.moveTo(box.x + box.w - bracketSize, box.y + box.h);
            ctx.lineTo(box.x + box.w, box.y + box.h);
            ctx.lineTo(box.x + box.w, box.y + box.h - bracketSize);
            ctx.stroke();

            // Center subtle reticle
            const centerX = box.x + box.w / 2;
            const centerY = box.y + box.h / 2;
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - 8, centerY);
            ctx.lineTo(centerX + 8, centerY);
            ctx.moveTo(centerX, centerY - 8);
            ctx.lineTo(centerX, centerY + 8);
            ctx.stroke();

            badge.style.background = 'rgba(16, 185, 129, 0.2)';
            badge.style.color = 'var(--success)';
            badge.textContent = '🟢 Face Verified';
        } else {
            // Face Missing / Moved out of frame
            consecutiveAbsentTicks++;
            consecutivePresentTicks = 0;

            const absentDurationMs = Date.now() - lastFaceDetectedTime;
            const remainingSec = Math.max(0, Math.ceil((3500 - absentDurationMs) / 1000));

            badge.style.background = 'rgba(239, 68, 68, 0.25)';
            badge.style.color = 'var(--danger)';
            badge.textContent = remainingSec > 0 ? `🔴 Face Absent (${remainingSec}s)` : '🔴 Face Absent (Infraction)';

            if (warningBox) warningBox.style.display = 'flex';
            if (subtextEl) {
                subtextEl.textContent = remainingSec > 0
                    ? `Please return to camera view immediately (Violation in ${remainingSec}s)`
                    : 'Malpractice Recorded: Candidate departed from camera frame';
            }

            // Trigger official violation after 3.5 seconds of absence
            if (absentDurationMs >= 3500 && !faceAbsentWarningSent) {
                faceAbsentWarningSent = true;
                logProctoringTelemetry('🔴 Malpractice: Candidate face moved out of camera frame.');
                triggerMalpracticeViolation(
                    'FACE_ABSENT',
                    'Candidate Face Not Visible',
                    'No face detected in the proctored webcam stream for over 3 seconds during active assessment.'
                );
            }
        }
    }, 400);
}

// Acoustic visualizer via Web Audio API
function initAcousticMeter() {
    try {
        if (!mediaStream) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 64;
        source.connect(analyserNode);

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        const bar = document.getElementById('audioLevelBar');
        const label = document.getElementById('audioLevelLabel');

        audioMeterInterval = setInterval(() => {
            if (!analyserNode) return;
            analyserNode.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const percentage = Math.min(100, Math.round((avg / 128) * 100));

            if (bar) bar.style.width = `${percentage}%`;
            if (label) {
                if (percentage > 70) {
                    label.textContent = 'High Noise / Talking';
                    label.style.color = 'var(--danger)';
                } else if (percentage > 20) {
                    label.textContent = 'Speech Detected';
                    label.style.color = 'var(--success)';
                } else {
                    label.textContent = 'Quiet';
                    label.style.color = 'var(--text-muted)';
                }
            }
        }, 120);
    } catch (err) {
        console.warn('Acoustic visualizer init error:', err.message);
    }
}

// Watermark Clock
function startWatermarkClock() {
    const wm = document.getElementById('watermarkTime');
    watermarkInterval = setInterval(() => {
        if (wm) {
            wm.textContent = `REC • ${new Date().toLocaleTimeString()}`;
        }
    }, 1000);
}

function logProctoringTelemetry(msg) {
    const log = document.getElementById('proctoringEventLog');
    if (!log) return;

    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.innerHTML = `<span style="opacity: 0.6;">[${time}]</span> ${msg}`;
    log.prepend(entry);
}

function stopMediaStream() {
    if (proctoringInterval) clearInterval(proctoringInterval);
    if (audioMeterInterval) clearInterval(audioMeterInterval);
    if (watermarkInterval) clearInterval(watermarkInterval);

    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
}

function confirmExitInterview() {
    if (isAssessmentActive) {
        if (confirm('Warning: Exiting the assessment before completion will be recorded and may forfeit your candidacy. Are you sure you want to leave?')) {
            stopMediaStream();
            window.location.href = '/applicant';
        }
    } else {
        stopMediaStream();
        window.location.href = '/applicant';
    }
}
