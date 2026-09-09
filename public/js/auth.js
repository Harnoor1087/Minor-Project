// Check if user is already logged in
if (localStorage.getItem('token')) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.role === 'admin') {
        window.location.href = '/admin';
    } else {
        window.location.href = '/applicant';
    }
}

// Handle role selection in register form
const roleSelect = document.getElementById('role');
const companyGroup = document.getElementById('companyGroup');

if (roleSelect) {
    // Check URL params for role
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role');
    if (roleParam) {
        roleSelect.value = roleParam;
        if (roleParam === 'admin') {
            companyGroup.style.display = 'block';
        }
    }

    roleSelect.addEventListener('change', (e) => {
        if (e.target.value === 'admin') {
            companyGroup.style.display = 'block';
        } else {
            companyGroup.style.display = 'none';
        }
    });
}

// Login Form & Two-Factor OTP Handling
const loginForm = document.getElementById('loginForm');
const loginOtpForm = document.getElementById('loginOtpForm');
const loginCredentialsSection = document.getElementById('loginCredentialsSection');
const loginOtpSection = document.getElementById('loginOtpSection');

let currentLoginEmail = '';

// Reusable Anti-Spam OTP Session and Timer Manager
function createOtpSessionManager({
    purpose,
    getEmail,
    resendBtnId,
    cooldownPillId,
    timerTextId,
    resendNoticeId,
    counterBadgeId,
    devBoxId,
    devTextId,
    autoFillBtnId,
    otpInputId,
    errorDivId
}) {
    let cooldownInterval = null;
    let expirationInterval = null;

    const resendBtn = document.getElementById(resendBtnId);
    const cooldownPill = document.getElementById(cooldownPillId);
    const timerText = document.getElementById(timerTextId);
    const resendNotice = document.getElementById(resendNoticeId);
    const counterBadge = document.getElementById(counterBadgeId);
    const devBox = document.getElementById(devBoxId);
    const devText = document.getElementById(devTextId);
    const autoFillBtn = document.getElementById(autoFillBtnId);
    const otpInput = document.getElementById(otpInputId);
    const errorDiv = document.getElementById(errorDivId);

    function startExpiration(expiresInSeconds = 600) {
        if (expirationInterval) clearInterval(expirationInterval);
        if (!timerText) return;

        let remaining = expiresInSeconds;
        function render() {
            if (remaining <= 0) {
                clearInterval(expirationInterval);
                timerText.textContent = 'Code expired';
                timerText.style.color = '#ef4444';
                if (resendNotice) {
                    resendNotice.className = 'otp-resend-notice warning';
                    resendNotice.textContent = '⚠️ Security code expired. Please click "Resend Code" to generate a fresh code.';
                    resendNotice.style.display = 'block';
                }
                // Allow resending immediately if code has expired
                if (cooldownInterval) clearInterval(cooldownInterval);
                if (resendBtn) {
                    resendBtn.disabled = false;
                    const label = resendBtn.querySelector('.resend-label') || resendBtn;
                    label.textContent = 'Resend Code';
                }
                if (cooldownPill) cooldownPill.style.display = 'none';
                return;
            }

            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            timerText.textContent = `Code expires in ${formatted}`;
            timerText.style.color = '';
            remaining -= 1;
        }

        render();
        expirationInterval = setInterval(render, 1000);
    }

    function startCooldown(cooldownSeconds = 30, resendCount = 0, maxResends = 5, maxReached = false) {
        if (cooldownInterval) clearInterval(cooldownInterval);

        if (counterBadge) {
            counterBadge.textContent = `${resendCount}/${maxResends} sent`;
            counterBadge.style.display = 'inline-block';
        }

        if (maxReached || resendCount >= maxResends) {
            if (resendBtn) {
                resendBtn.disabled = true;
                const label = resendBtn.querySelector('.resend-label') || resendBtn;
                label.textContent = 'Limit Reached';
            }
            if (cooldownPill) cooldownPill.style.display = 'none';
            if (resendNotice) {
                resendNotice.className = 'otp-resend-notice error';
                resendNotice.textContent = '🛑 Maximum resend limit reached for this session. Please wait 10 minutes to protect against email spam.';
                resendNotice.style.display = 'block';
            }
            return;
        }

        let remaining = cooldownSeconds;
        if (resendBtn) {
            resendBtn.disabled = true;
            const label = resendBtn.querySelector('.resend-label') || resendBtn;
            label.textContent = 'Resend Code';
        }
        if (cooldownPill) {
            cooldownPill.style.display = 'inline-block';
            cooldownPill.textContent = `${remaining}s`;
        }

        cooldownInterval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(cooldownInterval);
                if (resendBtn) {
                    resendBtn.disabled = false;
                    const label = resendBtn.querySelector('.resend-label') || resendBtn;
                    label.textContent = 'Resend Code';
                }
                if (cooldownPill) {
                    cooldownPill.style.display = 'none';
                }
            } else {
                if (cooldownPill) {
                    cooldownPill.textContent = `${remaining}s`;
                }
            }
        }, 1000);
    }

    function setupDevHelper(devCode) {
        if (devCode && devBox && devText) {
            devText.textContent = devCode;
            devBox.style.display = 'flex';
            if (autoFillBtn && otpInput) {
                autoFillBtn.onclick = () => {
                    otpInput.value = devCode;
                    otpInput.focus();
                };
            }
        } else if (devBox) {
            devBox.style.display = 'none';
        }
    }

    function initSession(data) {
        startExpiration((data.expiresInMinutes || 10) * 60);
        startCooldown(
            data.cooldownSeconds || 30,
            data.resendCount || 0,
            data.maxResends || 5,
            data.maxReached || false
        );
        setupDevHelper(data.devCode);
        if (resendNotice) {
            resendNotice.style.display = 'none';
            resendNotice.textContent = '';
        }
    }

    // Bind Resend button click
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = getEmail();
            if (!email) return;
            if (resendBtn.disabled) return;

            if (errorDiv) {
                errorDiv.classList.remove('show');
                errorDiv.textContent = '';
            }

            resendBtn.disabled = true;
            const label = resendBtn.querySelector('.resend-label') || resendBtn;
            label.textContent = 'Sending...';
            if (cooldownPill) cooldownPill.style.display = 'none';

            try {
                const response = await fetch('/api/auth/resend-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, purpose })
                });

                const data = await response.json();

                if (response.ok) {
                    if (resendNotice) {
                        resendNotice.className = 'otp-resend-notice success';
                        resendNotice.textContent = data.message || '✓ A fresh verification code has been dispatched.';
                        resendNotice.style.display = 'block';
                    }

                    // Reset OTP input and focus
                    if (otpInput) {
                        otpInput.value = '';
                        otpInput.focus();
                    }

                    // Restart timers with anti-spam cooldown
                    startExpiration((data.expiresInMinutes || 10) * 60);
                    startCooldown(
                        data.cooldownSeconds || 30,
                        data.resendCount || 1,
                        data.maxResends || 5,
                        false
                    );
                    setupDevHelper(data.devCode);
                } else if (response.status === 429) {
                    // Rate limit or max limit hit
                    if (resendNotice) {
                        resendNotice.className = 'otp-resend-notice warning';
                        resendNotice.textContent = data.message || 'Please wait before requesting another code.';
                        resendNotice.style.display = 'block';
                    }
                    startCooldown(
                        data.cooldownSeconds || 30,
                        data.resendCount || 0,
                        data.maxResends || 5,
                        data.maxReached || false
                    );
                } else {
                    if (resendNotice) {
                        resendNotice.className = 'otp-resend-notice error';
                        resendNotice.textContent = data.message || 'Could not resend code. Please try again.';
                        resendNotice.style.display = 'block';
                    }
                    resendBtn.disabled = false;
                    label.textContent = 'Resend Code';
                }
            } catch (err) {
                if (resendNotice) {
                    resendNotice.className = 'otp-resend-notice error';
                    resendNotice.textContent = 'Network error while requesting code. Please try again.';
                    resendNotice.style.display = 'block';
                }
                resendBtn.disabled = false;
                label.textContent = 'Resend Code';
            }
        });
    }

    return {
        initSession,
        startCooldown,
        startExpiration,
        clearTimers: () => {
            if (cooldownInterval) clearInterval(cooldownInterval);
            if (expirationInterval) clearInterval(expirationInterval);
        }
    };
}

const loginOtpManager = createOtpSessionManager({
    purpose: 'login',
    getEmail: () => currentLoginEmail,
    resendBtnId: 'loginResendBtn',
    cooldownPillId: 'loginCooldownPill',
    timerTextId: 'loginTimerText',
    resendNoticeId: 'loginResendNotice',
    counterBadgeId: 'loginResendCounterBadge',
    devBoxId: 'loginDevOtpBox',
    devTextId: 'loginDevCodeText',
    autoFillBtnId: 'loginAutoFillBtn',
    otpInputId: 'loginOtpInput',
    errorDivId: 'loginOtpError'
});

if (loginForm) {
    const errorDiv = document.getElementById('errorMessage');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn') || loginForm.querySelector('button[type="submit"]');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (errorDiv) {
            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
        }

        try {
            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = true;
                loginSubmitBtn.textContent = 'Authenticating...';
            }

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.requiresOtp) {
                    // Transition to Two-Factor OTP Verification
                    currentLoginEmail = data.email;
                    if (loginCredentialsSection) loginCredentialsSection.style.display = 'none';
                    if (loginOtpSection) loginOtpSection.classList.add('active');

                    const displayEmailEl = document.getElementById('loginOtpEmailDisplay');
                    if (displayEmailEl) {
                        if (data.notice && data.notice.includes('verified inbox')) {
                            displayEmailEl.innerHTML = `${data.email}<br><small style="color: #6366f1; font-weight: 500; display: inline-block; margin-top: 4px;">(Sandbox: Delivered to verified test inbox)</small>`;
                        } else {
                            displayEmailEl.textContent = data.email;
                        }
                    }

                    const otpInput = document.getElementById('loginOtpInput');
                    if (otpInput) {
                        otpInput.value = '';
                        otpInput.focus();
                    }

                    // Initialize Anti-Spam Resend and Countdown Timers
                    loginOtpManager.initSession(data);

                } else if (data.token) {
                    // Direct token issued
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/applicant';
                    }
                }
            } else {
                if (errorDiv) {
                    errorDiv.textContent = data.message || 'Invalid email or password.';
                    errorDiv.classList.add('show');
                }
            }
        } catch (error) {
            if (errorDiv) {
                errorDiv.textContent = 'A network error occurred. Please try again.';
                errorDiv.classList.add('show');
            }
        } finally {
            if (loginSubmitBtn) {
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = 'Sign In';
            }
        }
    });

    // Handle Login OTP submission
    if (loginOtpForm) {
        const otpErrorDiv = document.getElementById('loginOtpError');
        const loginVerifyBtn = document.getElementById('loginVerifyBtn');

        loginOtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const otpInput = document.getElementById('loginOtpInput');
            const code = otpInput ? otpInput.value.trim() : '';

            if (otpErrorDiv) {
                otpErrorDiv.classList.remove('show');
                otpErrorDiv.textContent = '';
            }

            if (!code || code.length !== 6) {
                if (otpErrorDiv) {
                    otpErrorDiv.textContent = 'Please enter the complete 6-digit verification code.';
                    otpErrorDiv.classList.add('show');
                }
                return;
            }

            try {
                if (loginVerifyBtn) {
                    loginVerifyBtn.disabled = true;
                    loginVerifyBtn.textContent = 'Verifying Code...';
                }

                const response = await fetch('/api/auth/login/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentLoginEmail, code })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/applicant';
                    }
                } else {
                    if (otpErrorDiv) {
                        otpErrorDiv.textContent = data.message || 'Verification failed. Please try again.';
                        otpErrorDiv.classList.add('show');
                    }
                }
            } catch (err) {
                if (otpErrorDiv) {
                    otpErrorDiv.textContent = 'A network error occurred. Please try again.';
                    otpErrorDiv.classList.add('show');
                }
            } finally {
                if (loginVerifyBtn) {
                    loginVerifyBtn.disabled = false;
                    loginVerifyBtn.textContent = 'Verify & Sign In';
                }
            }
        });

        // Back to credentials button
        const backToLoginBtn = document.getElementById('backToLoginFormBtn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                loginOtpManager.clearTimers();
                if (loginOtpSection) loginOtpSection.classList.remove('active');
                if (loginCredentialsSection) loginCredentialsSection.style.display = 'block';
            });
        }
    }
}

// Register Form & Password Security Schema
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');
    const passwordToggleIcon = document.getElementById('passwordToggleIcon');
    const confirmToggleIcon = document.getElementById('confirmToggleIcon');

    const strengthLabel = document.getElementById('strengthLabel');
    const strengthBar = document.getElementById('strengthBar');

    const reqLength = document.getElementById('reqLength');
    const reqNumber = document.getElementById('reqNumber');
    const reqSpecial = document.getElementById('reqSpecial');
    const reqCase = document.getElementById('reqCase');
    const passwordMatchFeedback = document.getElementById('passwordMatchFeedback');

    // Password visibility toggle helpers
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            passwordToggleIcon.textContent = isPassword ? '🙈' : '👁️';
            togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    }

    if (toggleConfirmPasswordBtn && confirmPasswordInput) {
        toggleConfirmPasswordBtn.addEventListener('click', () => {
            const isPassword = confirmPasswordInput.type === 'password';
            confirmPasswordInput.type = isPassword ? 'text' : 'password';
            confirmToggleIcon.textContent = isPassword ? '🙈' : '👁️';
            toggleConfirmPasswordBtn.setAttribute('aria-label', isPassword ? 'Hide confirm password' : 'Show password');
        });
    }

    // Password validation schema evaluation
    function evaluatePassword(pwd) {
        const hasLength = pwd.length >= 8 && pwd.length <= 128;
        const hasNumber = /[0-9]/.test(pwd);
        const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(pwd);
        const hasLower = /[a-z]/.test(pwd);
        const hasUpper = /[A-Z]/.test(pwd);
        const hasCase = hasLower && hasUpper;

        const allValid = hasLength && hasNumber && hasSpecial && hasCase;

        // Calculate score (0-4)
        let score = 0;
        if (pwd.length >= 8) score++;
        if (hasNumber) score++;
        if (hasSpecial) score++;
        if (hasCase) score++;
        if (pwd.length >= 12 && allValid) score = 4; // Extra length bonus for strong

        return {
            hasLength,
            hasNumber,
            hasSpecial,
            hasCase,
            allValid,
            score
        };
    }

    function updateRequirementItem(itemEl, isValid) {
        if (!itemEl) return;
        const iconEl = itemEl.querySelector('.req-icon');
        if (isValid) {
            itemEl.classList.add('valid');
            if (iconEl) iconEl.textContent = '✓';
        } else {
            itemEl.classList.remove('valid');
            if (iconEl) iconEl.textContent = '○';
        }
    }

    function updatePasswordUI() {
        const pwd = passwordInput ? passwordInput.value : '';
        const confirmPwd = confirmPasswordInput ? confirmPasswordInput.value : '';
        const evalResult = evaluatePassword(pwd);

        // Update checklist
        updateRequirementItem(reqLength, evalResult.hasLength);
        updateRequirementItem(reqNumber, evalResult.hasNumber);
        updateRequirementItem(reqSpecial, evalResult.hasSpecial);
        updateRequirementItem(reqCase, evalResult.hasCase);

        // Update Strength Meter
        if (strengthLabel && strengthBar) {
            strengthLabel.className = 'strength-label';
            strengthBar.className = 'strength-meter-bar';

            if (!pwd) {
                strengthLabel.textContent = 'Enter password';
            } else if (evalResult.score <= 1) {
                strengthLabel.textContent = 'Weak';
                strengthLabel.classList.add('weak');
                strengthBar.classList.add('weak');
            } else if (evalResult.score === 2) {
                strengthLabel.textContent = 'Fair';
                strengthLabel.classList.add('fair');
                strengthBar.classList.add('fair');
            } else if (evalResult.score === 3) {
                strengthLabel.textContent = 'Good';
                strengthLabel.classList.add('good');
                strengthBar.classList.add('good');
            } else {
                strengthLabel.textContent = 'Strong';
                strengthLabel.classList.add('strong');
                strengthBar.classList.add('strong');
            }
        }

        // Update Confirm Password Feedback
        if (passwordMatchFeedback && confirmPasswordInput) {
            passwordMatchFeedback.className = 'password-match-feedback';
            if (!confirmPwd) {
                passwordMatchFeedback.textContent = '';
            } else if (pwd === confirmPwd) {
                passwordMatchFeedback.textContent = '✓ Passwords match';
                passwordMatchFeedback.classList.add('match');
            } else {
                passwordMatchFeedback.textContent = '✗ Passwords do not match';
                passwordMatchFeedback.classList.add('mismatch');
            }
        }

        return evalResult;
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordUI);
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', updatePasswordUI);
    }

    // Submit Handler with Client & Server Validation
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
        const role = document.getElementById('role').value;
        const company = document.getElementById('company').value.trim();
        const errorDiv = document.getElementById('errorMessage');
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        // Validate basic inputs
        if (!name || !email || !password) {
            errorDiv.textContent = 'Please fill in all required fields.';
            errorDiv.classList.add('show');
            return;
        }

        // Validate schema rules
        const evalResult = evaluatePassword(password);
        if (!evalResult.allValid) {
            let failureMsg = 'Password does not meet the security requirements:';
            const missing = [];
            if (!evalResult.hasLength) missing.push('at least 8 characters');
            if (!evalResult.hasNumber) missing.push('at least one numeric digit (0-9)');
            if (!evalResult.hasSpecial) missing.push('at least one special character');
            if (!evalResult.hasCase) missing.push('both uppercase and lowercase letters');

            errorDiv.textContent = `${failureMsg} ${missing.join(', ')}.`;
            errorDiv.classList.add('show');
            passwordInput.focus();
            return;
        }

        // Validate matching passwords
        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match. Please verify and try again.';
            errorDiv.classList.add('show');
            if (confirmPasswordInput) confirmPasswordInput.focus();
            return;
        }

        // Submit to API
        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending Verification Code...';
            }

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password, role, company })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.requiresOtp) {
                    // Transition to Email OTP Verification screen
                    currentRegisterEmail = data.email;
                    const registerCredentialsSection = document.getElementById('registerCredentialsSection');
                    const registerOtpSection = document.getElementById('registerOtpSection');
                    const registerOtpEmailDisplay = document.getElementById('registerOtpEmailDisplay');
                    const registerOtpInput = document.getElementById('registerOtpInput');

                    if (registerCredentialsSection) registerCredentialsSection.style.display = 'none';
                    if (registerOtpSection) registerOtpSection.classList.add('active');
                    if (registerOtpEmailDisplay) {
                        if (data.notice && data.notice.includes('verified inbox')) {
                            registerOtpEmailDisplay.innerHTML = `${data.email}<br><small style="color: #6366f1; font-weight: 500; display: inline-block; margin-top: 4px;">(Sandbox: Delivered to verified test inbox)</small>`;
                        } else {
                            registerOtpEmailDisplay.textContent = data.email;
                        }
                    }

                    if (registerOtpInput) {
                        registerOtpInput.value = '';
                        registerOtpInput.focus();
                    }

                    // Initialize Anti-Spam Resend and Countdown Timers
                    registerOtpManager.initSession(data);

                } else if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/applicant';
                    }
                }
            } else {
                errorDiv.textContent = data.message || 'Registration failed. Please check your credentials.';
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'A network error occurred. Please try again.';
            errorDiv.classList.add('show');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Continue & Send Code';
            }
        }
    });

    // Registration OTP Verification Form
    const registerOtpForm = document.getElementById('registerOtpForm');
    let currentRegisterEmail = '';

    const registerOtpManager = createOtpSessionManager({
        purpose: 'registration',
        getEmail: () => currentRegisterEmail,
        resendBtnId: 'registerResendBtn',
        cooldownPillId: 'registerCooldownPill',
        timerTextId: 'registerTimerText',
        resendNoticeId: 'registerResendNotice',
        counterBadgeId: 'registerResendCounterBadge',
        devBoxId: 'registerDevOtpBox',
        devTextId: 'registerDevCodeText',
        autoFillBtnId: 'registerAutoFillBtn',
        otpInputId: 'registerOtpInput',
        errorDivId: 'registerOtpError'
    });

    if (registerOtpForm) {
        const registerOtpError = document.getElementById('registerOtpError');
        const registerVerifyBtn = document.getElementById('registerVerifyBtn');

        registerOtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const otpInput = document.getElementById('registerOtpInput');
            const code = otpInput ? otpInput.value.trim() : '';

            if (registerOtpError) {
                registerOtpError.classList.remove('show');
                registerOtpError.textContent = '';
            }

            if (!code || code.length !== 6) {
                if (registerOtpError) {
                    registerOtpError.textContent = 'Please enter the full 6-digit confirmation code.';
                    registerOtpError.classList.add('show');
                }
                return;
            }

            try {
                if (registerVerifyBtn) {
                    registerVerifyBtn.disabled = true;
                    registerVerifyBtn.textContent = 'Creating Account...';
                }

                const response = await fetch('/api/auth/register/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentRegisterEmail, code })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));

                    if (data.user.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/applicant';
                    }
                } else {
                    if (registerOtpError) {
                        registerOtpError.textContent = data.message || 'Verification failed. Please try again.';
                        registerOtpError.classList.add('show');
                    }
                }
            } catch (err) {
                if (registerOtpError) {
                    registerOtpError.textContent = 'A network error occurred. Please try again.';
                    registerOtpError.classList.add('show');
                }
            } finally {
                if (registerVerifyBtn) {
                    registerVerifyBtn.disabled = false;
                    registerVerifyBtn.textContent = 'Verify & Create Account';
                }
            }
        });

        // Back to registration details
        const backToRegisterBtn = document.getElementById('backToRegisterFormBtn');
        if (backToRegisterBtn) {
            backToRegisterBtn.addEventListener('click', () => {
                registerOtpManager.clearTimers();
                const registerOtpSection = document.getElementById('registerOtpSection');
                const registerCredentialsSection = document.getElementById('registerCredentialsSection');
                if (registerOtpSection) registerOtpSection.classList.remove('active');
                if (registerCredentialsSection) registerCredentialsSection.style.display = 'block';
            });
        }
    }
}
