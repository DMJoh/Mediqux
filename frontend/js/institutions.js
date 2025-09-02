// Institution management JavaScript

let allInstitutions = [];
let filteredInstitutions = [];
let currentEditingId = null;

// Make functions globally available
window.saveInstitution = saveInstitution;
window.editInstitution = editInstitution;
window.deleteInstitution = deleteInstitution;
window.viewInstitution = viewInstitution;
window.openAddInstitutionModal = openAddInstitutionModal;
window.clearFilters = clearFilters;

// Initialize institutions page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('institutionsTableBody')) {
        console.log('Initializing institutions page...');
        loadInstitutions();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', filterInstitutions);
    document.getElementById('typeFilter').addEventListener('change', filterInstitutions);
    
    // Form validation
    document.getElementById('phone').addEventListener('input', validatePhone);
    document.getElementById('email').addEventListener('input', validateEmail);
    document.getElementById('website').addEventListener('input', validateWebsite);
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

// Website validation - basic URL format
function validateWebsite(event) {
    const input = event.target;
    const value = input.value.trim();
    
    if (value && !value.match(/^https?:\/\/.+/i)) {
        showFieldError(input, 'Website must start with http:// or https://');
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

// Load all institutions
async function loadInstitutions() {
    console.log('Loading institutions...');
    try {
        showLoading(true);
        const response = await apiCall('/institutions');
        console.log('Institutions response:', response);
        
        if (response.success) {
            allInstitutions = response.data;
            filteredInstitutions = [...allInstitutions];
            displayInstitutions();
            updateInstitutionCount();
            populateTypeFilter();
            console.log(`Loaded ${allInstitutions.length} institutions`);
        } else {
            console.error('Failed to load institutions:', response.error);
            showAlert('Failed to load institutions: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading institutions:', error);
        showAlert('Error loading institutions: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allInstitutions = [];
        filteredInstitutions = [];
        displayInstitutions();
        updateInstitutionCount();
    } finally {
        showLoading(false);
    }
}

// Populate type filter
function populateTypeFilter() {
    const types = [...new Set(allInstitutions
        .map(institution => institution.type)
        .filter(type => type && type.trim())
    )].sort();
    
    const select = document.getElementById('typeFilter');
    select.innerHTML = '<option value="">All Types</option>' + 
        types.map(type => 
            `<option value="${type}">${type}</option>`
        ).join('');
}

// Display institutions in table
function displayInstitutions() {
    const tbody = document.getElementById('institutionsTableBody');
    const tableDiv = document.getElementById('institutionsTable');
    const noInstitutions = document.getElementById('noInstitutions');
    
    if (filteredInstitutions.length === 0) {
        tableDiv.style.display = 'none';
        noInstitutions.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noInstitutions.style.display = 'none';
    
    tbody.innerHTML = filteredInstitutions.map(institution => {
        const doctorCount = parseInt(institution.doctor_count) || 0;
        
        return `
            <tr>
                <td>
                    <strong>${institution.name}</strong>
                    ${institution.website ? `<br><small><a href="${institution.website}" target="_blank" class="text-muted"><i class="bi bi-link-45deg"></i> Website</a></small>` : ''}
                </td>
                <td>
                    <span class="badge bg-secondary">${institution.type || 'Not specified'}</span>
                </td>
                <td>
                    <small class="text-muted">${institution.address || 'No address provided'}</small>
                </td>
                <td>
                    <div>
                        ${institution.phone ? `<div><i class="bi bi-telephone"></i> <a href="tel:${institution.phone}">${institution.phone}</a></div>` : ''}
                        ${institution.email ? `<div><i class="bi bi-envelope"></i> <a href="mailto:${institution.email}">${institution.email}</a></div>` : ''}
                        ${!institution.phone && !institution.email ? '<small class="text-muted">No contact provided</small>' : ''}
                    </div>
                </td>
                <td>
                    <span class="badge bg-info">${doctorCount} doctor${doctorCount !== 1 ? 's' : ''}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editInstitution('${institution.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewInstitution('${institution.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteInstitution('${institution.id}', '${institution.name.replace(/'/g, "\\'")}', ${doctorCount})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter institutions based on search and filters
function filterInstitutions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    
    filteredInstitutions = allInstitutions.filter(institution => {
        const matchesSearch = !searchTerm || 
            institution.name.toLowerCase().includes(searchTerm) ||
            (institution.type && institution.type.toLowerCase().includes(searchTerm)) ||
            (institution.address && institution.address.toLowerCase().includes(searchTerm)) ||
            (institution.phone && institution.phone.includes(searchTerm)) ||
            (institution.email && institution.email.toLowerCase().includes(searchTerm));
        
        const matchesType = !typeFilter || institution.type === typeFilter;
        
        return matchesSearch && matchesType;
    });
    
    displayInstitutions();
    updateInstitutionCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    filteredInstitutions = [...allInstitutions];
    displayInstitutions();
    updateInstitutionCount();
}

// Update institution count badge
function updateInstitutionCount() {
    document.getElementById('institutionCount').textContent = filteredInstitutions.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new institution
function openAddInstitutionModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add New Institution';
    document.getElementById('saveInstitutionBtn').innerHTML = '<i class="bi bi-save"></i> Save Institution';
    document.getElementById('institutionForm').reset();
    document.getElementById('institutionId').value = '';
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('institutionForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// Edit institution
async function editInstitution(id) {
    try {
        const response = await apiCall(`/institutions/${id}`);
        
        if (response.success) {
            const institution = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('institutionId').value = institution.id;
            document.getElementById('name').value = institution.name || '';
            document.getElementById('type').value = institution.type || '';
            document.getElementById('address').value = institution.address || '';
            document.getElementById('phone').value = institution.phone || '';
            document.getElementById('email').value = institution.email || '';
            document.getElementById('website').value = institution.website || '';
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Institution';
            document.getElementById('saveInstitutionBtn').innerHTML = '<i class="bi bi-save"></i> Update Institution';
            
            // Clear validation states and show modal
            clearAllFieldErrors();
            new bootstrap.Modal(document.getElementById('institutionModal')).show();
        }
    } catch (error) {
        showAlert('Error loading institution details: ' + error.message, 'danger');
    }
}

// Save institution (create or update)
async function saveInstitution() {
    console.log('Save institution button clicked');
    const form = document.getElementById('institutionForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const name = document.getElementById('name');
    
    if (!name.value.trim()) {
        showFieldError(name, 'Institution name is required');
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
    
    // Validate website
    const website = document.getElementById('website');
    if (website.value.trim() && !website.value.match(/^https?:\/\/.+/i)) {
        showFieldError(website, 'Website must start with http:// or https://');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const institutionData = {
        name: name.value.trim(),
        type: document.getElementById('type').value.trim() || null,
        address: document.getElementById('address').value.trim() || null,
        phone: phone.value.trim() || null,
        email: email.value.trim() || null,
        website: website.value.trim() || null
    };
    
    console.log('Institution data to save:', institutionData);
    
    try {
        const saveBtn = document.getElementById('saveInstitutionBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing institution
            console.log('Updating institution:', currentEditingId);
            response = await apiCall(`/institutions/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(institutionData)
            });
        } else {
            // Create new institution
            console.log('Creating new institution');
            response = await apiCall('/institutions', {
                method: 'POST',
                body: JSON.stringify(institutionData)
            });
        }
        
        console.log('Save response:', response);
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('institutionModal')).hide();
            loadInstitutions(); // Reload the institution list
        } else {
            showAlert(response.error || 'Failed to save institution', 'danger');
        }
    } catch (error) {
        console.error('Error saving institution:', error);
        showAlert('Error saving institution: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveInstitutionBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Institution' : 
            '<i class="bi bi-save"></i> Save Institution';
    }
}

// View institution details
async function viewInstitution(id) {
    try {
        const response = await apiCall(`/institutions/${id}`);
        
        if (response.success) {
            const institution = response.data;
            displayInstitutionDetails(institution);
            
            // Setup edit button in details modal
            document.getElementById('editFromDetailsBtn').onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('institutionDetailsModal')).hide();
                setTimeout(() => editInstitution(id), 300); // Small delay for smooth transition
            };
            
            // Show the details modal
            new bootstrap.Modal(document.getElementById('institutionDetailsModal')).show();
        } else {
            showAlert('Failed to load institution details: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading institution details:', error);
        showAlert('Error loading institution details: ' + error.message, 'danger');
    }
}

// Display institution details in modal
function displayInstitutionDetails(institution) {
    const content = document.getElementById('institutionDetailsContent');
    const doctorCount = institution.doctors ? institution.doctors.length : 0;
    
    content.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="card border-0">
                    <div class="card-body">
                        <h4 class="card-title text-primary">
                            <i class="bi bi-building"></i> ${institution.name}
                        </h4>
                        ${institution.type ? `<p class="mb-2"><span class="badge bg-secondary fs-6">${institution.type}</span></p>` : ''}
                        
                        ${institution.address ? `
                        <div class="row mt-3">
                            <div class="col-sm-4 fw-semibold">Address:</div>
                            <div class="col-sm-8">${institution.address}</div>
                        </div>
                        ` : ''}
                        
                        ${institution.website ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Website:</div>
                            <div class="col-sm-8">
                                <a href="${institution.website}" target="_blank" class="text-decoration-none">
                                    <i class="bi bi-link-45deg"></i> ${institution.website}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Associated Doctors:</div>
                            <div class="col-sm-8">
                                <span class="badge bg-info">${doctorCount} doctor${doctorCount !== 1 ? 's' : ''}</span>
                                ${doctorCount > 0 ? `
                                    <div class="mt-2">
                                        ${institution.doctors.map(doctor => 
                                            `<div class="small text-muted">
                                                <i class="bi bi-person-badge me-1"></i>
                                                Dr. ${doctor.first_name} ${doctor.last_name}
                                                ${doctor.specialty ? `<span class="text-primary">- ${doctor.specialty}</span>` : ''}
                                            </div>`
                                        ).join('')}
                                    </div>
                                ` : '<small class="text-muted d-block">No doctors assigned</small>'}
                            </div>
                        </div>
                        
                        ${institution.created_at ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Created:</div>
                            <div class="col-sm-8">
                                <small class="text-muted">${formatDateTime(institution.created_at)}</small>
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
                        ${institution.phone ? `
                        <div class="mb-3">
                            <i class="bi bi-telephone text-primary"></i>
                            <strong class="ms-2">Phone:</strong>
                            <div class="mt-1">
                                <a href="tel:${institution.phone}" class="text-decoration-none">
                                    ${institution.phone}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${institution.email ? `
                        <div class="mb-3">
                            <i class="bi bi-envelope text-primary"></i>
                            <strong class="ms-2">Email:</strong>
                            <div class="mt-1">
                                <a href="mailto:${institution.email}" class="text-decoration-none">
                                    ${institution.email}
                                </a>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${!institution.phone && !institution.email ? `
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

// Delete institution
async function deleteInstitution(id, name, doctorCount) {
    if (doctorCount > 0) {
        showAlert(`Cannot delete "${name}" because it has ${doctorCount} associated doctor(s). Please remove doctor associations first.`, 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/institutions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadInstitutions(); // Reload the institution list
        } else {
            showAlert(response.error || 'Failed to delete institution', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting institution: ' + error.message, 'danger');
    }
}