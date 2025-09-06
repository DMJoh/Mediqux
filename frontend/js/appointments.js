// Appointment management JavaScript

let allAppointments = [];
let filteredAppointments = [];
let patients = [];
let doctors = [];
let institutions = [];
let currentEditingId = null;

// Make functions globally available
window.saveAppointment = saveAppointment;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.viewAppointment = viewAppointment;
window.openAddAppointmentModal = openAddAppointmentModal;
window.clearFilters = clearFilters;

// Initialize appointments page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('appointmentsTableBody')) {
        loadAppointments();
        loadDropdownData();
        loadAppointmentStats();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterAppointments);
    document.getElementById('statusFilter').addEventListener('change', filterAppointments);
    document.getElementById('patientFilter').addEventListener('change', filterAppointments);
    document.getElementById('doctorFilter').addEventListener('change', filterAppointments);
    
    // Show/hide diagnosis field based on status
    document.getElementById('status').addEventListener('change', function() {
        const diagnosisSection = document.getElementById('diagnosisSection');
        if (this.value === 'completed') {
            diagnosisSection.style.display = 'block';
        } else {
            diagnosisSection.style.display = 'none';
        }
    });
}

// Show field-specific error
function showFieldError(input, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    
    const errorDiv = input.parentNode.querySelector('.invalid-feedback');
    if (errorDiv) {
        errorDiv.textContent = message;
    }
}

// Clear field-specific error
function clearFieldError(input) {
    input.classList.remove('is-invalid');
    if (input.value.trim()) {
        input.classList.add('is-valid');
    } else {
        input.classList.remove('is-valid');
    }
}

// Load all appointments
async function loadAppointments() {
    try {
        showLoading(true);
        const response = await apiCall('/appointments');
        
        if (response.success) {
            allAppointments = response.data;
            filteredAppointments = [...allAppointments];
            displayAppointments();
            updateAppointmentCount();
        } else {
            console.error('Failed to load appointments:', response.error);
            showAlert('Failed to load appointments: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
        showAlert('Error loading appointments: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allAppointments = [];
        filteredAppointments = [];
        displayAppointments();
        updateAppointmentCount();
    } finally {
        showLoading(false);
    }
}

// Load dropdown data (patients, doctors, institutions)
async function loadDropdownData() {
    try {
        const [patientsResponse, doctorsResponse, institutionsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/doctors'),
            apiCall('/institutions')
        ]);
        
        
        // Load patients
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            patients = patientsResponse.value.data;
            populatePatientDropdowns();
        } else {
            console.error('Failed to load patients for dropdown');
            patients = [];
            populatePatientDropdowns();
        }
        
        // Load doctors
        if (doctorsResponse.status === 'fulfilled' && doctorsResponse.value.success) {
            doctors = doctorsResponse.value.data;
            populateDoctorDropdowns();
        } else {
            console.error('Failed to load doctors for dropdown');
            doctors = [];
            populateDoctorDropdowns();
        }
        
        // Load institutions
        if (institutionsResponse.status === 'fulfilled' && institutionsResponse.value.success) {
            institutions = institutionsResponse.value.data;
            populateInstitutionDropdowns();
        } else {
            console.error('Failed to load institutions for dropdown');
            institutions = [];
            populateInstitutionDropdowns();
        }
    } catch (error) {
        console.error('Error loading dropdown data:', error);
        // Initialize empty dropdowns to prevent errors
        patients = [];
        doctors = [];
        institutions = [];
        populatePatientDropdowns();
        populateDoctorDropdowns();
        populateInstitutionDropdowns();
    }
}

// Load appointment statistics
async function loadAppointmentStats() {
    try {
        const response = await apiCall('/appointments/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalAppointmentsCount').textContent = stats.total_appointments || 0;
            document.getElementById('upcomingCount').textContent = stats.upcoming || 0;
            document.getElementById('completedCount').textContent = stats.completed || 0;
            document.getElementById('todayCount').textContent = stats.today || 0;
        }
    } catch (error) {
        console.error('Error loading appointment stats:', error);
        // Set defaults
        document.getElementById('totalAppointmentsCount').textContent = '0';
        document.getElementById('upcomingCount').textContent = '0';
        document.getElementById('completedCount').textContent = '0';
        document.getElementById('todayCount').textContent = '0';
    }
}

// Populate patient dropdowns
function populatePatientDropdowns() {
    const modalSelect = document.getElementById('patientId');
    const filterSelect = document.getElementById('patientFilter');
    
    if (!modalSelect || !filterSelect) {
        console.error('Patient dropdown elements not found');
        return;
    }
    
    const options = patients.map(patient => 
        `<option value="${patient.id}">${patient.first_name} ${patient.last_name}</option>`
    ).join('');
    
    modalSelect.innerHTML = '<option value="">Select Patient</option>' + options;
    filterSelect.innerHTML = '<option value="">All Patients</option>' + options;
    
}

// Populate doctor dropdowns
function populateDoctorDropdowns() {
    const modalSelect = document.getElementById('doctorId');
    const filterSelect = document.getElementById('doctorFilter');
    
    if (!modalSelect || !filterSelect) {
        console.error('Doctor dropdown elements not found');
        return;
    }
    
    const options = doctors.map(doctor => 
        `<option value="${doctor.id}">Dr. ${doctor.first_name} ${doctor.last_name}${doctor.specialty ? ` - ${doctor.specialty}` : ''}</option>`
    ).join('');
    
    modalSelect.innerHTML = '<option value="">Select Doctor (Optional)</option>' + options;
    filterSelect.innerHTML = '<option value="">All Doctors</option>' + options;
    
}

// Populate institution dropdowns
function populateInstitutionDropdowns() {
    const modalSelect = document.getElementById('institutionId');
    
    if (!modalSelect) {
        console.error('Institution dropdown element not found');
        return;
    }
    
    const options = institutions.map(institution => 
        `<option value="${institution.id}">${institution.name}${institution.type ? ` (${institution.type})` : ''}</option>`
    ).join('');
    
    modalSelect.innerHTML = '<option value="">Select Institution (Optional)</option>' + options;
    
}

// Display appointments in table
function displayAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    const tableDiv = document.getElementById('appointmentsTable');
    const noAppointments = document.getElementById('noAppointments');
    
    if (filteredAppointments.length === 0) {
        tableDiv.style.display = 'none';
        noAppointments.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noAppointments.style.display = 'none';
    
    tbody.innerHTML = filteredAppointments.map(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const now = new Date();
        const isPast = appointmentDate < now;
        
        // Status badge styling
        let statusBadge = '';
        switch (appointment.status) {
            case 'scheduled':
                statusBadge = `<span class="badge bg-${isPast ? 'warning' : 'success'}">${isPast ? 'Overdue' : 'Scheduled'}</span>`;
                break;
            case 'completed':
                statusBadge = '<span class="badge bg-info">Completed</span>';
                break;
            case 'cancelled':
                statusBadge = '<span class="badge bg-danger">Cancelled</span>';
                break;
            default:
                statusBadge = `<span class="badge bg-secondary">${appointment.status || 'Unknown'}</span>`;
        }
        
        return `
            <tr class="${isPast && appointment.status === 'scheduled' ? 'table-warning' : ''}">
                <td>
                    <strong>${appointmentDate.toLocaleDateString()}</strong><br>
                    <small class="text-muted">${appointmentDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </td>
                <td>
                    <strong>${appointment.patient_first_name || 'Unknown'} ${appointment.patient_last_name || 'Patient'}</strong>
                    ${appointment.patient_phone ? `<br><small class="text-muted"><i class="bi bi-telephone"></i> ${appointment.patient_phone}</small>` : ''}
                </td>
                <td>
                    ${appointment.doctor_first_name ? 
                        `<strong>Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}</strong>
                         ${appointment.doctor_specialty ? `<br><small class="text-muted">${appointment.doctor_specialty}</small>` : ''}` : 
                        '<small class="text-muted">No doctor assigned</small>'
                    }
                </td>
                <td>
                    ${appointment.institution_name ? 
                        `<strong>${appointment.institution_name}</strong>
                         ${appointment.institution_type ? `<br><small class="text-muted">${appointment.institution_type}</small>` : ''}` : 
                        '<small class="text-muted">No institution</small>'
                    }
                </td>
                <td>
                    <span class="badge bg-secondary">${appointment.type || 'General'}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editAppointment('${appointment.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewAppointment('${appointment.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteAppointment('${appointment.id}', '${appointmentDate.toLocaleDateString()}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter appointments based on search and filters
function filterAppointments() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const patientFilter = document.getElementById('patientFilter').value;
    const doctorFilter = document.getElementById('doctorFilter').value;
    
    filteredAppointments = allAppointments.filter(appointment => {
        const matchesSearch = !searchTerm || 
            (appointment.patient_first_name && appointment.patient_first_name.toLowerCase().includes(searchTerm)) ||
            (appointment.patient_last_name && appointment.patient_last_name.toLowerCase().includes(searchTerm)) ||
            (appointment.doctor_first_name && appointment.doctor_first_name.toLowerCase().includes(searchTerm)) ||
            (appointment.doctor_last_name && appointment.doctor_last_name.toLowerCase().includes(searchTerm)) ||
            (appointment.institution_name && appointment.institution_name.toLowerCase().includes(searchTerm)) ||
            (appointment.type && appointment.type.toLowerCase().includes(searchTerm)) ||
            (appointment.notes && appointment.notes.toLowerCase().includes(searchTerm));
        
        const matchesStatus = !statusFilter || appointment.status === statusFilter;
        const matchesPatient = !patientFilter || appointment.patient_id === patientFilter;
        const matchesDoctor = !doctorFilter || appointment.doctor_id === doctorFilter;
        
        return matchesSearch && matchesStatus && matchesPatient && matchesDoctor;
    });
    
    displayAppointments();
    updateAppointmentCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('patientFilter').value = '';
    document.getElementById('doctorFilter').value = '';
    filteredAppointments = [...allAppointments];
    displayAppointments();
    updateAppointmentCount();
}

// Update appointment count badge
function updateAppointmentCount() {
    document.getElementById('appointmentCount').textContent = filteredAppointments.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new appointment
function openAddAppointmentModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-calendar-plus"></i> Schedule Appointment';
    document.getElementById('saveAppointmentBtn').innerHTML = '<i class="bi bi-save"></i> Save Appointment';
    document.getElementById('appointmentForm').reset();
    document.getElementById('appointmentId').value = '';
    document.getElementById('status').value = 'scheduled';
    document.getElementById('diagnosisSection').style.display = 'none';
    
    // Set minimum date to today
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('appointmentDateTime').min = localDateTime;
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('appointmentForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// Edit appointment
async function editAppointment(id) {
    try {
        const response = await apiCall(`/appointments/${id}`);
        
        if (response.success) {
            const appointment = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('appointmentId').value = appointment.id;
            document.getElementById('patientId').value = appointment.patient_id || '';
            document.getElementById('doctorId').value = appointment.doctor_id || '';
            document.getElementById('institutionId').value = appointment.institution_id || '';
            
            // Format datetime for input
            const appointmentDate = new Date(appointment.appointment_date);
            const localDateTime = new Date(appointmentDate.getTime() - appointmentDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('appointmentDateTime').value = localDateTime;
            
            document.getElementById('appointmentType').value = appointment.type || '';
            document.getElementById('status').value = appointment.status || 'scheduled';
            document.getElementById('notes').value = appointment.notes || '';
            document.getElementById('diagnosis').value = appointment.diagnosis || '';
            
            // Show diagnosis section if completed
            const diagnosisSection = document.getElementById('diagnosisSection');
            if (appointment.status === 'completed') {
                diagnosisSection.style.display = 'block';
            } else {
                diagnosisSection.style.display = 'none';
            }
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Appointment';
            document.getElementById('saveAppointmentBtn').innerHTML = '<i class="bi bi-save"></i> Update Appointment';
            
            // Clear validation states and show modal
            clearAllFieldErrors();
            new bootstrap.Modal(document.getElementById('appointmentModal')).show();
        }
    } catch (error) {
        showAlert('Error loading appointment details: ' + error.message, 'danger');
    }
}

// Save appointment (create or update)
async function saveAppointment() {
    const form = document.getElementById('appointmentForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const patientId = document.getElementById('patientId');
    const appointmentDateTime = document.getElementById('appointmentDateTime');
    
    if (!patientId.value) {
        showFieldError(patientId, 'Please select a patient');
        hasErrors = true;
    }
    
    if (!appointmentDateTime.value) {
        showFieldError(appointmentDateTime, 'Please select appointment date and time');
        hasErrors = true;
    }
    
    // Validate appointment time is not in the past (for new scheduled appointments)
    if (appointmentDateTime.value && !currentEditingId) {
        const selectedDate = new Date(appointmentDateTime.value);
        const now = new Date();
        
        if (selectedDate < now && document.getElementById('status').value === 'scheduled') {
            showFieldError(appointmentDateTime, 'Cannot schedule appointment in the past');
            hasErrors = true;
        }
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const appointmentData = {
        patient_id: patientId.value,
        doctor_id: document.getElementById('doctorId').value || null,
        institution_id: document.getElementById('institutionId').value || null,
        appointment_date: appointmentDateTime.value,
        type: document.getElementById('appointmentType').value || null,
        status: document.getElementById('status').value,
        notes: document.getElementById('notes').value.trim() || null,
        diagnosis: document.getElementById('diagnosis').value.trim() || null
    };
    
    
    try {
        const saveBtn = document.getElementById('saveAppointmentBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing appointment
            response = await apiCall(`/appointments/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(appointmentData)
            });
        } else {
            // Create new appointment
            response = await apiCall('/appointments', {
                method: 'POST',
                body: JSON.stringify(appointmentData)
            });
        }
        
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('appointmentModal')).hide();
            loadAppointments(); // Reload the appointment list
            loadAppointmentStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to save appointment', 'danger');
        }
    } catch (error) {
        console.error('Error saving appointment:', error);
        showAlert('Error saving appointment: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveAppointmentBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Appointment' : 
            '<i class="bi bi-save"></i> Save Appointment';
    }
}

// View appointment details
async function viewAppointment(id) {
    try {
        // Show the modal first
        const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'));
        modal.show();
        
        // Show loading state
        document.getElementById('appointmentDetailsLoading').style.display = 'block';
        document.getElementById('appointmentDetailsContent').style.display = 'none';
        
        const response = await apiCall(`/appointments/${id}`);
        
        if (response.success) {
            const appointment = response.data;
            displayAppointmentDetails(appointment);
            
            // Setup edit button in details modal
            document.getElementById('editFromDetailsBtn').onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal')).hide();
                setTimeout(() => editAppointment(id), 300); // Small delay for smooth transition
            };
            
            // Hide loading and show content
            document.getElementById('appointmentDetailsLoading').style.display = 'none';
            document.getElementById('appointmentDetailsContent').style.display = 'block';
        } else {
            showAlert('Failed to load appointment details: ' + (response.error || 'Unknown error'), 'danger');
            modal.hide();
        }
    } catch (error) {
        console.error('Error loading appointment details:', error);
        showAlert('Error loading appointment details: ' + error.message, 'danger');
        const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal'));
        if (modal) {
            modal.hide();
        }
    }
}

// Display appointment details in modal
function displayAppointmentDetails(appointment) {
    const content = document.getElementById('appointmentDetailsContent');
    const appointmentDate = new Date(appointment.appointment_date);
    const statusColor = getStatusBadgeColor(appointment.status);
    
    content.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="card border-0">
                    <div class="card-body">
                        <h4 class="card-title text-primary">
                            <i class="bi bi-calendar-event"></i> ${appointment.type || 'Appointment'}
                        </h4>
                        <p class="mb-2">
                            <span class="badge bg-${statusColor} fs-6">${appointment.status || 'Unknown'}</span>
                        </p>
                        
                        <div class="row mt-3">
                            <div class="col-sm-4 fw-semibold">Date & Time:</div>
                            <div class="col-sm-8">
                                <i class="bi bi-calendar3 text-primary me-1"></i>
                                ${appointmentDate.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                                <br>
                                <i class="bi bi-clock text-primary me-1"></i>
                                <small class="text-muted">${appointmentDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}</small>
                            </div>
                        </div>
                        
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Patient:</div>
                            <div class="col-sm-8">
                                <i class="bi bi-person-circle text-primary me-1"></i>
                                ${appointment.patient_first_name || 'Unknown'} ${appointment.patient_last_name || ''}
                            </div>
                        </div>
                        
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Doctor:</div>
                            <div class="col-sm-8">
                                <i class="bi bi-person-badge text-primary me-1"></i>
                                Dr. ${appointment.doctor_first_name || 'Unknown'} ${appointment.doctor_last_name || ''}
                                ${appointment.doctor_specialty ? `<small class="text-muted d-block">${appointment.doctor_specialty}</small>` : ''}
                            </div>
                        </div>
                        
                        ${appointment.institution_name ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Institution:</div>
                            <div class="col-sm-8">
                                <i class="bi bi-building text-primary me-1"></i>
                                ${appointment.institution_name}
                                ${appointment.institution_type ? `<small class="text-muted d-block">${appointment.institution_type}</small>` : ''}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${appointment.reason ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Reason:</div>
                            <div class="col-sm-8">${appointment.reason}</div>
                        </div>
                        ` : ''}
                        
                        ${appointment.notes ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Notes:</div>
                            <div class="col-sm-8">
                                <div class="text-muted" style="max-height: 100px; overflow-y: auto;">
                                    ${appointment.notes}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${appointment.created_at ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Created:</div>
                            <div class="col-sm-8">
                                <small class="text-muted">${formatDateTime(appointment.created_at)}</small>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0"><i class="bi bi-person-lines-fill"></i> Contact Information</h6>
                    </div>
                    <div class="card-body">
                        ${appointment.patient_phone ? `
                        <div class="mb-3">
                            <i class="bi bi-telephone text-primary"></i>
                            <strong class="ms-2">Patient Phone:</strong>
                            <div class="mt-1">
                                <a href="tel:${appointment.patient_phone}" class="text-decoration-none">
                                    ${appointment.patient_phone}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${appointment.patient_email ? `
                        <div class="mb-3">
                            <i class="bi bi-envelope text-primary"></i>
                            <strong class="ms-2">Patient Email:</strong>
                            <div class="mt-1">
                                <a href="mailto:${appointment.patient_email}" class="text-decoration-none">
                                    ${appointment.patient_email}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${!appointment.patient_phone && !appointment.patient_email ? `
                        <div class="text-center text-muted">
                            <i class="bi bi-info-circle"></i>
                            <p class="mb-0 mt-2">No patient contact information available</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Get appropriate status badge color
function getStatusBadgeColor(status) {
    switch (status?.toLowerCase()) {
        case 'scheduled':
            return 'primary';
        case 'completed':
            return 'success';
        case 'cancelled':
            return 'danger';
        case 'no-show':
            return 'warning';
        default:
            return 'secondary';
    }
}

// Format date and time for display
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (error) {
        return 'Invalid date';
    }
}

// Delete appointment
async function deleteAppointment(id, date) {
    if (!confirm(`Are you sure you want to delete the appointment on ${date}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/appointments/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadAppointments(); // Reload the appointment list
            loadAppointmentStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to delete appointment', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting appointment: ' + error.message, 'danger');
    }
}