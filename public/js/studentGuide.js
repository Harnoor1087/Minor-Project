// Interactive Engine for the AIRIS Student & Candidate Guide (/students)
(function initStudentGuide() {
    // 1. Transparency Dossier Toggle (What You Submit vs What The Recruiter Sees)
    const dossierTabs = document.querySelectorAll('.dossier-tab-btn');
    const submissionView = document.getElementById('dossierSubmissionView');
    const recruiterView = document.getElementById('dossierRecruiterView');

    if (dossierTabs.length) {
        dossierTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-target-view');
                dossierTabs.forEach(t => {
                    const isActive = t === tab;
                    t.classList.toggle('active', isActive);
                    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });

                if (target === 'recruiter') {
                    if (submissionView) submissionView.style.display = 'none';
                    if (recruiterView) recruiterView.style.display = 'block';
                } else {
                    if (submissionView) submissionView.style.display = 'block';
                    if (recruiterView) recruiterView.style.display = 'none';
                }
            });
        });
    }

    // 2. Interactive Pre-Application Readiness Checklist
    const checklistItems = document.querySelectorAll('.readiness-checkbox');
    const progressFill = document.getElementById('readinessProgressFill');
    const progressPercent = document.getElementById('readinessPercentText');
    const readinessBadge = document.getElementById('readinessStatusBadge');
    const readinessMessage = document.getElementById('readinessMessageText');

    function updateReadinessScore() {
        if (!checklistItems.length) return;
        let checkedCount = 0;
        checklistItems.forEach(item => {
            if (item.checked) checkedCount++;
        });

        const total = checklistItems.length;
        const percent = Math.round((checkedCount / total) * 100);

        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}% Ready`;

        if (readinessBadge && readinessMessage) {
            if (percent === 100) {
                readinessBadge.textContent = '🌟 Fully Calibrated (100%)';
                readinessBadge.className = 'readiness-badge badge-ready';
                readinessMessage.textContent = 'Awesome! Your application profile, environment, and credentials meet top enterprise recruiter standards.';
            } else if (percent >= 60) {
                readinessBadge.textContent = '⚡ Almost Ready';
                readinessBadge.className = 'readiness-badge badge-warning';
                readinessMessage.textContent = 'Good progress! Check off the remaining items to ensure maximum ATS matching and proctoring compliance.';
            } else {
                readinessBadge.textContent = '⏳ Action Needed';
                readinessBadge.className = 'readiness-badge badge-pending';
                readinessMessage.textContent = 'Complete the checklist items above before submitting to ensure your application passes automated screening.';
            }
        }
    }

    if (checklistItems.length) {
        checklistItems.forEach(item => {
            item.addEventListener('change', updateReadinessScore);
        });
        updateReadinessScore();
    }

    // 3. Smooth scrolling for guide anchors
    document.querySelectorAll('.guide-nav-link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
})();
