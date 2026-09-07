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

// Register Form
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        const company = document.getElementById('company').value;
        const errorDiv = document.getElementById('errorMessage');
        
        try {
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
                errorDiv.textContent = data.message;
                errorDiv.classList.add('show');
            }
        } catch (error) {
            errorDiv.textContent = 'An error occurred. Please try again.';
            errorDiv.classList.add('show');
        }
    });
}
