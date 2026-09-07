// Check authentication
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
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
    
    if (tabName === 'jobs') {
        loadJobs();
    } else if (tabName === 'applications') {
        loadApplications();
    }
}

// Load jobs
async function loadJobs() {
    const jobsList = document.getElementById('jobsList');
    jobsList.innerHTML = '<div class="loading">Loading jobs...</div>';
    
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        
        if (data.jobs && data.jobs.length > 0) {
            jobsList.innerHTML = data.jobs.map(job => `
                <div class="job-card">
                    <h3>${job.title}</h3>
                    <p>${job.description}</p>
                    <div class="job-skills">
                        <strong>Mandatory Skills:</strong>
                        ${job.mandatory_skills.map(skill => 
                            `<span class="skill-tag mandatory">${skill}</span>`
                        ).join('')}
                    </div>
                    <div class="job-skills">
                        <strong>Optional Skills:</strong>
                        ${job.optional_skills.map(skill => 
                            `<span class="skill-tag">${skill}</span>`
                        ).join('')}
                    </div>
                    <p><strong>Certification Enabled:</strong> ${job.certification_enabled ? 'Yes' : 'No'}</p>
                    ${job.certification_enabled ? `<p><strong>Certification Weight:</strong> ${job.certification_weight}</p>` : ''}
                    <div class="job-actions">
                        <button class="btn-primary" onclick="editJob(${job.id})">Edit</button>
                        <button class="btn-danger" onclick="deleteJob(${job.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } else {
            jobsList.innerHTML = '<p>No jobs found. Create your first job!</p>';
        }
    } catch (error) {
        jobsList.innerHTML = '<p class="error-message show">Error loading jobs</p>';
    }
}

// Load applications
async function loadApplications() {
    const appsList = document.getElementById('applicationsList');
    appsList.innerHTML = '<div class="loading">Loading applications...</div>';
    
    try {
        const response = await fetch('/api/applications/all', {
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
                            <h3>${app.applicantName}</h3>
                            <p>${app.applicantEmail}</p>
                        </div>
                        <span class="status-badge status-${app.status}">${app.status.toUpperCase()}</span>
                    </div>
                    <p><strong>Job:</strong> ${app.jobTitle} (ID: ${app.jobId})</p>
                    <p><strong>Applied:</strong> ${new Date(app.appliedAt).toLocaleDateString()}</p>
                    
                    ${app.scores ? `
                        <div class="score-grid">
                            <div class="score-item">
                                <div class="score-value">${(app.scores.final * 100).toFixed(0)}%</div>
                                <div class="score-label">Final Score</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.semantic * 100).toFixed(0)}%</div>
                                <div class="score-label">Semantic</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.skill * 100).toFixed(0)}%</div>
                                <div class="score-label">Skills</div>
                            </div>
                            <div class="score-item">
                                <div class="score-value">${(app.scores.experience * 100).toFixed(0)}%</div>
                                <div class="score-label">Experience</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <p><strong>Category:</strong> ${app.category || 'N/A'}</p>
                    <p><strong>Eligibility:</strong> ${app.eligibility || 'N/A'}</p>
                    
                    <div class="job-actions">
                        <select onchange="updateStatus('${app._id}', this.value)">
                            <option value="">Change Status</option>
                            <option value="pending" ${app.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="reviewed" ${app.status === 'reviewed' ? 'selected' : ''}>Reviewed</option>
                            <option value="accepted" ${app.status === 'accepted' ? 'selected' : ''}>Accepted</option>
                            <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </div>
                </div>
            `).join('');
        } else {
            appsList.innerHTML = '<p>No applications yet.</p>';
        }
    } catch (error) {
        appsList.innerHTML = '<p class="error-message show">Error loading applications</p>';
    }
}

// Update application status
async function updateStatus(appId, status) {
    if (!status) return;
    
    try {
        const response = await fetch(`/api/applications/${appId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert('Status updated successfully');
            loadApplications();
        }
    } catch (error) {
        alert('Error updating status');
    }
}

// Create job form
const createJobForm = document.getElementById('createJobForm');
const certEnabledCheckbox = document.getElementById('certification_enabled');
const certWeightGroup = document.getElementById('certWeightGroup');

certEnabledCheckbox.addEventListener('change', (e) => {
    certWeightGroup.style.display = e.target.checked ? 'block' : 'none';
});

createJobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        mandatory_skills: document.getElementById('mandatory_skills').value.split(',').map(s => s.trim()),
        optional_skills: document.getElementById('optional_skills').value.split(',').map(s => s.trim()).filter(s => s),
        certification_enabled: document.getElementById('certification_enabled').checked,
        certification_weight: parseFloat(document.getElementById('certification_weight').value) || 0.2
    };
    
    const errorDiv = document.getElementById('createJobError');
    
    try {
        const response = await fetch('/api/jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Job created successfully!');
            createJobForm.reset();
            certWeightGroup.style.display = 'none';
            showTab('jobs');
        } else {
            errorDiv.textContent = data.message;
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Error creating job';
        errorDiv.classList.add('show');
    }
});

// Edit job
async function editJob(jobId) {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        
        document.getElementById('edit_job_id').value = job.job_id;
        document.getElementById('edit_title').value = job.title;
        document.getElementById('edit_description').value = job.description;
        document.getElementById('edit_mandatory_skills').value = job.mandatory_skills.join(', ');
        document.getElementById('edit_optional_skills').value = job.optional_skills.join(', ');
        document.getElementById('edit_certification_enabled').checked = job.certification_enabled;
        document.getElementById('edit_certification_weight').value = job.certification_weight;
        
        document.getElementById('editModal').classList.add('active');
    } catch (error) {
        alert('Error loading job details');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

// Edit job form
const editJobForm = document.getElementById('editJobForm');
editJobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const jobId = document.getElementById('edit_job_id').value;
    const formData = {
        title: document.getElementById('edit_title').value,
        description: document.getElementById('edit_description').value,
        mandatory_skills: document.getElementById('edit_mandatory_skills').value.split(',').map(s => s.trim()),
        optional_skills: document.getElementById('edit_optional_skills').value.split(',').map(s => s.trim()).filter(s => s),
        certification_enabled: document.getElementById('edit_certification_enabled').checked,
        certification_weight: parseFloat(document.getElementById('edit_certification_weight').value) || 0.2
    };
    
    const errorDiv = document.getElementById('editJobError');
    
    try {
        const response = await fetch(`/api/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Job updated successfully!');
            closeEditModal();
            loadJobs();
        } else {
            errorDiv.textContent = data.message;
            errorDiv.classList.add('show');
        }
    } catch (error) {
        errorDiv.textContent = 'Error updating job';
        errorDiv.classList.add('show');
    }
});

// Delete job
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) return;
    
    try {
        const response = await fetch(`/api/jobs/${jobId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            alert('Job deleted successfully');
            loadJobs();
        }
    } catch (error) {
        alert('Error deleting job');
    }
}

// Initial load
loadJobs();
