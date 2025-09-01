// Doctor management JavaScript

let allDoctors = [];
let filteredDoctors = [];
let availableInstitutions = [];
let currentEditingId = null;

// Make functions globally available
window.saveDoctor = saveDoctor;
window.editDoctor = editDoctor;
window.deleteDoctor = deleteDoctor;
window.viewDoctor = viewDoctor;
window.openAddDoctorModal = openAddDoctorModal;
window.clearFilters = clearFilters;
window.editFromViewDoctor = editFromViewDoctor;

// Initialize doctors page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('doctorsTableBody')) {
        console.log('Initializing doctors page...');
        loadDoctors();
        loadAvailableInstitutions();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', filterDoctors);
    document.getElementById('specialtyFilter').addEventListener('change', filterDoctors);
    
    // Form validation
    document.getElementById('phone').addEventListener('input', validatePhone);
    document.getElementById('email').addEventListener('input', validateEmail);
}

// Phone validation - only allow numbers, +, spaces, and hyphens
function validatePhone(event) {
    const input = event.target;
    const value = input.value;
    
    const cleaned = value.replace(/[^0-9\+\s\-]/g, '');
    
    if (value !== cleaned) {
        input.value = cleaned;
        showFieldError(input, 'Phone number can only contain numbers, +, spaces, and hyphens');
    } else {
        clearFieldError(input);
    }
}

// Email validation - must contain @
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

// Load all doctors
async function loadDoctors() {
    console.log('Loading doctors...');
    try {
        showLoading(true);
        const response = await apiCall('/doctors');
        console.log('Doctors response:', response);
        
        if (response.success) {
            allDoctors = response.data;
            filteredDoctors = [...allDoctors];
            displayDoctors();
            updateDoctorCount();
            populateSpecialtyFilter();
            console.log(`Loaded ${allDoctors.length} doctors`);
        } else {
            console.error('Failed to load doctors:', response.error);
            showAlert('Failed to load doctors: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading doctors:', error);
        showAlert('Error loading doctors: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allDoctors = [];
        filteredDoctors = [];
        displayDoctors();
        updateDoctorCount();
    } finally {
        showLoading(false);
    }
}

// Load available institutions for dropdown
async function loadAvailableInstitutions() {
    try {
        const response = await apiCall('/doctors/institutions/available');
        if (response.success) {
            availableInstitutions = response.data;
            populateInstitutionSelect();
        }
    } catch (error) {
        console.error('Error loading institutions:', error);
        // Continue without institutions - they're optional
    }
}

// Populate institution select dropdown
function populateInstitutionSelect() {
    const select = document.getElementById('institutions');
    select.innerHTML = availableInstitutions.map(institution => 
        `<option value="${institution.id}">${institution.name} (${institution.type || 'Unknown'})</option>`
    ).join('');
}

// Populate specialty filter
function populateSpecialtyFilter() {
    const specialties = [...new Set(allDoctors
        .map(doctor => doctor.specialty)
        .filter(specialty => specialty && specialty.trim())
    )].sort();
    
    const select = document.getElementById('specialtyFilter');
    select.innerHTML = '<option value="">All Specialties</option>' + 
        specialties.map(specialty => 
            `<option value="${specialty}">${specialty}</option>`
        ).join('');
}

// Display doctors in table
function displayDoctors() {
    const tbody = document.getElementById('doctorsTableBody');
    const tableDiv = document.getElementById('doctorsTable');
    const noDoctors = document.getElementById('noDoctors');
    
    if (filteredDoctors.length === 0) {
        tableDiv.style.display = 'none';
        noDoctors.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noDoctors.style.display = 'none';
    
    tbody.innerHTML = filteredDoctors.map(doctor => {
        const institutionNames = doctor.institutions && doctor.institutions.length > 0 
            ? doctor.institutions.map(inst => `${inst.name} (${inst.type || 'Unknown'})`).join(', ')
            : 'No institutions assigned';
            
        return `
            <tr>
                <td>
                    <strong>Dr. ${doctor.first_name} ${doctor.last_name}</strong>
                </td>
                <td>
                    <span class="badge bg-info">${doctor.specialty || 'Not specified'}</span>
                </td>
                <td>
                    <code>${doctor.license_number || 'Not provided'}</code>
                </td>
                <td>
                    <div>
                        ${doctor.phone ? `<div><i class="bi bi-telephone"></i> <a href="tel:${doctor.phone}">${doctor.phone}</a></div>` : ''}
                        ${doctor.email ? `<div><i class="bi bi-envelope"></i> <a href="mailto:${doctor.email}">${doctor.email}</a></div>` : ''}
                        ${!doctor.phone && !doctor.email ? '<small class="text-muted">No contact provided</small>' : ''}
                    </div>
                </td>
                <td>
                    <small class="text-muted">${institutionNames}</small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editDoctor('${doctor.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewDoctor('${doctor.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteDoctor('${doctor.id}', 'Dr. ${doctor.first_name} ${doctor.last_name}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter doctors based on search and filters
function filterDoctors() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const specialtyFilter = document.getElementById('specialtyFilter').value;
    
    filteredDoctors = allDoctors.filter(doctor => {
        const matchesSearch = !searchTerm || 
            doctor.first_name.toLowerCase().includes(searchTerm) ||
            doctor.last_name.toLowerCase().includes(searchTerm) ||
            (doctor.specialty && doctor.specialty.toLowerCase().includes(searchTerm)) ||
            (doctor.license_number && doctor.license_number.toLowerCase().includes(searchTerm)) ||
            (doctor.phone && doctor.phone.includes(searchTerm)) ||
            (doctor.email && doctor.email.toLowerCase().includes(searchTerm));
        
        const matchesSpecialty = !specialtyFilter || doctor.specialty === specialtyFilter;
        
        return matchesSearch && matchesSpecialty;
    });
    
    displayDoctors();
    updateDoctorCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('specialtyFilter').value = '';
    filteredDoctors = [...allDoctors];
    displayDoctors();
    updateDoctorCount();
}

// Update doctor count badge
function updateDoctorCount() {
    document.getElementById('doctorCount').textContent = filteredDoctors.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new doctor
function openAddDoctorModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus"></i> Add New Doctor';
    document.getElementById('saveDoctorBtn').innerHTML = '<i class="bi bi-save"></i> Save Doctor';
    document.getElementById('doctorForm').reset();
    document.getElementById('doctorId').value = '';
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('doctorForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// Edit doctor
async function editDoctor(id) {
    try {
        const response = await apiCall(`/doctors/${id}`);
        
        if (response.success) {
            const doctor = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('doctorId').value = doctor.id;
            document.getElementById('firstName').value = doctor.first_name || '';
            document.getElementById('lastName').value = doctor.last_name || '';
            document.getElementById('specialty').value = doctor.specialty || '';
            document.getElementById('licenseNumber').value = doctor.license_number || '';
            document.getElementById('phone').value = doctor.phone || '';
            document.getElementById('email').value = doctor.email || '';
            
            // Select associated institutions
            const institutionSelect = document.getElementById('institutions');
            const institutionIds = doctor.institutions ? doctor.institutions.map(inst => inst.id) : [];
            
            Array.from(institutionSelect.options).forEach(option => {
                option.selected = institutionIds.includes(option.value);
            });
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Doctor';
            document.getElementById('saveDoctorBtn').innerHTML = '<i class="bi bi-save"></i> Update Doctor';
            
            // Clear validation states and show modal
            clearAllFieldErrors();
            new bootstrap.Modal(document.getElementById('doctorModal')).show();
        }
    } catch (error) {
        showAlert('Error loading doctor details: ' + error.message, 'danger');
    }
}

// Save doctor (create or update)
async function saveDoctor() {
    console.log('Save doctor button clicked');
    const form = document.getElementById('doctorForm');
    
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
    
    // Validate phone number
    const phone = document.getElementById('phone');
    const phoneRegex = /^[\d\+\s\-]+$/;
    
    if (phone.value.trim() && !phoneRegex.test(phone.value.trim())) {
        showFieldError(phone, 'Phone number can only contain numbers, +, spaces, and hyphens');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    // Get selected institutions
    const institutionSelect = document.getElementById('institutions');
    const selectedInstitutions = Array.from(institutionSelect.selectedOptions).map(option => option.value);
    
    const doctorData = {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        specialty: document.getElementById('specialty').value.trim() || null,
        license_number: document.getElementById('licenseNumber').value.trim() || null,
        phone: phone.value.trim() || null,
        email: email.value.trim() || null,
        institution_ids: selectedInstitutions
    };
    
    console.log('Doctor data to save:', doctorData);
    
    try {
        const saveBtn = document.getElementById('saveDoctorBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing doctor
            console.log('Updating doctor:', currentEditingId);
            response = await apiCall(`/doctors/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(doctorData)
            });
        } else {
            // Create new doctor
            console.log('Creating new doctor');
            response = await apiCall('/doctors', {
                method: 'POST',
                body: JSON.stringify(doctorData)
            });
        }
        
        console.log('Save response:', response);
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('doctorModal')).hide();
            loadDoctors(); // Reload the doctor list
        } else {
            showAlert(response.error || 'Failed to save doctor', 'danger');
        }
    } catch (error) {
        console.error('Error saving doctor:', error);
        showAlert('Error saving doctor: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveDoctorBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Doctor' : 
            '<i class="bi bi-save"></i> Save Doctor';
    }
}

// View doctor details
async function viewDoctor(id) {
    console.log('Viewing doctor details for ID:', id);
    
    try {
        // Show the modal first
        const modal = new bootstrap.Modal(document.getElementById('viewDoctorModal'));
        modal.show();
        
        // Show loading state
        document.getElementById('viewDoctorLoading').style.display = 'block';
        document.getElementById('viewDoctorContent').style.display = 'none';
        
        // Fetch doctor details
        const response = await apiCall(`/doctors/${id}`);
        
        if (response.success) {
            const doctor = response.data;
            populateDoctorView(doctor);
            
            // Hide loading and show content
            document.getElementById('viewDoctorLoading').style.display = 'none';
            document.getElementById('viewDoctorContent').style.display = 'block';
        } else {
            showAlert('Failed to load doctor details: ' + (response.error || 'Unknown error'), 'danger');
            modal.hide();
        }
    } catch (error) {
        console.error('Error loading doctor details:', error);
        showAlert('Error loading doctor details: ' + error.message, 'danger');
        const modal = bootstrap.Modal.getInstance(document.getElementById('viewDoctorModal'));
        if (modal) {
            modal.hide();
        }
    }
}

// Populate the doctor view modal with data
function populateDoctorView(doctor) {
    // Doctor name and basic info
    document.getElementById('doctorFullName').textContent = `Dr. ${doctor.first_name} ${doctor.last_name}`;
    
    // Specialty badge
    const specialtyBadge = document.getElementById('doctorSpecialtyBadge');
    if (doctor.specialty) {
        specialtyBadge.textContent = doctor.specialty;
        specialtyBadge.style.display = 'inline';
    } else {
        specialtyBadge.style.display = 'none';
    }
    
    // Professional information
    document.getElementById('viewDoctorSpecialty').textContent = doctor.specialty || 'Not specified';
    document.getElementById('viewDoctorLicense').textContent = doctor.license_number || 'Not provided';
    
    // Contact information
    const phoneElement = document.getElementById('viewDoctorPhone');
    if (doctor.phone) {
        phoneElement.innerHTML = `<a href="tel:${doctor.phone}" class="text-decoration-none">
            <i class="bi bi-telephone me-1"></i>${doctor.phone}
        </a>`;
    } else {
        phoneElement.textContent = 'Not provided';
    }
    
    const emailElement = document.getElementById('viewDoctorEmail');
    if (doctor.email) {
        emailElement.innerHTML = `<a href="mailto:${doctor.email}" class="text-decoration-none">
            <i class="bi bi-envelope me-1"></i>${doctor.email}
        </a>`;
    } else {
        emailElement.textContent = 'Not provided';
    }
    
    // Associated institutions
    const institutionsElement = document.getElementById('viewDoctorInstitutions');
    if (doctor.institutions && doctor.institutions.length > 0) {
        const institutionBadges = doctor.institutions.map(inst => 
            `<span class="badge bg-secondary me-2 mb-2">
                <i class="bi bi-building me-1"></i>${inst.name}
                ${inst.type ? `<small class="ms-1">(${inst.type})</small>` : ''}
            </span>`
        ).join('');
        institutionsElement.innerHTML = institutionBadges;
    } else {
        institutionsElement.innerHTML = '<span class="text-muted">No associated institutions</span>';
    }
    
    // Timestamps
    document.getElementById('viewDoctorCreatedAt').textContent = doctor.created_at ? 
        new Date(doctor.created_at).toLocaleString() : 'Not available';
    document.getElementById('viewDoctorUpdatedAt').textContent = doctor.updated_at ? 
        new Date(doctor.updated_at).toLocaleString() : 'Not available';
    
    // Store doctor ID for edit functionality
    document.getElementById('editFromViewDoctorBtn').setAttribute('data-doctor-id', doctor.id);
}

// Edit doctor from view modal
function editFromViewDoctor() {
    const doctorId = document.getElementById('editFromViewDoctorBtn').getAttribute('data-doctor-id');
    if (doctorId) {
        // Close view modal
        const viewModal = bootstrap.Modal.getInstance(document.getElementById('viewDoctorModal'));
        if (viewModal) {
            viewModal.hide();
        }
        
        // Open edit modal
        setTimeout(() => {
            editDoctor(doctorId);
        }, 300); // Small delay to allow view modal to close
    }
}

// Delete doctor
async function deleteDoctor(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/doctors/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadDoctors(); // Reload the doctor list
        } else {
            showAlert(response.error || 'Failed to delete doctor', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting doctor: ' + error.message, 'danger');
    }
}