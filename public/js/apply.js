// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
    window.location.href = '/login';
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Get job ID from URL
const urlParams = new URLSearchParams(window.location.search);
const jobId = urlParams.get('jobId');

if (!jobId) {
    alert('No job selected');
    window.location.href = '/applicant';
}

// Load job details
async function loadJobDetails() {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        
        document.getElementById('jobId').textContent = job.job_id;
        document.getElementById('jobTitle').textContent = job.title;
        document.getElementById('job_id').value = job.job_id;
        document.getElementById('confirmJobIdText').textContent = job.job_id;
        
        // Pre-fill user data
        document.getElementById('name').value = user.name;
        document.getElementById('email').value = user.email;
    } catch (error) {
        console.error('Error loading job:', error);
        alert('Error loading job details');
    }
}

// Handle form submission
const applyForm = document.getElementById('applyForm');
applyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('applyError');
    
    // Validate
    if (!document.getElementById('confirmJobId').checked) {
        errorDiv.textContent = 'Please confirm that you have noted the Job ID';
        errorDiv.classList.add('show');
        return;
    }
    
    const resumeFile = document.getElementById('resume').files[0];
    const isDoc = resumeFile && (
        resumeFile.type.includes('pdf') ||
        resumeFile.name.toLowerCase().endsWith('.pdf') ||
        resumeFile.type.includes('text') ||
        resumeFile.name.toLowerCase().endsWith('.txt')
    );
    if (!resumeFile || !isDoc) {
        errorDiv.textContent = 'Please upload a valid PDF or text resume';
        errorDiv.classList.add('show');
        return;
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('jobId', document.getElementById('job_id').value);
    formData.append('name', document.getElementById('name').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('resume', resumeFile);
    
    // Add certificates
    const certFiles = document.getElementById('certificates').files;
    for (let i = 0; i < certFiles.length; i++) {
        formData.append('certificates', certFiles[i]);
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    errorDiv.classList.remove('show');
    
    // Hide form and show analysis container
    document.getElementById('applicationForm').style.display = 'none';
    document.getElementById('analysisContainer').classList.add('active');
    document.getElementById('analyzingLoader').style.display = 'block';
    
    try {
        const response = await fetch('/api/applications/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Wait a bit for effect
            setTimeout(() => {
                displayAnalysis(data.analysis, certFiles.length);
            }, 2000);
        } else {
            throw new Error(data.message || 'Error submitting application');
        }
    } catch (error) {
        document.getElementById('analysisContainer').classList.remove('active');
        document.getElementById('applicationForm').style.display = 'block';
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});

// Display analysis results with animation
function displayAnalysis(analysis, certCount) {
    // Hide loader
    document.getElementById('analyzingLoader').style.display = 'none';
    
    // Show results
    const resultsDiv = document.getElementById('analysisResults');
    resultsDiv.classList.add('active');
    
    // Animate final score
    animateScore('finalScore', analysis.scores.final * 100);
    
    // Set eligibility
    const eligibilityBadge = document.getElementById('eligibilityBadge');
    eligibilityBadge.textContent = analysis.eligibility;
    if (analysis.eligibility.includes('Rejected')) {
        eligibilityBadge.classList.add('rejected');
        eligibilityBadge.classList.remove('eligible');
    } else {
        eligibilityBadge.classList.add('eligible');
        eligibilityBadge.classList.remove('rejected');
    }
    
    // Animate score bars
    setTimeout(() => {
        animateBar('semantic', analysis.scores.semantic * 100);
    }, 300);
    
    setTimeout(() => {
        animateBar('skill', analysis.scores.skill * 100);
    }, 600);
    
    setTimeout(() => {
        animateBar('experience', analysis.scores.experience * 100);
    }, 900);
    
    // Show certification if available
    if (analysis.scores.certification && analysis.scores.certification > 0) {
        document.getElementById('certificationBarItem').style.display = 'block';
        setTimeout(() => {
            animateBar('certification', analysis.scores.certification * 100);
        }, 1200);
        
        // Show certificate info
        if (certCount > 0) {
            document.getElementById('certificateInfo').style.display = 'block';
            document.getElementById('totalCerts').textContent = analysis.certifications.total_uploaded;
            document.getElementById('relevantCerts').textContent = analysis.certifications.relevant;
        }
    }
    
    // Display matched skills
    const matchedSkillsDiv = document.getElementById('matchedSkills');
    if (analysis.skills.matched && analysis.skills.matched.length > 0) {
        matchedSkillsDiv.innerHTML = analysis.skills.matched
            .filter(skill => skill && skill.trim()) // Filter out empty skills
            .map(skill => `<div class="skill-item matched">✓ ${skill}</div>`)
            .join('');
    } else {
        matchedSkillsDiv.innerHTML = '<p>No matched skills found</p>';
    }
    
    // Display missing skills
    const missingSkillsDiv = document.getElementById('missingSkills');
    if (analysis.skills.missing && analysis.skills.missing.length > 0) {
        missingSkillsDiv.innerHTML = analysis.skills.missing
            .filter(skill => skill && skill.trim()) // Filter out empty skills
            .map(skill => `<div class="skill-item missing">✗ ${skill}</div>`)
            .join('');
    } else {
        missingSkillsDiv.innerHTML = '<p>All required skills matched!</p>';
    }
}

// Animate score number
function animateScore(elementId, targetValue) {
    const element = document.getElementById(elementId);
    let current = 0;
    const increment = targetValue / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(timer);
        }
        element.textContent = Math.round(current) + '%';
    }, 20);
}

// Animate bar chart
function animateBar(type, percentage) {
    const bar = document.getElementById(type + 'Bar');
    const scoreLabel = document.getElementById(type + 'Score');
    
    bar.style.width = percentage + '%';
    bar.textContent = Math.round(percentage) + '%';
    scoreLabel.textContent = Math.round(percentage) + '%';
}

// Load job details on page load
loadJobDetails();
