// Patient management JavaScript

let allPatients = [];
let filteredPatients = [];
let currentEditingId = null;

// Initialize patients page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('patientsTableBody')) {
        console.log('Initializing patients page...');
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
        showAlert('Phone number can only contain numbers, +, spaces, and hyphens', 'warning');
    }
}

// Email validation - must contain @
function validateEmail(event) {
    const input = event.target;
    const value = input.value.trim();
    
    if (value && !value.includes('@')) {
        input.setCustomValidity('Email must contain @ symbol');
    } else {
        input.setCustomValidity('');
    }
}

// Load all patients
async function loadPatients() {
    console.log('Loading patients...');
    try {
        showLoading(true);
        const response = await apiCall('/patients');
        console.log('Patients response:', response);
        
        if (response.success) {
            allPatients = response.data;
            filteredPatients = [...allPatients];
            displayPatients();
            updatePatientCount();
            console.log(`Loaded ${allPatients.length} patients`);
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
    
    tbody.innerHTML = filteredPatients.map(patient => `
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
                    <button class="btn btn-outline-primary" onclick="editPatient('${patient.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="viewPatient('${patient.id}')" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deletePatient('${patient.id}', '${patient.first_name} ${patient.last_name}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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

// Save patient (create or update)
async function savePatient() {
    console.log('Save patient button clicked');
    const form = document.getElementById('patientForm');
    
    // Custom validation for email
    const email = document.getElementById('email').value.trim();
    if (email && !email.includes('@')) {
        showAlert('Please enter a valid email address with @ symbol', 'danger');
        document.getElementById('email').focus();
        return;
    }
    
    // Custom validation for phone numbers
    const phone = document.getElementById('phone').value.trim();
    const emergencyPhone = document.getElementById('emergencyContactPhone').value.trim();
    
    const phoneRegex = /^[\d\+\s\-]+$/;
    if (phone && !phoneRegex.test(phone)) {
        showAlert('Phone number can only contain numbers, +, spaces, and hyphens', 'danger');
        document.getElementById('phone').focus();
        return;
    }
    
    if (emergencyPhone && !phoneRegex.test(emergencyPhone)) {
        showAlert('Emergency contact phone can only contain numbers, +, spaces, and hyphens', 'danger');
        document.getElementById('emergencyContactPhone').focus();
        return;
    }
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const patientData = {
        first_name: document.getElementById('firstName').value.trim(),
        last_name: document.getElementById('lastName').value.trim(),
        date_of_birth: document.getElementById('dateOfBirth').value || null,
        gender: document.getElementById('gender').value || null,
        phone: phone || null,
        email: email || null,
        address: document.getElementById('address').value.trim() || null,
        emergency_contact_name: document.getElementById('emergencyContactName').value.trim() || null,
        emergency_contact_phone: emergencyPhone || null
    };
    
    console.log('Patient data to save:', patientData);
    
    try {
        const saveBtn = document.getElementById('savePatientBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing patient
            console.log('Updating patient:', currentEditingId);
            response = await apiCall(`/patients/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(patientData)
            });
        } else {
            // Create new patient
            console.log('Creating new patient');
            response = await apiCall('/patients', {
                method: 'POST',
                body: JSON.stringify(patientData)
            });
        }
        
        console.log('Save response:', response);
        
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

// View patient details (placeholder for future enhancement)
function viewPatient(id) {
    showAlert('Patient details view will be implemented next', 'info');
    // TODO: Implement detailed patient view
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