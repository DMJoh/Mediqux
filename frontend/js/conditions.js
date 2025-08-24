// Medical conditions management JavaScript

let allConditions = [];
let filteredConditions = [];
let currentEditingId = null;

// Make functions globally available
window.saveCondition = saveCondition;
window.editCondition = editCondition;
window.deleteCondition = deleteCondition;
window.viewCondition = viewCondition;
window.openAddConditionModal = openAddConditionModal;
window.clearFilters = clearFilters;

// Initialize conditions page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('conditionsTableBody')) {
        console.log('Initializing conditions page...');
        loadConditions();
        loadConditionStats();
        loadCategoryFilter();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterConditions);
    document.getElementById('categoryFilter').addEventListener('change', filterConditions);
    document.getElementById('severityFilter').addEventListener('change', filterConditions);
    
    // ICD code validation
    document.getElementById('icdCode').addEventListener('input', validateIcdCode);
}

// ICD code validation - basic format check
function validateIcdCode(event) {
    const input = event.target;
    const value = input.value.trim().toUpperCase();
    
    // Basic ICD-10 format: Letter followed by numbers and optionally dots and more characters
    if (value && !value.match(/^[A-Z]\d{2}(\.\d+)?$/)) {
        showFieldError(input, 'ICD code should follow format: A12 or A12.34');
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

// Load all conditions
async function loadConditions() {
    console.log('Loading conditions...');
    try {
        showLoading(true);
        const response = await apiCall('/conditions');
        console.log('Conditions response:', response);
        
        if (response.success) {
            allConditions = response.data;
            filteredConditions = [...allConditions];
            displayConditions();
            updateConditionCount();
            console.log(`Loaded ${allConditions.length} conditions`);
        } else {
            console.error('Failed to load conditions:', response.error);
            showAlert('Failed to load conditions: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading conditions:', error);
        showAlert('Error loading conditions: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allConditions = [];
        filteredConditions = [];
        displayConditions();
        updateConditionCount();
    } finally {
        showLoading(false);
    }
}

// Load condition statistics
async function loadConditionStats() {
    try {
        const response = await apiCall('/conditions/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalConditionsCount').textContent = stats.total_conditions || 0;
            document.getElementById('categoriesCount').textContent = stats.total_categories || 0;
            document.getElementById('withIcdCount').textContent = stats.with_icd_codes || 0;
            document.getElementById('highSeverityCount').textContent = stats.high_severity || 0;
        }
    } catch (error) {
        console.error('Error loading condition stats:', error);
        // Set defaults
        document.getElementById('totalConditionsCount').textContent = '0';
        document.getElementById('categoriesCount').textContent = '0';
        document.getElementById('withIcdCount').textContent = '0';
        document.getElementById('highSeverityCount').textContent = '0';
    }
}

// Load category filter options
async function loadCategoryFilter() {
    try {
        const response = await apiCall('/conditions/categories/list');
        if (response.success) {
            const categorySelect = document.getElementById('categoryFilter');
            const options = response.data.map(item => 
                `<option value="${item.category}">${item.category} (${item.count})</option>`
            ).join('');
            categorySelect.innerHTML = '<option value="">All Categories</option>' + options;
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Set default empty options to prevent errors
        const categorySelect = document.getElementById('categoryFilter');
        categorySelect.innerHTML = '<option value="">All Categories</option>';
    }
}

// Display conditions in table
function displayConditions() {
    const tbody = document.getElementById('conditionsTableBody');
    const tableDiv = document.getElementById('conditionsTable');
    const noConditions = document.getElementById('noConditions');
    
    if (filteredConditions.length === 0) {
        tableDiv.style.display = 'none';
        noConditions.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noConditions.style.display = 'none';
    
    tbody.innerHTML = filteredConditions.map(condition => {
        // Severity badge styling
        let severityBadge = '';
        switch (condition.severity) {
            case 'High':
                severityBadge = '<span class="badge bg-danger">High</span>';
                break;
            case 'Medium':
                severityBadge = '<span class="badge bg-warning text-dark">Medium</span>';
                break;
            case 'Low':
                severityBadge = '<span class="badge bg-success">Low</span>';
                break;
            default:
                severityBadge = '<span class="badge bg-secondary">Not Set</span>';
        }
        
        const usageCount = parseInt(condition.usage_count) || 0;
        
        return `
            <tr>
                <td>
                    <strong>${condition.name}</strong>
                    ${condition.description ? `<br><small class="text-muted">${condition.description.substring(0, 100)}${condition.description.length > 100 ? '...' : ''}</small>` : ''}
                </td>
                <td>
                    ${condition.icd_code ? `<code class="bg-light px-2 py-1 rounded">${condition.icd_code}</code>` : '<small class="text-muted">Not set</small>'}
                </td>
                <td>
                    ${condition.category ? `<span class="badge bg-info">${condition.category}</span>` : '<small class="text-muted">Uncategorized</small>'}
                </td>
                <td>
                    ${severityBadge}
                </td>
                <td>
                    <span class="badge bg-light text-dark">${usageCount} usage${usageCount !== 1 ? 's' : ''}</span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editCondition('${condition.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-info" onclick="viewCondition('${condition.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteCondition('${condition.id}', '${condition.name.replace(/'/g, "\\'")}', ${usageCount})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter conditions based on search and filters
function filterConditions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const severityFilter = document.getElementById('severityFilter').value;
    
    filteredConditions = allConditions.filter(condition => {
        const matchesSearch = !searchTerm || 
            condition.name.toLowerCase().includes(searchTerm) ||
            (condition.description && condition.description.toLowerCase().includes(searchTerm)) ||
            (condition.icd_code && condition.icd_code.toLowerCase().includes(searchTerm)) ||
            (condition.category && condition.category.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || condition.category === categoryFilter;
        const matchesSeverity = !severityFilter || condition.severity === severityFilter;
        
        return matchesSearch && matchesCategory && matchesSeverity;
    });
    
    displayConditions();
    updateConditionCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('severityFilter').value = '';
    filteredConditions = [...allConditions];
    displayConditions();
    updateConditionCount();
}

// Update condition count badge
function updateConditionCount() {
    document.getElementById('conditionCount').textContent = filteredConditions.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open modal for adding new condition
function openAddConditionModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Add Medical Condition';
    document.getElementById('saveConditionBtn').innerHTML = '<i class="bi bi-save"></i> Save Condition';
    document.getElementById('conditionForm').reset();
    document.getElementById('conditionId').value = '';
    
    // Clear any previous validation states
    clearAllFieldErrors();
}

// Clear all field errors
function clearAllFieldErrors() {
    const form = document.getElementById('conditionForm');
    const inputs = form.querySelectorAll('.form-control, .form-select');
    inputs.forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
    });
}

// Edit condition
async function editCondition(id) {
    try {
        const response = await apiCall(`/conditions/${id}`);
        
        if (response.success) {
            const condition = response.data;
            currentEditingId = id;
            
            // Populate form
            document.getElementById('conditionId').value = condition.id;
            document.getElementById('name').value = condition.name || '';
            document.getElementById('description').value = condition.description || '';
            document.getElementById('icdCode').value = condition.icd_code || '';
            document.getElementById('category').value = condition.category || '';
            document.getElementById('severity').value = condition.severity || '';
            
            // Update modal title
            document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Medical Condition';
            document.getElementById('saveConditionBtn').innerHTML = '<i class="bi bi-save"></i> Update Condition';
            
            // Clear validation states and show modal
            clearAllFieldErrors();
            new bootstrap.Modal(document.getElementById('conditionModal')).show();
        }
    } catch (error) {
        showAlert('Error loading condition details: ' + error.message, 'danger');
    }
}

// Save condition (create or update)
async function saveCondition() {
    console.log('Save condition button clicked');
    const form = document.getElementById('conditionForm');
    
    // Clear all previous validation states
    clearAllFieldErrors();
    
    let hasErrors = false;
    
    // Validate required fields
    const name = document.getElementById('name');
    
    if (!name.value.trim()) {
        showFieldError(name, 'Condition name is required');
        hasErrors = true;
    }
    
    // Validate ICD code format if provided
    const icdCode = document.getElementById('icdCode');
    if (icdCode.value.trim() && !icdCode.value.trim().match(/^[A-Z]\d{2}(\.\d+)?$/i)) {
        showFieldError(icdCode, 'ICD code should follow format: A12 or A12.34');
        hasErrors = true;
    }
    
    // If there are validation errors, stop here
    if (hasErrors) {
        return;
    }
    
    const conditionData = {
        name: name.value.trim(),
        description: document.getElementById('description').value.trim() || null,
        icd_code: icdCode.value.trim().toUpperCase() || null,
        category: document.getElementById('category').value || null,
        severity: document.getElementById('severity').value || null
    };
    
    console.log('Condition data to save:', conditionData);
    
    try {
        const saveBtn = document.getElementById('saveConditionBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            // Update existing condition
            console.log('Updating condition:', currentEditingId);
            response = await apiCall(`/conditions/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(conditionData)
            });
        } else {
            // Create new condition
            console.log('Creating new condition');
            response = await apiCall('/conditions', {
                method: 'POST',
                body: JSON.stringify(conditionData)
            });
        }
        
        console.log('Save response:', response);
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('conditionModal')).hide();
            loadConditions(); // Reload the condition list
            loadConditionStats(); // Reload stats
            loadCategoryFilter(); // Reload category filter
        } else {
            showAlert(response.error || 'Failed to save condition', 'danger');
        }
    } catch (error) {
        console.error('Error saving condition:', error);
        showAlert('Error saving condition: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveConditionBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Condition' : 
            '<i class="bi bi-save"></i> Save Condition';
    }
}

// View condition details (placeholder for future enhancement)
function viewCondition(id) {
    showAlert('Condition details view will be implemented next', 'info');
    // TODO: Implement detailed condition view with usage statistics
}

// Delete condition
async function deleteCondition(id, name, usageCount) {
    if (usageCount > 0) {
        showAlert(`Cannot delete "${name}" because it is referenced in ${usageCount} appointment(s). Please update those appointments first.`, 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/conditions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadConditions(); // Reload the condition list
            loadConditionStats(); // Reload stats
            loadCategoryFilter(); // Reload category filter
        } else {
            showAlert(response.error || 'Failed to delete condition', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting condition: ' + error.message, 'danger');
    }
}