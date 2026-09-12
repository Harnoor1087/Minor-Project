// Interactive Persona Switcher and Recruiter Portal Access Engine for AIRIS Homepage
(function initPersonaSwitcher() {
    // Persona definitions
    const PERSONAS = {
        recruiter: {
            id: 'recruiter',
            name: 'Sarah Jenkins',
            role: 'Lead Talent Partner & Admin',
            avatar: '🏢',
            email: 'admin@company.com',
            tenantName: '🏢 AIRIS Talent Global',
            portalUrl: '/admin',
            targetLabel: 'Recruiter Suite',
            description: 'Automate multi-vector resume screening, anti-cheat proctored interview telemetry, candidate leveling matrices, and calibrated offer dispatches.',
            launchText: 'Launch Recruiter Portal &rarr;',
            altPersona: 'candidate',
            altText: 'Switch to Candidate View'
        },
        candidate: {
            id: 'candidate',
            name: 'Alex Morgan',
            role: 'Full Stack Candidate',
            avatar: '🎯',
            email: 'alex.morgan@example.com',
            tenantName: '🎯 Merit Career Portal',
            portalUrl: '/applicant',
            targetLabel: 'Candidate Portal',
            description: 'Apply with verified technical certificates, bypass resume black holes, review D3 skill gap radar benchmarks, and accept calibrated offers.',
            launchText: 'Launch Candidate Portal &rarr;',
            altPersona: 'recruiter',
            altText: 'Switch to Recruiter View'
        }
    };

    let activePersona = localStorage.getItem('activeDemoPersona') || 'recruiter';
    let selectedCompanyId = 'comp_airis';

    // Elements
    const tabRecruiter = document.getElementById('personaTabRecruiter');
    const tabCandidate = document.getElementById('personaTabCandidate');
    const contextCard = document.getElementById('personaContextCard');
    const avatarEl = document.getElementById('personaAvatar');
    const nameEl = document.getElementById('personaNameTitle');
    const roleBadge = document.getElementById('personaRoleBadge');
    const tenantBadge = document.getElementById('personaTenantBadge');
    const descText = document.getElementById('personaDescText');
    const launchBtn = document.getElementById('personaLaunchBtn');
    const launchText = document.getElementById('personaLaunchText');
    const launchIcon = document.getElementById('personaLaunchIcon');
    const altBtn = document.getElementById('personaAlternativeBtn');
    const tenantPickerGroup = document.getElementById('recruiterTenantPickerGroup');
    const tenantSelect = document.getElementById('personaTenantSelect');

    const gatewayCompanyCard = document.getElementById('gatewayCompanyCard');
    const gatewayApplicantCard = document.getElementById('gatewayApplicantCard');

    // Switch active persona UI
    function switchActivePersona(personaKey) {
        if (!PERSONAS[personaKey]) personaKey = 'recruiter';
        activePersona = personaKey;
        localStorage.setItem('activeDemoPersona', personaKey);

        const config = PERSONAS[personaKey];

        // Update tabs
        if (tabRecruiter && tabCandidate) {
            const isRecruiter = personaKey === 'recruiter';
            tabRecruiter.classList.toggle('active', isRecruiter);
            tabRecruiter.setAttribute('aria-selected', isRecruiter ? 'true' : 'false');
            tabCandidate.classList.toggle('active', !isRecruiter);
            tabCandidate.setAttribute('aria-selected', !isRecruiter ? 'true' : 'false');
        }

        // Update context card mode
        if (contextCard) {
            contextCard.classList.remove('recruiter-mode', 'candidate-mode');
            contextCard.classList.add(`${personaKey}-mode`);
        }

        // Update metadata
        if (avatarEl) avatarEl.textContent = config.avatar;
        if (nameEl) nameEl.textContent = config.name;
        if (roleBadge) {
            roleBadge.textContent = config.role;
            roleBadge.style.color = personaKey === 'recruiter' ? 'var(--primary)' : 'var(--accent)';
            roleBadge.style.background = personaKey === 'recruiter' ? 'var(--primary-light)' : 'var(--accent-light)';
            roleBadge.style.borderColor = personaKey === 'recruiter' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(6, 182, 212, 0.25)';
        }
        if (tenantBadge) {
            if (personaKey === 'recruiter') {
                const sel = tenantSelect ? tenantSelect.options[tenantSelect.selectedIndex]?.text : 'AIRIS Talent Global';
                tenantBadge.textContent = sel ? `🏢 ${sel.split(' (')[0]}` : config.tenantName;
            } else {
                tenantBadge.textContent = config.tenantName;
            }
        }
        if (descText) descText.textContent = config.description;

        // Update launch button text
        if (launchText) launchText.innerHTML = config.launchText;
        if (launchIcon) launchIcon.textContent = personaKey === 'recruiter' ? '🚀' : '🎯';

        // Update alternative button
        if (altBtn) {
            altBtn.innerHTML = `<span>${personaKey === 'recruiter' ? '🎯' : '🏢'}</span> ${config.altText}`;
        }

        // Show/hide tenant picker
        if (tenantPickerGroup) {
            tenantPickerGroup.style.display = personaKey === 'recruiter' ? 'flex' : 'none';
        }

        // Update gateway card highlights
        if (gatewayCompanyCard && gatewayApplicantCard) {
            gatewayCompanyCard.classList.toggle('active-persona-focus', personaKey === 'recruiter');
            gatewayApplicantCard.classList.toggle('active-persona-focus', personaKey === 'candidate');
        }
    }

    // Tenant selection change
    function onTenantChange(compId) {
        selectedCompanyId = compId;
        if (activePersona === 'recruiter' && tenantBadge && tenantSelect) {
            const selText = tenantSelect.options[tenantSelect.selectedIndex]?.text || '';
            tenantBadge.textContent = `🏢 ${selText.split(' (')[0]}`;
        }
    }

    // Launch active persona portal
    async function launchActivePersonaPortal() {
        await quickLaunchDemo(activePersona, selectedCompanyId);
    }

    // Perform Instant Demo Login & Redirect
    async function quickLaunchDemo(persona, companyId) {
        const targetPersona = persona || activePersona;
        const targetCompId = companyId || selectedCompanyId;
        const config = PERSONAS[targetPersona] || PERSONAS.recruiter;

        // Show feedback on launch button
        if (launchBtn) {
            launchBtn.disabled = true;
            launchBtn.style.opacity = '0.8';
        }
        if (launchText) {
            launchText.textContent = `Authenticating as ${config.name.split(' ')[0]}...`;
        }

        showPersonaToast(`Authenticating demo session for ${config.name}...`, '🔑');

        try {
            const response = await fetch('/api/auth/demo-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: targetPersona,
                    companyId: targetCompId
                })
            });

            if (!response.ok) {
                throw new Error(`Demo login error: ${response.statusText}`);
            }

            const data = await response.json();

            // Store session
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('activeDemoPersona', targetPersona);

            showPersonaToast(`Session ready! Redirecting to ${config.targetLabel}...`, '🚀');

            setTimeout(() => {
                window.location.href = data.targetUrl || config.portalUrl;
            }, 300);

        } catch (err) {
            console.warn('[PersonaSwitcher] Network demo login error, applying client-side fallback:', err);
            // Fallback for seamless demo offline continuity
            const fallbackToken = 'airis_demo_token_' + Date.now();
            const fallbackUser = {
                id: targetPersona === 'recruiter' ? 'usr_admin_1' : 'usr_applicant_1',
                name: config.name,
                email: config.email,
                role: targetPersona === 'recruiter' ? 'admin' : 'applicant',
                company: targetPersona === 'recruiter' ? 'AIRIS Talent Global' : '',
                companyId: targetPersona === 'recruiter' ? targetCompId : '',
                companyLogo: '🏢'
            };

            localStorage.setItem('token', fallbackToken);
            localStorage.setItem('user', JSON.stringify(fallbackUser));
            localStorage.setItem('activeDemoPersona', targetPersona);

            showPersonaToast(`Redirecting to ${config.targetLabel}...`, '🚀');

            setTimeout(() => {
                window.location.href = config.portalUrl;
            }, 300);
        } finally {
            if (launchBtn) {
                launchBtn.disabled = false;
                launchBtn.style.opacity = '1';
            }
        }
    }

    // Display a clean, accessible toast notification
    function showPersonaToast(message, icon = 'ℹ️') {
        let toast = document.getElementById('personaToastEl');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'personaToastEl';
            toast.className = 'persona-toast';
            document.body.appendChild(toast);
        }

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        toast.classList.add('show');

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // Sync navbar with current authenticated state
    function syncNavbarState() {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        const navAuthLinks = document.getElementById('navAuthLinks');
        const navRecruiterBtn = document.getElementById('navRecruiterPortalBtn');

        if (!navAuthLinks) return;

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                const isAdmin = user.role === 'admin';

                // Update recruiter button text
                if (navRecruiterBtn) {
                    if (isAdmin) {
                        navRecruiterBtn.innerHTML = `🏢 Recruiter Suite <span class="portal-badge">Active</span>`;
                        navRecruiterBtn.onclick = () => { window.location.href = '/admin'; };
                    } else {
                        navRecruiterBtn.innerHTML = `🏢 Recruiter Portal`;
                        navRecruiterBtn.onclick = () => { quickLaunchDemo('recruiter'); };
                    }
                }

                // Render logged in chip in navbar
                navAuthLinks.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <a href="${isAdmin ? '/admin' : '/applicant'}" class="nav-user-chip" title="Go to dashboard">
                            <span>👤</span>
                            <span>${user.name.split(' ')[0]}</span>
                            <span class="nav-user-role">${isAdmin ? 'Recruiter' : 'Candidate'}</span>
                        </a>
                        <button onclick="logoutDemoSession()" class="btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 8px;" title="Sign out / reset persona">
                            Logout
                        </button>
                    </div>
                `;
            } catch (e) {
                console.warn('[PersonaSwitcher] Invalid user state in localStorage');
            }
        } else {
            // Not logged in: Default recruiter portal button opens recruiter suite instantly
            if (navRecruiterBtn) {
                navRecruiterBtn.innerHTML = `🏢 Recruiter Portal <span class="portal-badge">Instant Demo</span>`;
                navRecruiterBtn.onclick = () => { quickLaunchDemo('recruiter'); };
            }
        }
    }

    // Logout and reset demo
    window.logoutDemoSession = function() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showPersonaToast('Signed out of demo session.', '👋');
        setTimeout(() => {
            window.location.reload();
        }, 300);
    };

    // Expose global methods
    window.switchActivePersona = switchActivePersona;
    window.launchActivePersonaPortal = launchActivePersonaPortal;
    window.quickLaunchDemo = quickLaunchDemo;
    window.onTenantChange = onTenantChange;

    // Attach alternative button handler
    if (altBtn) {
        altBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const nextPersona = activePersona === 'recruiter' ? 'candidate' : 'recruiter';
            switchActivePersona(nextPersona);
        });
    }

    // Initialize state
    switchActivePersona(activePersona);
    syncNavbarState();

})();
