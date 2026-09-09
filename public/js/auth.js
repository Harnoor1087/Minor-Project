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
let loginCooldownTimer = null;

function startOtpCountdown(btnEl, timerTextEl, cooldownSeconds = 30) {
    if (!btnEl) return;
    let remaining = cooldownSeconds;
    btnEl.disabled = true;
    btnEl.textContent = `Resend Code (${remaining}s)`;

    if (timerTextEl) {
        timerTextEl.textContent = 'Code expires in 10m';
    }

    const interval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(interval);
            btnEl.disabled = false;
            btnEl.textContent = 'Resend Code';
        } else {
            btnEl.textContent = `Resend Code (${remaining}s)`;
        }
    }, 1000);

    return interval;
}

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

                    // Sandbox / Dev code helper
                    const devBox = document.getElementById('loginDevOtpBox');
                    const devText = document.getElementById('loginDevCodeText');
                    const autoFillBtn = document.getElementById('loginAutoFillBtn');
                    if (data.devCode && devBox && devText) {
                        devText.textContent = data.devCode;
                        devBox.style.display = 'flex';
                        if (autoFillBtn && otpInput) {
                            autoFillBtn.onclick = () => {
                                otpInput.value = data.devCode;
                                otpInput.focus();
                            };
                        }
                    } else if (devBox) {
                        devBox.style.display = 'none';
                    }

                    // Resend Timer
                    const resendBtn = document.getElementById('loginResendBtn');
                    const timerText = document.getElementById('loginTimerText');
                    if (loginCooldownTimer) clearInterval(loginCooldownTimer);
                    loginCooldownTimer = startOtpCountdown(resendBtn, timerText, data.cooldownSeconds || 30);

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

        // Resend Login OTP
        const loginResendBtn = document.getElementById('loginResendBtn');
        if (loginResendBtn) {
            loginResendBtn.addEventListener('click', async () => {
                if (!currentLoginEmail) return;

                if (otpErrorDiv) {
                    otpErrorDiv.classList.remove('show');
                    otpErrorDiv.textContent = '';
                }

                try {
                    loginResendBtn.disabled = true;
                    loginResendBtn.textContent = 'Sending...';

                    const response = await fetch('/api/auth/resend-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentLoginEmail, purpose: 'login' })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        if (loginCooldownTimer) clearInterval(loginCooldownTimer);
                        loginCooldownTimer = startOtpCountdown(loginResendBtn, document.getElementById('loginTimerText'), data.cooldownSeconds || 30);

                        if (data.devCode) {
                            const devBox = document.getElementById('loginDevOtpBox');
                            const devText = document.getElementById('loginDevCodeText');
                            if (devBox && devText) {
                                devText.textContent = data.devCode;
                                devBox.style.display = 'flex';
                            }
                        }
                    } else {
                        if (otpErrorDiv) {
                            otpErrorDiv.textContent = data.message || 'Could not resend code. Please try again.';
                            otpErrorDiv.classList.add('show');
                        }
                        loginResendBtn.disabled = false;
                        loginResendBtn.textContent = 'Resend Code';
                    }
                } catch (err) {
                    loginResendBtn.disabled = false;
                    loginResendBtn.textContent = 'Resend Code';
                }
            });
        }

        // Back to credentials button
        const backToLoginBtn = document.getElementById('backToLoginFormBtn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
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

                    // Sandbox / Dev code helper
                    const devBox = document.getElementById('registerDevOtpBox');
                    const devText = document.getElementById('registerDevCodeText');
                    const autoFillBtn = document.getElementById('registerAutoFillBtn');
                    if (data.devCode && devBox && devText) {
                        devText.textContent = data.devCode;
                        devBox.style.display = 'flex';
                        if (autoFillBtn && registerOtpInput) {
                            autoFillBtn.onclick = () => {
                                registerOtpInput.value = data.devCode;
                                registerOtpInput.focus();
                            };
                        }
                    } else if (devBox) {
                        devBox.style.display = 'none';
                    }

                    // Resend Timer
                    const resendBtn = document.getElementById('registerResendBtn');
                    const timerText = document.getElementById('registerTimerText');
                    if (registerCooldownTimer) clearInterval(registerCooldownTimer);
                    registerCooldownTimer = startOtpCountdown(resendBtn, timerText, data.cooldownSeconds || 30);

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
    let registerCooldownTimer = null;

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

        // Resend Registration OTP
        const registerResendBtn = document.getElementById('registerResendBtn');
        if (registerResendBtn) {
            registerResendBtn.addEventListener('click', async () => {
                if (!currentRegisterEmail) return;

                if (registerOtpError) {
                    registerOtpError.classList.remove('show');
                    registerOtpError.textContent = '';
                }

                try {
                    registerResendBtn.disabled = true;
                    registerResendBtn.textContent = 'Sending...';

                    const response = await fetch('/api/auth/resend-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentRegisterEmail, purpose: 'registration' })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        if (registerCooldownTimer) clearInterval(registerCooldownTimer);
                        registerCooldownTimer = startOtpCountdown(registerResendBtn, document.getElementById('registerTimerText'), data.cooldownSeconds || 30);

                        if (data.devCode) {
                            const devBox = document.getElementById('registerDevOtpBox');
                            const devText = document.getElementById('registerDevCodeText');
                            if (devBox && devText) {
                                devText.textContent = data.devCode;
                                devBox.style.display = 'flex';
                            }
                        }
                    } else {
                        if (registerOtpError) {
                            registerOtpError.textContent = data.message || 'Could not resend code. Please try again.';
                            registerOtpError.classList.add('show');
                        }
                        registerResendBtn.disabled = false;
                        registerResendBtn.textContent = 'Resend Code';
                    }
                } catch (err) {
                    registerResendBtn.disabled = false;
                    registerResendBtn.textContent = 'Resend Code';
                }
            });
        }

        // Back to registration details
        const backToRegisterBtn = document.getElementById('backToRegisterFormBtn');
        if (backToRegisterBtn) {
            backToRegisterBtn.addEventListener('click', () => {
                const registerOtpSection = document.getElementById('registerOtpSection');
                const registerCredentialsSection = document.getElementById('registerCredentialsSection');
                if (registerOtpSection) registerOtpSection.classList.remove('active');
                if (registerCredentialsSection) registerCredentialsSection.style.display = 'block';
            });
        }
    }
}
