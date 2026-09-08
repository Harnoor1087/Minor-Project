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

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
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
                errorDiv.textContent = data.message;
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'An error occurred. Please try again.';
            errorDiv.classList.add('show');
        }
    });
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
                submitBtn.textContent = 'Creating Account...';
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
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                if (data.user.role === 'admin') {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/applicant';
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
                submitBtn.textContent = 'Register';
            }
        }
    });
}
