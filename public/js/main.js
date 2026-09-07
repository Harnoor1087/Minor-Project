// Main JavaScript for homepage

// Check if user is logged in and redirect
const token = localStorage.getItem('token');
const user = localStorage.getItem('user');

if (token && user) {
    const userData = JSON.parse(user);
    if (userData.role === 'admin') {
        // Don't redirect from homepage, just show logged in state
        console.log('User is logged in as admin');
    } else if (userData.role === 'applicant') {
        console.log('User is logged in as applicant');
    }
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
