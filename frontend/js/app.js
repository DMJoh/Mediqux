const CONFIG = {
    get API_BASE() { return window.getApiBaseUrl(); },
    get RETRY_ATTEMPTS() { return window.ENV_CONFIG.RETRY_ATTEMPTS; },
    get RETRY_DELAY() { return window.ENV_CONFIG.RETRY_DELAY; }
};

async function apiCall(endpoint, options = {}, retryCount = 0) {
    try {
        if (window.authManager) {
            const response = await window.authManager.apiRequest(endpoint, options);
            if (!response) {
                return { success: false, error: 'Authentication required' };
            }
            return await response.json();
        } else {
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
        
        if (retryCount < CONFIG.RETRY_ATTEMPTS && error.name === 'TypeError') {
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return apiCall(endpoint, options, retryCount + 1);
        }
        
        showAlert(`API call failed: ${error.message}`, 'danger');
        throw error;
    }
}

function showAlert(message, type = 'info', autoClose = true) {
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
    
    document.body.appendChild(alertDiv);
    
    if (autoClose) {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                const bsAlert = new bootstrap.Alert(alertDiv);
                bsAlert.close();
            }
        }, 5000);
    }
}

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

async function loadDashboardStats() {
    const stats = ['totalPatients', 'totalDoctors', 'totalInstitutions', 'totalAppointments'];
    
    stats.forEach(stat => {
        const element = document.getElementById(stat);
        if (element) {
            element.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }
    });
    
    try {
        const [patientsResponse, doctorsResponse, institutionsResponse, appointmentsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/doctors'),
            apiCall('/institutions'),
            apiCall('/appointments/stats/summary')
        ]);
        
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            document.getElementById('totalPatients').textContent = patientsResponse.value.count || 0;
        } else {
            document.getElementById('totalPatients').textContent = '0';
        }
        
        if (doctorsResponse.status === 'fulfilled' && doctorsResponse.value.success) {
            document.getElementById('totalDoctors').textContent = doctorsResponse.value.count || 0;
        } else {
            document.getElementById('totalDoctors').textContent = '0';
        }
        
        if (institutionsResponse.status === 'fulfilled' && institutionsResponse.value.success) {
            document.getElementById('totalInstitutions').textContent = institutionsResponse.value.count || 0;
        } else {
            document.getElementById('totalInstitutions').textContent = '0';
        }
        
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

async function loadUpcomingAppointments() {
    const appointmentsDiv = document.getElementById('upcomingAppointments');
    
    try {
        const response = await apiCall('/appointments/dashboard/upcoming');
        
        if (response && response.success && response.data && response.data.length > 0) {
            const appointments = response.data;
            
            const appointmentsHtml = appointments.map((appointment, index) => {
                const appointmentDate = new Date(appointment.appointment_date);
                const today = new Date();
                const isToday = appointmentDate.toDateString() === today.toDateString();
                const timeStr = appointmentDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const dateStr = isToday ? 'Today' : appointmentDate.toLocaleDateString();
                
                return `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="border rounded p-3 h-100 ${isToday ? 'border-warning border-2' : ''}">
                            <div class="d-flex flex-column h-100">
                                <div class="flex-grow-1">
                                    <div class="fw-medium text-primary mb-1">
                                        <i class="bi bi-person-circle me-1"></i>
                                        ${appointment.patient_first_name} ${appointment.patient_last_name}
                                    </div>
                                    <div class="small text-muted mb-2">
                                        <i class="bi bi-person-badge me-1"></i>
                                        Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}
                                    </div>
                                    ${appointment.type ? `<div class="small text-muted mb-2">
                                        <i class="bi bi-clipboard-pulse me-1"></i>${appointment.type}
                                    </div>` : ''}
                                </div>
                                <div class="mt-auto">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="small fw-medium ${isToday ? 'text-warning' : 'text-muted'}">
                                            <i class="bi bi-calendar3 me-1"></i>${dateStr}
                                        </span>
                                        <span class="small text-muted">
                                            <i class="bi bi-clock me-1"></i>${timeStr}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            appointmentsDiv.innerHTML = `
                <div class="row g-3">
                    ${appointmentsHtml}
                </div>
            `;
        } else if (response && response.success) {
            appointmentsDiv.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <i class="bi bi-calendar-x fs-4"></i>
                    <div class="mt-2">No upcoming appointments</div>
                    <small>Schedule new appointments to see them here</small>
                </div>
            `;
        } else {
            console.error('API returned error:', response);
            appointmentsDiv.innerHTML = `
                <div class="text-center py-3 text-warning">
                    <i class="bi bi-exclamation-triangle"></i>
                    <div class="mt-2">Unable to load appointments</div>
                    <small>${response?.error || 'Please try again later'}</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading upcoming appointments:', error);
        appointmentsDiv.innerHTML = `
            <div class="text-center py-3 text-danger">
                <i class="bi bi-exclamation-triangle"></i>
                <div class="mt-2">Failed to load appointments</div>
                <small>Please refresh the page or try again later</small>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('systemStatus')) {
        checkSystemHealth();
        loadDashboardStats();
        
        setTimeout(() => {
            loadUpcomingAppointments();
        }, 1000);
        
        setInterval(checkSystemHealth, window.ENV_CONFIG.HEALTH_CHECK_INTERVAL);
        
        setInterval(loadUpcomingAppointments, 5 * 60 * 1000);
    }
    
});