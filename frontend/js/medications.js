// Medication management JavaScript

let allMedications = [];
let filteredMedications = [];
let currentEditingId = null;
let selectedForms = [];
let selectedStrengths = [];

// Make functions globally available
window.saveMedication = saveMedication;
window.editMedication = editMedication;
window.deleteMedication = deleteMedication;
window.viewMedication = viewMedication;
window.openAddMedicationModal = openAddMedicationModal;
window.clearFilters = clearFilters;
window.addDosageForm = addDosageForm;
window.addStrength = addStrength;
window.removeDosageForm = removeDosageForm;
window.removeStrength = removeStrength;

// Initialize medications page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('medicationsTableBody')) {
        console.log('Initializing medications page...');
        loadMedications();
        loadMedicationStats();
        loadFilterOptions();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterMedications);
    document.getElementById('dosageFormFilter').addEventListener('change', filterMedications);
    document.getElementById('manufacturerFilter').addEventListener('change', filterMedications);
    
    // Enter key support for adding forms and strengths
    document.getElementById('strengthInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addStrength();
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

// Load all medications
async function loadMedications() {
    console.log('Loading medications...');
    try {
        showLoading(true);
        const response = await apiCall('/medications');
        console.log('Medications response:', response);
        
        if (response.success) {
            allMedications = response.data;
            filteredMedications = [...allMedications];
            displayMedications();
            updateMedicationCount();
            console.log(`Loaded ${allMedications.length} medications`);
        } else {
            console.error('Failed to load medications:', response.error);
            showAlert('Failed to load medications: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading medications:', error);
        showAlert('Error loading medications: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allMedications = [];
        filteredMedications = [];
        displayMedications();
        updateMedicationCount();
    } finally {
        showLoading(false);
    }
}

// Load medication statistics
async function loadMedicationStats() {
    try {
        const response = await apiCall('/medications/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalMedicationsCount').textContent = stats.total_medications || 0;
            document.getElementById('manufacturersCount').textContent = stats.total_manufacturers || 0;
            document.getElementById('genericNamesCount').textContent = stats.with_generic_names || 0;
            document.getElementById('multipleFormsCount').textContent = stats.multiple_forms || 0;
        }
    } catch (error) {
        console.error('Error loading medication stats:', error);
        // Set defaults
        document.getElementById('totalMedicationsCount').textContent = '0';
        document.getElementById('manufacturersCount').textContent = '0';
        document.getElementById('genericNamesCount').textContent = '0';
        document.getElementById('multipleFormsCount').textContent = '0';
    }
}

// Load filter options
async function loadFilterOptions() {
    try {
        const [formsResponse, manufacturersResponse] = await Promise.allSettled([
            apiCall('/medications/forms/available'),
            apiCall('/medications/manufacturers/list')
        ]);
        
        // Load dosage forms
        if (formsResponse.status === 'fulfilled' && formsResponse.value.success) {
            const formSelect = document.getElementById('dosageFormFilter');
            const options = formsResponse.value.data.map(form => 
                `<option value="${form}">${form}</option>`
            ).join('');
            formSelect.innerHTML = '<option value="">All Dosage Forms</option>' + options;
        }
        
        // Load manufacturers
        if (manufacturersResponse.status === 'fulfilled' && manufacturersResponse.value.success) {
            const manufacturerSelect = document.getElementById('manufacturerFilter');
            const options = manufacturersResponse.value.data.map(item => 
                `<option value="${item.manufacturer}">${item.manufacturer} (${item.count})</option>`
            ).join('');
            manufacturerSelect.innerHTML = '<option value="">All Manufacturers</option>' + options;
        }
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

// Display medications in table
function displayMedications() {
    const tbody = document.getElementById('medicationsTableBody');
    const tableDiv = document.getElementById('medicationsTable');
    const noMedications = document.getElementById('noMedications');
    
    if (filteredMedications.length === 0) {
        tableDiv.style.display = 'none';
        noMedications.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noMedications.style.display = 'none';
    
    tbody.innerHTML = filteredMedications.map(medication => {
        const prescriptionCount = parseInt(medication.prescription_count) || 0;
        const patientMedicationCount = parseInt(medication.patient_medication_count) || 0;
        const totalUsage = prescriptionCount + patientMedicationCount;
        
        // Format dosage forms
        const forms = medication.dosage_forms || [];
        const formsDisplay = forms.length > 0 
            ? forms.map(form => `<span class="badge bg-secondary me-1">${form}</span>`).join('')
            : '<small class="text-muted">Not specified</small>';
        
        // Format strengths
        const strengths = medication.strengths || [];
        const strengthsDisplay = strengths.length > 0 
            ? '<br>' + strengths.map(strength => `<small class="text-muted">${strength}</small>`).join(', ')
            : '';
        
        return `
            <tr>
                <td>
                    <strong>${medication.name}</strong>
                    ${medication.description ? `<br><small class="text-muted">${medication.description.substring(0, 80)}${medication.description.length > 80 ? '...' : ''}</small>` : ''}
                </td>
                <td>
                    ${medication.generic_name || '<small class="text-muted">Not specified</small>'}
                </td>
                <td>
                    ${formsDisplay}
                    ${strengthsDisplay}
                </td>
                <td>
                    ${medication.manufacturer || '<small class="text-muted">Not specified</small>'}
                </td>
                <td>
                    <span class="badge bg-light text-dark">${totalUsage} usage${totalUsage !== 1 ? 's' : ''}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editMedication('${medication.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewMedication('${medication.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteMedication('${medication.id}', '${medication.name.replace(/'/g, "\\'")}', ${totalUsage})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter medications based on search and filters
function filterMedications() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dosageFormFilter = document.getElementById('dosageFormFilter').value;
    const manufacturerFilter = document.getElementById('manufacturerFilter').value;
    
    filteredMedications = allMedications.filter(medication => {
        const matchesSearch = !searchTerm || 
            medication.name.toLowerCase().includes(searchTerm) ||
            (medication.generic_name && medication.generic_name.toLowerCase().includes(searchTerm)) ||
            (medication.manufacturer && medication.manufacturer.toLowerCase().includes(searchTerm)) ||
            (medication.description && medication.description.toLowerCase().includes(searchTerm));
        
        const matchesDosageForm = !dosageFormFilter || 
            (medication.dosage_forms && medication.dosage_forms.includes(dosageFormFilter));
        
        const matchesManufacturer = !manufacturerFilter || 
            (medication.manufacturer && medication.manufacturer.includes(manufacturerFilter));
        
        return matchesSearch && matchesDosageForm && matchesManufacturer;
    });
    
    displayMedications();
    updateMedicationCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('dosageFormFilter').value = '';
    document.getElementById('manufacturerFilter').value = '';
    filteredMedications = [...allMedications];
    displayMedications();
    updateMedicationCount();
}

// Update medication count badge
function updateMedicationCount() {
    document.getElementById('medicationCount').textContent = filteredMedications.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Add dosage form
function addDosageForm() {
    const select = document.getElementById('dosageFormSelect');
    const value = select.value.trim();
    
    if (value && !selectedForms.includes(value)) {
        selectedForms.push(value);
        updateSelectedForms();
        select.value = '';
    }
}

// Remove dosage form
function removeDosageForm(form) {
    selectedForms = selectedForms.filter(f => f !== form);
    updateSelectedForms();
}

// Update selected forms display
function updateSelectedForms() {
    const container = document.getElementById('selectedForms');
    const hiddenInput = document.getElementById('dosageForms');
    
    container.innerHTML = selectedForms.map(form => 
        `<span class="badge bg-primary me-1 mb-1">
            ${form}
            <button type="button" class="btn-close btn-close-white ms-1" onclick="removeDosageForm('${form}')" style="font-size: 0.7em;"></button>
         </span>`
    ).join('');
    
    hiddenInput.value = JSON.stringify(selectedForms);
}

// Add strength
function addStrength() {
    const input = document.getElementById('strengthInput');
    const value = input.value.trim();
    
    if (value && !selectedStrengths.includes(value)) {
        selectedStrengths.push(value);
        updateSelectedStrengths();
        input.value = '';
    }
}

// Remove strength
function removeStrength(strength) {
    selectedStrengths = selectedStrengths.filter(s => s !== strength);
    updateSelectedStrengths();
}

// Update selected strengths display
function updateSelectedStrengths() {
    const container = document.getElementById('selectedStrengths');
    const hiddenInput = document.getElementById('strengths');
    
    container.innerHTML = selectedStrengths.map(strength => 
        `<span class="badge bg-info me-1 mb-1">
            ${strength}
            <button type="button" class="btn-close btn-close-white ms-1" onclick="removeStrength('${strength}')" style="font-size: 0.7em;"></button>
         </span>`
    ).join('');
    
    hiddenInput.value = JSON.stringify(selectedStrengths);
}

// Open modal for adding new medication
function openAddMedicationModal() {
    currentEditingId = null;
    selectedForms = [];
    selectedStrengths = [];
    
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add Medication';
    document.getElementById('saveMedicationBtn').innerHTML = '<i class="bi bi-save"></i> Save Medication';
    document.getElementById('medicationForm').reset();
    document.getElementById('medicationId').value = '';
    
    updateSelectedForms();
    updateSelectedStrengths();
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('medicationForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// Edit medication
async function editMedication(id) {
    try {
        const response = await apiCall(`/medications/${id}`);
        
        if (response.success) {
            const medication = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('medicationId').value = medication.id;
            document.getElementById('name').value = medication.name || '';
            document.getElementById('genericName').value = medication.generic_name || '';
            document.getElementById('manufacturer').value = medication.manufacturer || '';
            document.getElementById('description').value = medication.description || '';
            
            // Set selected forms and strengths
            selectedForms = medication.dosage_forms || [];
            selectedStrengths = medication.strengths || [];
            updateSelectedForms();
            updateSelectedStrengths();
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Medication';
            document.getElementById('saveMedicationBtn').innerHTML = '<i class="bi bi-save"></i> Update Medication';
            
            // Clear validation states and show modal
            clearAllFieldErrors();
            new bootstrap.Modal(document.getElementById('medicationModal')).show();
        }
    } catch (error) {
        showAlert('Error loading medication details: ' + error.message, 'danger');
    }
}

// Save medication (create or update)
async function saveMedication() {
    console.log('Save medication button clicked');
    const form = document.getElementById('medicationForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const name = document.getElementById('name');
    
    if (!name.value.trim()) {
        showFieldError(name, 'Medication name is required');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const medicationData = {
        name: name.value.trim(),
        generic_name: document.getElementById('genericName').value.trim() || null,
        dosage_forms: selectedForms,
        strengths: selectedStrengths,
        manufacturer: document.getElementById('manufacturer').value.trim() || null,
        description: document.getElementById('description').value.trim() || null
    };
    
    console.log('Medication data to save:', medicationData);
    
    try {
        const saveBtn = document.getElementById('saveMedicationBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing medication
            console.log('Updating medication:', currentEditingId);
            response = await apiCall(`/medications/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(medicationData)
            });
        } else {
            // Create new medication
            console.log('Creating new medication');
            response = await apiCall('/medications', {
                method: 'POST',
                body: JSON.stringify(medicationData)
            });
        }
        
        console.log('Save response:', response);
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('medicationModal')).hide();
            loadMedications(); // Reload the medication list
            loadMedicationStats(); // Reload stats
            loadFilterOptions(); // Reload filter options
        } else {
            showAlert(response.error || 'Failed to save medication', 'danger');
        }
    } catch (error) {
        console.error('Error saving medication:', error);
        showAlert('Error saving medication: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveMedicationBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Medication' : 
            '<i class="bi bi-save"></i> Save Medication';
    }
}

// View medication details (placeholder for future enhancement)
function viewMedication(id) {
    showAlert('Medication details view will be implemented next', 'info');
    // TODO: Implement detailed medication view with prescription history
}

// Delete medication
async function deleteMedication(id, name, usageCount) {
    if (usageCount > 0) {
        showAlert(`Cannot delete "${name}" because it is referenced in ${usageCount} prescription(s) or patient medication record(s). Please remove these references first.`, 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/medications/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadMedications(); // Reload the medication list
            loadMedicationStats(); // Reload stats
            loadFilterOptions(); // Reload filter options
        } else {
            showAlert(response.error || 'Failed to delete medication', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting medication: ' + error.message, 'danger');
    }
}