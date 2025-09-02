// Patient management JavaScript

let allPatients = [];
let filteredPatients = [];
let currentEditingId = null;

// Initialize patients page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('patientsTableBody')) {
        loadPatients();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', filterPatients);
    document.getElementById('genderFilter').addEventListener('change', filterPatients);
    
    // Form validation
    document.getElementById('phone').addEventListener('input', validatePhone);
    document.getElementById('emergencyContactPhone').addEventListener('input', validatePhone);
    document.getElementById('email').addEventListener('input', validateEmail);
}

// Phone validation - only allow numbers, +, spaces, and hyphens
function validatePhone(event) {
    const input = event.target;
    const value = input.value;
    
    // Remove any characters that aren't numbers, +, spaces, or hyphens
    const cleaned = value.replace(/[^0-9\+\s\-]/g, '');
    
    if (value !== cleaned) {
        input.value = cleaned;
        showFieldError(input, 'Phone number can only contain numbers, +, spaces, and hyphens');
    } else {
        clearFieldError(input);
    }
}

// Email validation - must contain @ (real-time)
function validateEmail(event) {
    const input = event.target;
    const value = input.value.trim();
    
    if (value && !value.includes('@')) {
        showFieldError(input, 'Email must contain @ symbol');
    } else {
        clearFieldError(input);
    }
}

// Show field-specific error
function showFieldError(input, message) {
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    
    // Find the error div for this field
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

// Load all patients
async function loadPatients() {
    try {
        showLoading(true);
        const response = await apiCall('/patients');
        
        if (response.success) {
            allPatients = response.data;
            filteredPatients = [...allPatients];
            displayPatients();
            updatePatientCount();
        } else {
            console.error('Failed to load patients:', response.error);
            showAlert('Failed to load patients: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading patients:', error);
        showAlert('Error loading patients: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allPatients = [];
        filteredPatients = [];
        displayPatients();
        updatePatientCount();
    } finally {
        showLoading(false);
    }
}

// Display patients in table
function displayPatients() {
    const tbody = document.getElementById('patientsTableBody');
    const tableDiv = document.getElementById('patientsTable');
    const noPatients = document.getElementById('noPatients');
    
    if (filteredPatients.length === 0) {
        tableDiv.style.display = 'none';
        noPatients.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noPatients.style.display = 'none';
    
    const patientsHtml = filteredPatients.map(patient => `
        <tr>
            <td>
                <strong>${patient.first_name} ${patient.last_name}</strong>
            </td>
            <td>
                ${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Not specified'}
            </td>
            <td>
                <span class="badge bg-light text-dark">${patient.gender || 'Not specified'}</span>
            </td>
            <td>
                ${patient.phone ? `<a href="tel:${patient.phone}">${patient.phone}</a>` : 'Not provided'}
            </td>
            <td>
                ${patient.email ? `<a href="mailto:${patient.email}">${patient.email}</a>` : 'Not provided'}
            </td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary admin-action" onclick="editPatient('${patient.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="viewPatient('${patient.id}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger admin-action" onclick="deletePatient('${patient.id}', '${patient.first_name} ${patient.last_name}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = patientsHtml;
    
    // Update admin action buttons visibility
    if (window.authManager) {
        window.authManager.updateActionButtons();
    }
}

// Filter patients based on search and filters
function filterPatients() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const genderFilter = document.getElementById('genderFilter').value;
    
    filteredPatients = allPatients.filter(patient => {
        const matchesSearch = !searchTerm || 
            patient.first_name.toLowerCase().includes(searchTerm) ||
            patient.last_name.toLowerCase().includes(searchTerm) ||
            (patient.phone && patient.phone.includes(searchTerm)) ||
            (patient.email && patient.email.toLowerCase().includes(searchTerm));
        
        const matchesGender = !genderFilter || patient.gender === genderFilter;
        
        return matchesSearch && matchesGender;
    });
    
    displayPatients();
    updatePatientCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('genderFilter').value = '';
    filteredPatients = [...allPatients];
    displayPatients();
    updatePatientCount();
}

// Update patient count badge
function updatePatientCount() {
    document.getElementById('patientCount').textContent = filteredPatients.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new patient
function openAddPatientModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus"></i> Add New Patient';
    document.getElementById('savePatientBtn').innerHTML = '<i class="bi bi-save"></i> Save Patient';
    document.getElementById('patientForm').reset();
    document.getElementById('patientId').value = '';
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Edit patient
async function editPatient(id) {
    try {
        const response = await apiCall(`/patients/${id}`);
        
        if (response.success) {
            const patient = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('patientId').value = patient.id;
            document.getElementById('firstName').value = patient.first_name || '';
            document.getElementById('lastName').value = patient.last_name || '';
            document.getElementById('dateOfBirth').value = patient.date_of_birth ? patient.date_of_birth.split('T')[0] : '';
            document.getElementById('gender').value = patient.gender || '';
            document.getElementById('phone').value = patient.phone || '';
            document.getElementById('email').value = patient.email || '';
            document.getElementById('address').value = patient.address || '';
            document.getElementById('emergencyContactName').value = patient.emergency_contact_name || '';
            document.getElementById('emergencyContactPhone').value = patient.emergency_contact_phone || '';
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Patient';
            document.getElementById('savePatientBtn').innerHTML = '<i class="bi bi-save"></i> Update Patient';
            
            // Show modal
            new bootstrap.Modal(document.getElementById('patientModal')).show();
        }
    } catch (error) {
        showAlert('Error loading patient details: ' + error.message, 'danger');
    }
}

// Make functions globally available
window.savePatient = savePatient;
window.editPatient = editPatient;
window.deletePatient = deletePatient;
window.viewPatient = viewPatient;
window.openAddPatientModal = openAddPatientModal;
window.clearFilters = clearFilters;
window.editFromView = editFromView;

// Save patient (create or update)
async function savePatient() {
    const form = document.getElementById('patientForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    
    if (!firstName.value.trim()) {
        showFieldError(firstName, 'First name is required');
        hasErrors = true;
    }
    
    if (!lastName.value.trim()) {
        showFieldError(lastName, 'Last name is required');
        hasErrors = true;
    }
    
    // Validate email
    const email = document.getElementById('email');
    if (email.value.trim() && !email.value.includes('@')) {
        showFieldError(email, 'Please enter a valid email address with @ symbol');
        hasErrors = true;
    }
    
    // Validate phone numbers
    const phone = document.getElementById('phone');
    const emergencyPhone = document.getElementById('emergencyContactPhone');
    
    const phoneRegex = /^[\d\+\s\-]+$/;
    
    if (phone.value.trim() && !phoneRegex.test(phone.value.trim())) {
        showFieldError(phone, 'Phone number can only contain numbers, +, spaces, and hyphens');
        hasErrors = true;
    }
    
    if (emergencyPhone.value.trim() && !phoneRegex.test(emergencyPhone.value.trim())) {
        showFieldError(emergencyPhone, 'Phone number can only contain numbers, +, spaces, and hyphens');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const patientData = {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        date_of_birth: document.getElementById('dateOfBirth').value || null,
        gender: document.getElementById('gender').value || null,
        phone: phone.value.trim() || null,
        email: email.value.trim() || null,
        address: document.getElementById('address').value.trim() || null,
        emergency_contact_name: document.getElementById('emergencyContactName').value.trim() || null,
        emergency_contact_phone: emergencyPhone.value.trim() || null
    };
    
    
    try {
        const saveBtn = document.getElementById('savePatientBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing patient
            response = await apiCall(`/patients/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(patientData)
            });
        } else {
            // Create new patient
            response = await apiCall('/patients', {
                method: 'POST',
                body: JSON.stringify(patientData)
            });
        }
        
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('patientModal')).hide();
            loadPatients(); // Reload the patient list
        } else {
            showAlert(response.error || 'Failed to save patient', 'danger');
        }
    } catch (error) {
        console.error('Error saving patient:', error);
        showAlert('Error saving patient: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('savePatientBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Patient' : 
            '<i class="bi bi-save"></i> Save Patient';
    }
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('patientForm');
    const inputs = form.querySelectorAll('.form-control');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// View patient details
async function viewPatient(id) {
    
    try {
        // Show the modal first
        const modal = new bootstrap.Modal(document.getElementById('viewPatientModal'));
        modal.show();
        
        // Show loading state
        document.getElementById('viewPatientLoading').style.display = 'block';
        document.getElementById('viewPatientContent').style.display = 'none';
        
        // Fetch patient details
        const response = await apiCall(`/patients/${id}`);
        
        if (response.success) {
            const patient = response.data;
            populatePatientView(patient);
            
            // Hide loading and show content
            document.getElementById('viewPatientLoading').style.display = 'none';
            document.getElementById('viewPatientContent').style.display = 'block';
        } else {
            showAlert('Failed to load patient details: ' + (response.error || 'Unknown error'), 'danger');
            modal.hide();
        }
    } catch (error) {
        console.error('Error loading patient details:', error);
        showAlert('Error loading patient details: ' + error.message, 'danger');
        const modal = bootstrap.Modal.getInstance(document.getElementById('viewPatientModal'));
        if (modal) {
            modal.hide();
        }
    }
}

// Populate the patient view modal with data
function populatePatientView(patient) {
    const content = document.getElementById('viewPatientContent');
    const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null;
    const genderColor = getGenderBadgeColor(patient.gender);
    
    content.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="card border-0">
                    <div class="card-body">
                        <h4 class="card-title text-primary">
                            <i class="bi bi-person-circle"></i> ${patient.first_name} ${patient.last_name}
                        </h4>
                        ${patient.gender ? `<p class="mb-2"><span class="badge bg-${genderColor} fs-6">${patient.gender}</span></p>` : ''}
                        
                        <div class="row mt-3">
                            <div class="col-sm-4 fw-semibold">Patient ID:</div>
                            <div class="col-sm-8">
                                <span class="font-monospace text-muted small">${patient.id}</span>
                            </div>
                        </div>
                        
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Date of Birth:</div>
                            <div class="col-sm-8">
                                ${patient.date_of_birth ? 
                                    new Date(patient.date_of_birth).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long', 
                                        day: 'numeric'
                                    }) : 'Not specified'}
                                ${age ? `<small class="text-muted d-block">${age} years old</small>` : ''}
                            </div>
                        </div>
                        
                        ${patient.address ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Address:</div>
                            <div class="col-sm-8">${patient.address}</div>
                        </div>
                        ` : ''}
                        
                        ${patient.emergency_contact ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Emergency Contact:</div>
                            <div class="col-sm-8">${patient.emergency_contact}</div>
                        </div>
                        ` : ''}
                        
                        ${patient.insurance_info ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Insurance:</div>
                            <div class="col-sm-8">${patient.insurance_info}</div>
                        </div>
                        ` : ''}
                        
                        ${patient.medical_history ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Medical History:</div>
                            <div class="col-sm-8">
                                <div class="text-muted" style="max-height: 100px; overflow-y: auto;">
                                    ${patient.medical_history}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${patient.created_at ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Created:</div>
                            <div class="col-sm-8">
                                <small class="text-muted">${formatDateTime(patient.created_at)}</small>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0"><i class="bi bi-telephone"></i> Contact Information</h6>
                    </div>
                    <div class="card-body">
                        ${patient.phone ? `
                        <div class="mb-3">
                            <i class="bi bi-telephone text-primary"></i>
                            <strong class="ms-2">Phone:</strong>
                            <div class="mt-1">
                                <a href="tel:${patient.phone}" class="text-decoration-none">
                                    ${patient.phone}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${patient.email ? `
                        <div class="mb-3">
                            <i class="bi bi-envelope text-primary"></i>
                            <strong class="ms-2">Email:</strong>
                            <div class="mt-1">
                                <a href="mailto:${patient.email}" class="text-decoration-none">
                                    ${patient.email}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${!patient.phone && !patient.email ? `
                        <div class="text-center text-muted">
                            <i class="bi bi-info-circle"></i>
                            <p class="mb-0 mt-2">No contact information available</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Store patient ID for edit functionality
    document.getElementById('editFromViewBtn').setAttribute('data-patient-id', patient.id);
}

// Helper function to get appropriate badge color for gender
function getGenderBadgeColor(gender) {
    switch (gender?.toLowerCase()) {
        case 'male':
            return 'primary';
        case 'female':
            return 'info';
        case 'other':
            return 'secondary';
        default:
            return 'secondary';
    }
}

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
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

// Edit patient from view modal
function editFromView() {
    const patientId = document.getElementById('editFromViewBtn').getAttribute('data-patient-id');
    if (patientId) {
        // Close view modal
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewPatientModal'));
        if (viewModal) {
            viewModal.hide();
        }
        
        // Open edit modal
        setTimeout(() => {
            editPatient(patientId);
        }, 300); // Small delay to allow view modal to close
    }
}

// Delete patient
async function deletePatient(id, name) {
    if (!confirm(`Are you sure you want to delete patient "${name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/patients/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadPatients(); // Reload the patient list
        } else {
            showAlert(response.error || 'Failed to delete patient', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting patient: ' + error.message, 'danger');
    }
}