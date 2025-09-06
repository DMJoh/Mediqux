// Medication management JavaScript

let allMedications = [];
let filteredMedications = [];
let currentEditingId = null;
let selectedForms = [];
let selectedStrengths = [];
let activeIngredients = [];

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
window.addIngredient = addIngredient;
window.removeIngredient = removeIngredient;

// Initialize medications page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('medicationsTableBody')) {
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
    
    // Enter key support for adding ingredients
    document.getElementById('ingredientName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('ingredientDosage').focus();
        }
    });
    
    document.getElementById('ingredientDosage').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addIngredient();
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
    try {
        showLoading(true);
        const response = await apiCall('/medications');
        
        if (response.success) {
            allMedications = response.data;
            filteredMedications = [...allMedications];
            displayMedications();
            updateMedicationCount();
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
        
        // Determine the actual usage - prescriptions automatically create patient_medications
        let usageDisplay = '';
        if (prescriptionCount > 0) {
            usageDisplay = `${prescriptionCount} prescription${prescriptionCount !== 1 ? 's' : ''}`;
            if (patientMedicationCount > prescriptionCount) {
                // Patient has additional medications not from prescriptions
                const additionalMeds = patientMedicationCount - prescriptionCount;
                usageDisplay += `, ${additionalMeds} additional`;
            }
        } else if (patientMedicationCount > 0) {
            usageDisplay = `${patientMedicationCount} patient record${patientMedicationCount !== 1 ? 's' : ''}`;
        } else {
            usageDisplay = '0 usages';
        }
        
        const totalUsage = Math.max(prescriptionCount, patientMedicationCount);
        
        // Format dosage forms
        const forms = medication.dosage_forms || [];
        const formsDisplay = forms.length > 0 
            ? forms.map(form => `<span class="badge bg-secondary me-1 mb-1">${form}</span>`).join('')
            : '';
        
        // Format active ingredients
        let ingredients = medication.active_ingredients || [];
        
        // Handle case where active_ingredients comes back as a string (JSONB)
        if (typeof ingredients === 'string') {
            try {
                ingredients = JSON.parse(ingredients);
            } catch (e) {
                ingredients = [];
            }
        }
        
        // Ensure ingredients is always an array
        if (!Array.isArray(ingredients)) {
            ingredients = [];
        }
        
        // Format overall strengths
        const strengths = medication.strengths || [];
        
        // Combine all strength/form information
        let combinedDisplay = '';
        
        // Always show dosage forms first - make them more prominent
        if (forms.length > 0) {
            combinedDisplay += '<div class="mb-2">';
            combinedDisplay += '<small class="text-muted d-block"><i class="bi bi-prescription2"></i> Forms:</small>';
            combinedDisplay += '<div class="mt-1">' + formsDisplay + '</div>';
            combinedDisplay += '</div>';
        }
        
        // Show active ingredients if available
        if (ingredients.length > 0) {
            combinedDisplay += '<div class="mt-2">';
            combinedDisplay += '<small class="text-muted d-block"><i class="bi bi-capsule"></i> Contents:</small>';
            combinedDisplay += ingredients.map(ing => 
                `<small class="text-success d-block ms-2">• ${ing.name}: <strong>${ing.dosage}</strong></small>`
            ).join('');
            combinedDisplay += '</div>';
        }
        
        // Show overall strengths if available (and different from ingredients)
        if (strengths.length > 0) {
            combinedDisplay += '<div class="mt-2">';
            combinedDisplay += '<small class="text-muted d-block"><i class="bi bi-info-circle"></i> Overall:</small>';
            combinedDisplay += strengths.map(strength => 
                `<small class="text-primary d-block ms-2"><strong>${strength}</strong></small>`
            ).join('');
            combinedDisplay += '</div>';
        }
        
        // If nothing is specified
        if (!forms.length && !ingredients.length && !strengths.length) {
            combinedDisplay = '<small class="text-muted">Not specified</small>';
        }
        
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
                    ${combinedDisplay}
                </td>
                <td>
                    ${medication.manufacturer || '<small class="text-muted">Not specified</small>'}
                </td>
                <td>
                    <span class="badge bg-secondary">${usageDisplay}</span>
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

// Add active ingredient
function addIngredient() {
    const nameInput = document.getElementById('ingredientName');
    const dosageInput = document.getElementById('ingredientDosage');
    
    const name = nameInput.value.trim();
    const dosage = dosageInput.value.trim();
    
    if (name && dosage) {
        // Check if ingredient already exists
        const existingIndex = activeIngredients.findIndex(ing => 
            ing.name.toLowerCase() === name.toLowerCase()
        );
        
        if (existingIndex >= 0) {
            // Update existing ingredient
            activeIngredients[existingIndex].dosage = dosage;
        } else {
            // Add new ingredient
            activeIngredients.push({ name, dosage });
        }
        
        updateSelectedIngredients();
        nameInput.value = '';
        dosageInput.value = '';
        nameInput.focus();
    }
}

// Remove active ingredient
function removeIngredient(name) {
    activeIngredients = activeIngredients.filter(ing => ing.name !== name);
    updateSelectedIngredients();
}

// Update selected ingredients display
function updateSelectedIngredients() {
    const container = document.getElementById('selectedIngredients');
    const hiddenInput = document.getElementById('activeIngredients');
    
    if (activeIngredients.length === 0) {
        container.innerHTML = '<small class="text-muted">No ingredients added yet</small>';
    } else {
        container.innerHTML = activeIngredients.map(ingredient => 
            `<div class="d-flex justify-content-between align-items-center p-2 mb-1 rounded border">
                <div>
                    <strong>${ingredient.name}</strong> - <span class="text-muted">${ingredient.dosage}</span>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeIngredient('${ingredient.name}')">
                    <i class="bi bi-trash"></i>
                </button>
             </div>`
        ).join('');
    }
    
    hiddenInput.value = JSON.stringify(activeIngredients);
}

// Open modal for adding new medication
function openAddMedicationModal() {
    currentEditingId = null;
    selectedForms = [];
    selectedStrengths = [];
    activeIngredients = [];
    
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add Medication';
    document.getElementById('saveMedicationBtn').innerHTML = '<i class="bi bi-save"></i> Save Medication';
    document.getElementById('medicationForm').reset();
    document.getElementById('medicationId').value = '';
    
    updateSelectedForms();
    updateSelectedStrengths();
    updateSelectedIngredients();
    
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
            
            // Set selected forms, strengths, and ingredients
            selectedForms = Array.isArray(medication.dosage_forms) ? [...medication.dosage_forms] : [];
            selectedStrengths = Array.isArray(medication.strengths) ? [...medication.strengths] : [];
            
            // Handle JSONB active_ingredients
            let ingredients = medication.active_ingredients || [];
            if (typeof ingredients === 'string') {
                try {
                    ingredients = JSON.parse(ingredients);
                } catch (e) {
                    ingredients = [];
                }
            }
            // Ensure ingredients is always an array
            if (!Array.isArray(ingredients)) {
                ingredients = [];
            }
            activeIngredients = [...ingredients];
            
            // Update all displays
            updateSelectedForms();
            updateSelectedStrengths();
            updateSelectedIngredients();
            
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
        dosage_forms: [...selectedForms], // Create a copy to avoid reference issues
        strengths: [...selectedStrengths],
        active_ingredients: [...activeIngredients],
        manufacturer: document.getElementById('manufacturer').value.trim() || null,
        description: document.getElementById('description').value.trim() || null
    };
    
    try {
        const saveBtn = document.getElementById('saveMedicationBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing medication
            response = await apiCall(`/medications/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(medicationData)
            });
        } else {
            // Create new medication
            response = await apiCall('/medications', {
                method: 'POST',
                body: JSON.stringify(medicationData)
            });
        }
        
        
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

// View medication details
async function viewMedication(id) {
    try {
        const response = await apiCall(`/medications/${id}`);
        
        if (response.success) {
            const medication = response.data;
            displayMedicationDetails(medication);
            
            // Setup edit button in details modal
            document.getElementById('editMedicationFromDetailsBtn').onclick = () => {
                bootstrap.Modal.getInstance(document.getElementById('medicationDetailsModal')).hide();
                setTimeout(() => editMedication(id), 300); // Small delay for smooth transition
            };
            
            // Show the details modal
            new bootstrap.Modal(document.getElementById('medicationDetailsModal')).show();
        } else {
            showAlert('Failed to load medication details: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading medication details:', error);
        showAlert('Error loading medication details: ' + error.message, 'danger');
    }
}

// Display medication details in modal
function displayMedicationDetails(medication) {
    const content = document.getElementById('medicationDetailsContent');
    const prescriptionCount = parseInt(medication.prescription_count) || 0;
    const patientMedicationCount = parseInt(medication.patient_medication_count) || 0;
    const totalUsage = prescriptionCount + patientMedicationCount;
    
    // Parse active ingredients if it's JSONB
    let activeIngredients = [];
    if (medication.active_ingredients) {
        try {
            activeIngredients = typeof medication.active_ingredients === 'string' 
                ? JSON.parse(medication.active_ingredients) 
                : medication.active_ingredients;
        } catch (e) {
            activeIngredients = [];
        }
    }
    
    content.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="card border-0">
                    <div class="card-body">
                        <h4 class="card-title text-primary">
                            <i class="bi bi-capsule"></i> ${medication.name}
                        </h4>
                        ${medication.type ? `<p class="mb-2"><span class="badge bg-info fs-6">${medication.type}</span></p>` : ''}
                        
                        ${medication.generic_name ? `
                        <div class="row mt-3">
                            <div class="col-sm-4 fw-semibold">Generic Name:</div>
                            <div class="col-sm-8">${medication.generic_name}</div>
                        </div>
                        ` : ''}
                        
                        ${medication.manufacturer ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Manufacturer:</div>
                            <div class="col-sm-8">${medication.manufacturer}</div>
                        </div>
                        ` : ''}
                        
                        ${activeIngredients.length > 0 ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Active Ingredients:</div>
                            <div class="col-sm-8">
                                ${activeIngredients.map(ingredient => 
                                    `<span class="badge bg-secondary me-2 mb-1">${ingredient}</span>`
                                ).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        ${medication.description ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Description:</div>
                            <div class="col-sm-8">
                                <div class="text-muted" style="max-height: 100px; overflow-y: auto;">
                                    ${medication.description}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${medication.side_effects ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Side Effects:</div>
                            <div class="col-sm-8">
                                <div class="text-muted" style="max-height: 100px; overflow-y: auto;">
                                    ${medication.side_effects}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Usage Statistics:</div>
                            <div class="col-sm-8">
                                <span class="badge bg-primary">${totalUsage} total usage${totalUsage !== 1 ? 's' : ''}</span>
                                ${totalUsage > 0 ? '<small class="text-muted d-block">Prescribed to patients</small>' : ''}
                            </div>
                        </div>
                        
                        ${medication.created_at ? `
                        <div class="row mt-2">
                            <div class="col-sm-4 fw-semibold">Created:</div>
                            <div class="col-sm-8">
                                <small class="text-muted">${formatDateTime(medication.created_at)}</small>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0"><i class="bi bi-info-circle"></i> Medication Information</h6>
                    </div>
                    <div class="card-body">
                        ${medication.strength ? `
                        <div class="mb-3">
                            <i class="bi bi-speedometer text-primary"></i>
                            <strong class="ms-2">Strength:</strong>
                            <div class="mt-1">${medication.strength}</div>
                        </div>
                        ` : ''}
                        
                        ${medication.dosage_form ? `
                        <div class="mb-3">
                            <i class="bi bi-capsule text-primary"></i>
                            <strong class="ms-2">Dosage Form:</strong>
                            <div class="mt-1">${medication.dosage_form}</div>
                        </div>
                        ` : ''}
                        
                        ${medication.route ? `
                        <div class="mb-3">
                            <i class="bi bi-arrow-right text-primary"></i>
                            <strong class="ms-2">Route:</strong>
                            <div class="mt-1">${medication.route}</div>
                        </div>
                        ` : ''}
                        
                        ${medication.prescription_required !== undefined ? `
                        <div class="mb-3">
                            <i class="bi bi-shield-check text-primary"></i>
                            <strong class="ms-2">Status:</strong>
                            <div class="mt-1">
                                <span class="badge bg-${medication.prescription_required ? 'warning' : 'success'}">
                                    ${medication.prescription_required ? 'Prescription Required' : 'Over-the-Counter'}
                                </span>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${!medication.strength && !medication.dosage_form && !medication.route ? `
                        <div class="text-center text-muted">
                            <i class="bi bi-info-circle"></i>
                            <p class="mb-0 mt-2">Additional information not available</p>
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