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
    const inputs = form.querySelectorAll('.form-control');
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
            
            