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

// Scroll reveal animations for Cards, Steps, and Testimonials
(function initScrollReveal() {
    const animatedCards = document.querySelectorAll('.hero-persona-card, .metric-strip-item, .hiring-step-card, .value-col-card, .faq-item, .carousel-wrapper');
    if (!animatedCards.length) return;

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    el.classList.add('is-visible');
                    el.addEventListener('animationend', () => {
                        el.classList.add('animation-done');
                    }, { once: true });
                    obs.unobserve(el);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -40px 0px',
            threshold: 0.1
        });

        animatedCards.forEach(card => observer.observe(card));
    } else {
        // Fallback for browsers without IntersectionObserver
        animatedCards.forEach(card => card.classList.add('is-visible', 'animation-done'));
    }
})();

// Audience perspective toggle logic for How It Works
(function initAudienceToggle() {
    const toggleBtns = document.querySelectorAll('.audience-toggle-btn');
    const stepsWrapper = document.getElementById('hiringStepsWrapper');
    if (!toggleBtns.length || !stepsWrapper) return;

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-target-view');
            toggleBtns.forEach(b => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            stepsWrapper.setAttribute('data-view', targetView);
        });
    });
})();

// Testimonial Carousel Logic
(function initTestimonialCarousel() {
    const track = document.getElementById('testimonialTrack');
    const slides = document.querySelectorAll('.testimonial-slide');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const dots = document.querySelectorAll('.carousel-dot');
    const wrapper = document.getElementById('carouselWrapper');

    if (!track || !slides.length) return;

    let currentIndex = 0;
    const totalSlides = slides.length;
    let autoPlayTimer = null;

    function goToSlide(index) {
        currentIndex = (index + totalSlides) % totalSlides;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;

        dots.forEach((dot, idx) => {
            const isActive = idx === currentIndex;
            dot.classList.toggle('active', isActive);
            dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            goToSlide(currentIndex - 1);
            restartAutoPlay();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            goToSlide(currentIndex + 1);
            restartAutoPlay();
        });
    }

    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            goToSlide(idx);
            restartAutoPlay();
        });
    });

    // Touch & Swipe gestures
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        touchEndX = e.touches[0].clientX;
    }, { passive: true });

    track.addEventListener('touchend', () => {
        const deltaX = touchStartX - touchEndX;
        if (Math.abs(deltaX) > 45 && touchEndX !== 0) {
            if (deltaX > 0) {
                goToSlide(currentIndex + 1);
            } else {
                goToSlide(currentIndex - 1);
            }
            restartAutoPlay();
        }
        touchStartX = 0;
        touchEndX = 0;
    });

    // Keyboard navigation when focused
    if (wrapper) {
        wrapper.setAttribute('tabindex', '0');
        wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                goToSlide(currentIndex - 1);
                restartAutoPlay();
            } else if (e.key === 'ArrowRight') {
                goToSlide(currentIndex + 1);
                restartAutoPlay();
            }
        });
    }

    // Auto-advance loop
    function startAutoPlay() {
        if (!autoPlayTimer) {
            autoPlayTimer = setInterval(() => {
                goToSlide(currentIndex + 1);
            }, 6000);
        }
    }

    function pauseAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    function restartAutoPlay() {
        pauseAutoPlay();
        startAutoPlay();
    }

    if (wrapper) {
        wrapper.addEventListener('mouseenter', pauseAutoPlay);
        wrapper.addEventListener('mouseleave', startAutoPlay);
        wrapper.addEventListener('focusin', pauseAutoPlay);
        wrapper.addEventListener('focusout', startAutoPlay);
    }

    startAutoPlay();
})();
