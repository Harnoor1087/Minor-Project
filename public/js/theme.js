// Theme Switcher for AIRIS (Supports Light and Dark mode)
(function initTheme() {
    const savedTheme = localStorage.getItem('airis-theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', initialTheme);

    function updateToggleButton(theme) {
        const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
        toggleBtns.forEach(btn => {
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
            btn.innerHTML = theme === 'dark' 
                ? '<span class="theme-icon">☀️</span><span class="theme-label-sr">Light</span>' 
                : '<span class="theme-icon">🌙</span><span class="theme-label-sr">Dark</span>';
        });
    }

    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('airis-theme', newTheme);
        updateToggleButton(newTheme);
    };

    // Initialize toggle buttons when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            updateToggleButton(document.documentElement.getAttribute('data-theme') || 'light');
            attachListeners();
        });
    } else {
        updateToggleButton(initialTheme);
        attachListeners();
    }

    function attachListeners() {
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.removeEventListener('click', window.toggleTheme);
            btn.addEventListener('click', window.toggleTheme);
        });
    }

    // Global Toast Notification Helper
    window.showToast = function(message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(toast);

        // Trigger entrance transition
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };
})();
