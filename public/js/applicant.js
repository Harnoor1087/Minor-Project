// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'applicant') {
    window.location.href = '/login';
}

// Display user name
document.getElementById('userName').textContent = `Welcome, ${user.name}`;

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Tab switching
function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    buttons.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'browse') {
        loadJobs();
    } else if (tabName === 'myapps') {
        loadMyApplications();
    }
}

// Load jobs
async function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = '<div class="loading">Loading jobs...</div>';
    
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        
        console.log('Jobs data:', data); // Debug log
        
        if (data.jobs && data.jobs.length > 0) {
            jobsList.innerHTML = data.jobs.map(job => {
                // Ensure we have valid data
                const title = job.title || 'Untitled Job';
                const description = job.description || 'No description available';
                const mandatorySkills = Array.isArray(job.mandatory_skills) ? job.mandatory_skills : [];
                const optionalSkills = Array.isArray(job.optional_skills) ? job.optional_skills : [];
                
                // Escape title for HTML attribute
                const escapedTitle = String(title).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                
                return `
                <div class="job-card">
                    <h3>${title}</h3>
                    <p><strong>Job ID:</strong> <span class="highlight-text">${job.id}</span></p>
                    <p>${description}</p>
                    <div class="job-skills">
                        <strong>Required Skills:</strong>
                        ${mandatorySkills.map(skill => 
                            `<span class="skill-tag mandatory">${skill.trim()}</span>`
                        ).join('') || '<span>None specified</span>'}
                    </div>
                    <div class="job-skills">
                        <strong>Preferred Skills:</strong>
                        ${optionalSkills.map(skill => 
                            `<span class="skill-tag">${skill.trim()}</span>`
                        ).join('') || '<span>None specified</span>'}
                    </div>
                    ${job.certification_enabled ? '<p>✅ Certifications are valued for this position</p>' : ''}
                    <div class="job-actions">
                        <button class="btn-primary" onclick="window.location.href='/apply.html?jobId=${job.id}'">Apply Now</button>
                    </div>
                </div>
            `;
            }).join('');
        } else {
            jobsList.innerHTML = '<p>No jobs available at the moment.</p>';
        }
    } catch (error) {
        console.error('Error loading jobs:', error);
        jobsList.innerHTML = '<p class="error-message show">Error loading jobs</p>';
    }
}

// Load my applications
async function loadMyApplications() {
    const appsList = document.getElementById('myApplicationsList');
    appsList.innerHTML = '<div class="loading">Loading your applications...</div>';
    
    try {
        const response = await fetch('/api/applications/my-applications', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const applications = await response.json();
        
        if (applications.length > 0) {
            appsList.innerHTML = applications.map(app => `
                <div class="application-card">
                    <div class="application-header">
                        <div>
                            <h3>${app.jobTitle}</h3>
                            <p><strong>Job ID:</strong> ${app.jobId}</p>
                        </div>
                        <span class="status-badge status-${app.status}">${app.status.toUpperCase()}</span>
                    </div>
                    <p><strong>Applied:</strong> ${new Date(app.appliedAt).toLocaleDateString()}</p>
                    
                    ${app.scores ? `
                        <div class="score-grid">
                            <div class="score-item">
                                <div class="score-value">${(app.scores.final * 100).toFixed(0)}%</div>
                                <div class="score-label">Final Score</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.semantic * 100).toFixed(0)}%</div>
                                <div class="score-label">Semantic Match</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.skill * 100).toFixed(0)}%</div>
                                <div class="score-label">Skills Match</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.experience * 100).toFixed(0)}%</div>
                                <div class="score-label">Experience</div>
                            </div>
                            ${app.scores.certification ? `
                                <div class="score-item">
                                    <div class="score-value">${(app.scores.certification * 100).toFixed(0)}%</div>
                                    <div class="score-label">Certification</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <p><strong>Category:</strong> ${app.category || 'N/A'}</p>
                    <p><strong>Eligibility:</strong> ${app.eligibility || 'N/A'}</p>
                    
                    <div class="job-actions">
                        <button class="btn-primary" onclick="viewDetails('${app._id}')">View Details</button>
                    </div>
                </div>
            `).join('');
        } else {
            appsList.innerHTML = '<p>You haven\'t applied to any jobs yet. Browse jobs and apply!</p>';
        }
    } catch (error) {
        appsList.innerHTML = '<p class="error-message show">Error loading applications</p>';
    }
}

// Open apply modal
function openApplyModal(jobId, jobTitle) {
    // Redirect to dedicated apply page
    window.location.href = `/apply.html?jobId=${jobId}`;
}

function closeApplyModal() {
    document.getElementById('applyModal').classList.remove('active');
}

// Apply form submission
const applyForm = document.getElementById('applyForm');
applyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const errorDiv = document.getElementById('applyError');
    const successDiv = document.getElementById('applySuccess');
    
    // Check if job ID is confirmed
    if (!document.getElementById('confirmJobId').checked) {
        errorDiv.textContent = 'Please confirm that you have noted the Job ID';
        errorDiv.classList.add('show');
        return;
    }
    
    // Validate files
    const resumeFile = document.getElementById('resume').files[0];
    if (!resumeFile) {
        errorDiv.textContent = 'Please upload your resume';
        errorDiv.classList.add('show');
        return;
    }
    
    const isDoc = resumeFile.type.includes('pdf') ||
        resumeFile.name.toLowerCase().endsWith('.pdf') ||
        resumeFile.type.includes('text') ||
        resumeFile.name.toLowerCase().endsWith('.txt');

    if (!isDoc) {
        errorDiv.textContent = 'Resume must be a PDF or text file';
        errorDiv.classList.add('show');
        return;
    }
    
    // Prepare form data
    const formData = new FormData();
    formData.append('jobId', document.getElementById('apply_job_id').value);
    formData.append('name', document.getElementById('apply_name').value);
    formData.append('email', document.getElementById('apply_email').value);
    formData.append('resume', resumeFile);
    
    // Add certificates if any
    const certFiles = document.getElementById('certificates').files;
    for (let i = 0; i < certFiles.length; i++) {
        formData.append('certificates', certFiles[i]);
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');
    
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
            successDiv.innerHTML = `
                <strong>Application submitted successfully!</strong><br>
                Job ID: ${data.application.jobId}<br>
                Final Score: ${(data.analysis.scores.final * 100).toFixed(0)}%<br>
                Status: ${data.application.eligibility}
            `;
            successDiv.classList.add('show');
            
            // Reset form after 3 seconds and close modal
            setTimeout(() => {
                closeApplyModal();
                showTab('myapps');
            }, 3000);
        } else {
            errorDiv.textContent = data.message || 'Error submitting application';
            errorDiv.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Application';
        }
    } catch (error) {
        errorDiv.textContent = 'Error submitting application. Please try again.';
        errorDiv.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    }
});

// View application details
function viewDetails(appId) {
    // This would show detailed analysis
    alert('Detailed view coming soon! Application ID: ' + appId);
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Initial load
loadJobs();
