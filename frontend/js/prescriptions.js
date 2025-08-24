// Prescription management JavaScript

let allPrescriptions = [];
let filteredPrescriptions = [];
let currentEditingId = null;
let appointments = [];
let medications = [];

// Make functions globally available
window.savePrescription = savePrescription;
window.editPrescription = editPrescription;
window.deletePrescription = deletePrescription;
window.viewPrescription = viewPrescription;
window.openAddPrescriptionModal = openAddPrescriptionModal;
window.clearFilters = clearFilters;

// Initialize prescriptions page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('prescriptionsTableBody')) {
        console.log('Initializing prescriptions page...');
        loadPrescriptions();
        loadPrescriptionStats();
        loadFilterOptions();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterPrescriptions);
    document.getElementById('patientFilter').addEventListener('change', filterPrescriptions);
    document.getElementById('statusFilter').addEventListener('change', filterPrescriptions);
    
    // Appointment selection change
    document.getElementById('appointmentId').addEventListener('change', function() {
        updatePatientInfo();
    });
}

// Load all prescriptions
async function loadPrescriptions() {
    console.log('Loading prescriptions...');
    try {
        showLoading(true);
        const response = await apiCall('/prescriptions');
        console.log('Prescriptions response:', response);
        
        if (response.success) {
            allPrescriptions = response.data;
            filteredPrescriptions = [...allPrescriptions];
            displayPrescriptions();
            updatePrescriptionCount();
            console.log(`Loaded ${allPrescriptions.length} prescriptions`);
        } else {
            console.error('Failed to load prescriptions:', response.error);
            showAlert('Failed to load prescriptions: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading prescriptions:', error);
        showAlert('Error loading prescriptions: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allPrescriptions = [];
        filteredPrescriptions = [];
        displayPrescriptions();
        updatePrescriptionCount();
    } finally {
        showLoading(false);
    }
}

// Load prescription statistics
async function loadPrescriptionStats() {
    try {
        const response = await apiCall('/prescriptions/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalPrescriptionsCount').textContent = stats.total_prescriptions || 0;
            document.getElementById('activePrescriptionsCount').textContent = stats.active_prescriptions || 0;
            document.getElementById('uniquePatientsCount').textContent = stats.unique_patients || 0;
            document.getElementById('recentPrescriptionsCount').textContent = stats.recent_prescriptions || 0;
        }
    } catch (error) {
        console.error('Error loading prescription stats:', error);
        // Set defaults
        document.getElementById('totalPrescriptionsCount').textContent = '0';
        document.getElementById('activePrescriptionsCount').textContent = '0';
        document.getElementById('uniquePatientsCount').textContent = '0';
        document.getElementById('recentPrescriptionsCount').textContent = '0';
    }
}

// Load filter options
async function loadFilterOptions() {
    try {
        const [patientsResponse, appointmentsResponse, medicationsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/appointments'),
            apiCall('/medications')
        ]);
        
        // Load patients for filter
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            const patientSelect = document.getElementById('patientFilter');
            const options = patientsResponse.value.data.map(patient => 
                `<option value="${patient.id}">${patient.first_name} ${patient.last_name}</option>`
            ).join('');
            patientSelect.innerHTML = '<option value="">All Patients</option>' + options;
        }
        
        // Store appointments and medications for modal
        if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value.success) {
            appointments = appointmentsResponse.value.data;
        }
        
        if (medicationsResponse.status === 'fulfilled' && medicationsResponse.value.success) {
            medications = medicationsResponse.value.data;
        }
        
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

// Display prescriptions in table
function displayPrescriptions() {
    const tbody = document.getElementById('prescriptionsTableBody');
    const tableDiv = document.getElementById('prescriptionsTable');
    const noPrescriptions = document.getElementById('noPrescriptions');
    
    if (filteredPrescriptions.length === 0) {
        tableDiv.style.display = 'none';
        noPrescriptions.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noPrescriptions.style.display = 'none';
    
    tbody.innerHTML = filteredPrescriptions.map(prescription => {
        const prescribedDate = new Date(prescription.prescribed_date || prescription.created_at).toLocaleDateString();
        const appointmentDate = prescription.appointment_date ? 
            new Date(prescription.appointment_date).toLocaleDateString() : 'N/A';
        
        // Determine status badge color
        let statusBadge = '';
        switch(prescription.status) {
            case 'active':
                statusBadge = '<span class="badge bg-success">Active</span>';
                break;
            case 'completed':
                statusBadge = '<span class="badge bg-secondary">Completed</span>';
                break;
            case 'discontinued':
                statusBadge = '<span class="badge bg-warning">Discontinued</span>';
                break;
            default:
                statusBadge = '<span class="badge bg-info">Unknown</span>';
        }
        
        return `
            <tr>
                <td>
                    <div>
                        <strong>${prescription.patient_first_name} ${prescription.patient_last_name}</strong>
                        ${prescription.patient_phone ? `<br><small class="text-muted"><i class="bi bi-telephone"></i> ${prescription.patient_phone}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${prescription.medication_name}</strong>
                        ${prescription.medication_generic_name ? `<br><small class="text-muted">${prescription.medication_generic_name}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${prescription.dosage}</strong>
                        <br><small class="text-muted">${prescription.frequency}</small>
                    </div>
                </td>
                <td>
                    <span class="badge bg-primary">${prescription.duration}</span>
                </td>
                <td>
                    <div>
                        ${prescribedDate}
                        <br><small class="text-muted">Appt: ${appointmentDate}</small>
                    </div>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editPrescription('${prescription.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewPrescription('${prescription.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deletePrescription('${prescription.id}', '${prescription.patient_first_name} ${prescription.patient_last_name}', '${prescription.medication_name}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter prescriptions based on search and filters
function filterPrescriptions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const patientFilter = document.getElementById('patientFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    filteredPrescriptions = allPrescriptions.filter(prescription => {
        const matchesSearch = !searchTerm || 
            `${prescription.patient_first_name} ${prescription.patient_last_name}`.toLowerCase().includes(searchTerm) ||
            prescription.medication_name.toLowerCase().includes(searchTerm) ||
            (prescription.medication_generic_name && prescription.medication_generic_name.toLowerCase().includes(searchTerm)) ||
            (prescription.doctor_name && prescription.doctor_name.toLowerCase().includes(searchTerm));
        
        const matchesPatient = !patientFilter || prescription.patient_id === patientFilter;
        const matchesStatus = !statusFilter || prescription.status === statusFilter;
        
        return matchesSearch && matchesPatient && matchesStatus;
    });
    
    displayPrescriptions();
    updatePrescriptionCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('patientFilter').value = '';
    document.getElementById('statusFilter').value = '';
    filteredPrescriptions = [...allPrescriptions];
    displayPrescriptions();
    updatePrescriptionCount();
}

// Update prescription count badge
function updatePrescriptionCount() {
    document.getElementById('prescriptionCount').textContent = filteredPrescriptions.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new prescription
function openAddPrescriptionModal() {
    console.log('Opening add prescription modal');
    currentEditingId = null;
    
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> New Prescription';
    document.getElementById('savePrescriptionBtn').innerHTML = '<i class="bi bi-save"></i> Save Prescription';
    document.getElementById('prescriptionForm').reset();
    document.getElementById('prescriptionId').value = '';
    
    // Load appointments and medications into dropdowns
    loadAppointmentsDropdown();
    loadMedicationsDropdown();
    
    // Hide patient info card
    document.getElementById('patientInfoCard').style.display = 'none';
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Load appointments into dropdown
function loadAppointmentsDropdown() {
    const appointmentSelect = document.getElementById('appointmentId');
    if (appointments.length > 0) {
        const options = appointments
            .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
            .map(appointment => {
                const date = new Date(appointment.appointment_date).toLocaleDateString();
                return `<option value="${appointment.id}" data-patient-id="${appointment.patient_id}" data-patient-name="${appointment.patient_first_name} ${appointment.patient_last_name}" data-doctor-name="${appointment.doctor_first_name} ${appointment.doctor_last_name}" data-appointment-date="${date}">
                    ${appointment.patient_first_name} ${appointment.patient_last_name} - ${date}
                </option>`;
            }).join('');
        appointmentSelect.innerHTML = '<option value="">Select Appointment</option>' + options;
    }
}

// Load medications into dropdown
function loadMedicationsDropdown() {
    const medicationSelect = document.getElementById('medicationId');
    if (medications.length > 0) {
        const options = medications
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(medication => 
                `<option value="${medication.id}">${medication.name}${medication.generic_name ? ' (' + medication.generic_name + ')' : ''}</option>`
            ).join('');
        medicationSelect.innerHTML = '<option value="">Select Medication</option>' + options;
    }
}

// Update patient info when appointment is selected
function updatePatientInfo() {
    const appointmentSelect = document.getElementById('appointmentId');
    const selectedOption = appointmentSelect.options[appointmentSelect.selectedIndex];
    const infoCard = document.getElementById('patientInfoCard');
    
    if (selectedOption && selectedOption.value) {
        const patientName = selectedOption.getAttribute('data-patient-name');
        const doctorName = selectedOption.getAttribute('data-doctor-name');
        const appointmentDate = selectedOption.getAttribute('data-appointment-date');
        
        document.getElementById('selectedPatientInfo').textContent = patientName || 'N/A';
        document.getElementById('selectedDoctorInfo').textContent = doctorName || 'N/A';
        document.getElementById('selectedAppointmentDate').textContent = appointmentDate || 'N/A';
        
        infoCard.style.display = 'block';
    } else {
        infoCard.style.display = 'none';
    }
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('prescriptionForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
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

// Save prescription (create or update)
async function savePrescription() {
    console.log('Save prescription button clicked');
    const form = document.getElementById('prescriptionForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const appointmentId = document.getElementById('appointmentId');
    const medicationId = document.getElementById('medicationId');
    const dosage = document.getElementById('dosage');
    const frequency = document.getElementById('frequency');
    const duration = document.getElementById('duration');
    
    if (!appointmentId.value.trim()) {
        showFieldError(appointmentId, 'Please select an appointment');
        hasErrors = true;
    }
    
    if (!medicationId.value.trim()) {
        showFieldError(medicationId, 'Please select a medication');
        hasErrors = true;
    }
    
    if (!dosage.value.trim()) {
        showFieldError(dosage, 'Dosage is required');
        hasErrors = true;
    }
    
    if (!frequency.value.trim()) {
        showFieldError(frequency, 'Please select a frequency');
        hasErrors = true;
    }
    
    if (!duration.value.trim()) {
        showFieldError(duration, 'Duration is required');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const prescriptionData = {
        appointment_id: appointmentId.value.trim(),
        medication_id: medicationId.value.trim(),
        dosage: dosage.value.trim(),
        frequency: frequency.value.trim(),
        duration: duration.value.trim(),
        instructions: document.getElementById('instructions').value.trim() || null,
        status: document.getElementById('prescriptionStatus').value
    };
    
    console.log('Prescription data to save:', prescriptionData);
    
    try {
        const saveBtn = document.getElementById('savePrescriptionBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing prescription
            console.log('Updating prescription:', currentEditingId);
            response = await apiCall(`/prescriptions/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(prescriptionData)
            });
        } else {
            // Create new prescription
            console.log('Creating new prescription');
            response = await apiCall('/prescriptions', {
                method: 'POST',
                body: JSON.stringify(prescriptionData)
            });
        }
        
        console.log('Save response:', response);
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('prescriptionModal')).hide();
            loadPrescriptions(); // Reload the prescription list
            loadPrescriptionStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to save prescription', 'danger');
        }
    } catch (error) {
        console.error('Error saving prescription:', error);
        showAlert('Error saving prescription: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('savePrescriptionBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Prescription' : 
            '<i class="bi bi-save"></i> Save Prescription';
    }
}

// Edit prescription
async function editPrescription(id) {
    try {
        console.log('Editing prescription with ID:', id);
        const response = await apiCall(`/prescriptions/${id}`);
        
        if (response.success) {
            const prescription = response.data;
            console.log('Received prescription data for editing:', prescription);
            currentEditingId = id;
            
            // Load dropdowns first
            loadAppointmentsDropdown();
            loadMedicationsDropdown();
            
            // Small delay to ensure dropdowns are loaded
            setTimeout(() => {
                // Populate form
                document.getElementById('prescriptionId').value = prescription.id;
                document.getElementById('appointmentId').value = prescription.appointment_id || '';
                document.getElementById('medicationId').value = prescription.medication_id || '';
                document.getElementById('dosage').value = prescription.dosage || '';
                document.getElementById('frequency').value = prescription.frequency || '';
                document.getElementById('duration').value = prescription.duration || '';
                document.getElementById('instructions').value = prescription.instructions || '';
                document.getElementById('prescriptionStatus').value = prescription.status || 'active';
                
                // Update patient info
                updatePatientInfo();
                
                // Update modal title
                document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Prescription';
                document.getElementById('savePrescriptionBtn').innerHTML = '<i class="bi bi-save"></i> Update Prescription';
                
                // Clear validation states and show modal
                clearAllFieldErrors();
                new bootstrap.Modal(document.getElementById('prescriptionModal')).show();
            }, 100);
        }
    } catch (error) {
        showAlert('Error loading prescription details: ' + error.message, 'danger');
    }
}

// View prescription details (placeholder for future enhancement)
function viewPrescription(id) {
    showAlert('Prescription details view will be implemented next', 'info');
    // TODO: Implement detailed prescription view with full history
}

// Delete prescription
async function deletePrescription(id, patientName, medicationName) {
    if (!confirm(`Are you sure you want to delete the prescription for "${medicationName}" prescribed to "${patientName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/prescriptions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadPrescriptions(); // Reload the prescription list
            loadPrescriptionStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to delete prescription', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting prescription: ' + error.message, 'danger');
    }
}