// Mediqux - Frontend JavaScript
// Configuration (now loaded from config.js)
const CONFIG = {
    get API_BASE() { return window.getApiBaseUrl(); },
    get RETRY_ATTEMPTS() { return window.ENV_CONFIG.RETRY_ATTEMPTS; },
    get RETRY_DELAY() { return window.ENV_CONFIG.RETRY_DELAY; }
};

// Enhanced API call function with authentication and retry logic
async function apiCall(endpoint, options = {}, retryCount = 0) {
    try {
        // Use auth manager if available, otherwise direct API call
        if (window.authManager) {
            const response = await window.authManager.apiRequest(endpoint, options);
            if (!response) {
                throw new Error('Authentication failed');
            }
            return await response.json();
        } else {
            // Fallback for non-authenticated calls
            const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        }
    } catch (error) {
        console.error(`API call failed (attempt ${retryCount + 1}):`, error);
        
        // Retry logic for network errors
        if (retryCount < CONFIG.RETRY_ATTEMPTS && error.name === 'TypeError') {
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return apiCall(endpoint, options, retryCount + 1);
        }
        
        showAlert(`API call failed: ${error.message}`, 'danger');
        throw error;
    }
}

// Enhanced alert system with fixed positioning
function showAlert(message, type = 'info', autoClose = true) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert-fixed');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-fixed`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 1050;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: none;
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Add to body instead of container
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds if enabled
    if (autoClose) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const bsAlert = new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, 5000);
    }
}

// Enhanced system health check with detailed info
async function checkSystemHealth() {
    const statusDiv = document.getElementById('systemStatus');
    
    try {
        const health = await apiCall('/health');
        statusDiv.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center">
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <div>
                        <span class="fw-medium">System Online</span>
                        <br>
                        <small class="text-muted">Node.js ${health.nodeVersion} • Uptime: ${Math.floor(health.uptime / 60)}m</small>
                    </div>
                </div>
                <small class="text-muted">${new Date(health.timestamp).toLocaleString()}</small>
            </div>
        `;
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="bi bi-x-circle-fill text-danger me-2"></i>
                <div>
                    <span class="fw-medium">System Offline</span>
                    <br>
                    <small class="text-muted">Unable to connect to backend</small>
                </div>
            </div>
        `;
    }
}

// Load dashboard stats with loading states
async function loadDashboardStats() {
    const stats = ['totalPatients', 'totalDoctors', 'totalInstitutions', 'totalAppointments'];
    
    // Show loading state
    stats.forEach(stat => {
        const element = document.getElementById(stat);
        if (element) {
            element.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
    });
    
    try {
        // Load actual counts from APIs
        const [patientsResponse, doctorsResponse, institutionsResponse, appointmentsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/doctors'),
            apiCall('/institutions'),
            apiCall('/appointments/stats/summary')
        ]);
        
        // Update patient count
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            document.getElementById('totalPatients').textContent = patientsResponse.value.count || 0;
        } else {
            document.getElementById('totalPatients').textContent = '0';
        }
        
        // Update doctor count
        if (doctorsResponse.status === 'fulfilled' && doctorsResponse.value.success) {
            document.getElementById('totalDoctors').textContent = doctorsResponse.value.count || 0;
        } else {
            document.getElementById('totalDoctors').textContent = '0';
        }
        
        // Update institution count
        if (institutionsResponse.status === 'fulfilled' && institutionsResponse.value.success) {
            document.getElementById('totalInstitutions').textContent = institutionsResponse.value.count || 0;
        } else {
            document.getElementById('totalInstitutions').textContent = '0';
        }
        
        // Update appointment count
        if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value.success) {
            document.getElementById('totalAppointments').textContent = appointmentsResponse.value.data.total_appointments || 0;
        } else {
            document.getElementById('totalAppointments').textContent = '0';
        }
        
    } catch (error) {
        stats.forEach(stat => {
            const element = document.getElementById(stat);
            if (element) {
                element.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i>';
            }
        });
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the dashboard page
    if (document.getElementById('systemStatus')) {
        checkSystemHealth();
        loadDashboardStats();
        
        // Auto-refresh system status using configurable interval
        setInterval(checkSystemHealth, window.ENV_CONFIG.HEALTH_CHECK_INTERVAL);
    }
    
    console.log('Mediqux initialized');
});