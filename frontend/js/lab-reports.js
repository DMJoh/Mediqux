// Lab Reports management JavaScript

let allReports = [];
let filteredReports = [];
let currentEditingId = null;
let patients = [];
let appointments = [];
let institutions = [];
let labValueCounter = 0;

// Utility function to escape HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Common lab test templates
const COMMON_TESTS = {
    CBC: [
        { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '12.0-15.0' },
        { name: 'Hematocrit', unit: '%', referenceRange: '36-45' },
        { name: 'WBC Count', unit: '/μL', referenceRange: '4000-10000' },
        { name: 'Platelet Count', unit: '/μL', referenceRange: '150000-450000' },
        { name: 'RBC Count', unit: 'million/μL', referenceRange: '4.0-5.2' }
    ],
    CMP: [
        { name: 'Glucose', unit: 'mg/dL', referenceRange: '70-100' },
        { name: 'BUN', unit: 'mg/dL', referenceRange: '7-20' },
        { name: 'Creatinine', unit: 'mg/dL', referenceRange: '0.6-1.2' },
        { name: 'Sodium', unit: 'mEq/L', referenceRange: '136-145' },
        { name: 'Potassium', unit: 'mEq/L', referenceRange: '3.5-5.0' },
        { name: 'Chloride', unit: 'mEq/L', referenceRange: '98-107' }
    ],
    Lipid: [
        { name: 'Total Cholesterol', unit: 'mg/dL', referenceRange: '<200' },
        { name: 'HDL Cholesterol', unit: 'mg/dL', referenceRange: '>40' },
        { name: 'LDL Cholesterol', unit: 'mg/dL', referenceRange: '<100' },
        { name: 'Triglycerides', unit: 'mg/dL', referenceRange: '<150' }
    ],
    Thyroid: [
        { name: 'TSH', unit: 'mIU/L', referenceRange: '0.4-4.0' },
        { name: 'T3', unit: 'ng/dL', referenceRange: '80-200' },
        { name: 'T4', unit: 'μg/dL', referenceRange: '4.5-12.0' }
    ],
    Liver: [
        { name: 'ALT', unit: 'U/L', referenceRange: '7-56' },
        { name: 'AST', unit: 'U/L', referenceRange: '10-40' },
        { name: 'Bilirubin Total', unit: 'mg/dL', referenceRange: '0.1-1.2' },
        { name: 'Alkaline Phosphatase', unit: 'U/L', referenceRange: '44-147' }
    ]
};

// Make functions globally available
window.uploadReport = uploadReport;
window.saveManualEntry = saveManualEntry;
window.editReport = editReport;
window.deleteReport = deleteReport;
window.viewLabValues = viewLabValues;
window.editLabValues = editLabValues;
window.openUploadModal = openUploadModal;
window.openManualEntryModal = openManualEntryModal;
window.clearFilters = clearFilters;
window.addLabValue = addLabValue;
window.removeLabValue = removeLabValue;
window.addCommonTest = addCommonTest;
window.viewPDF = viewPDF;
window.downloadPDF = downloadPDF;

// Initialize lab reports page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reportsTableBody')) {
        loadReports();
        loadReportStats();
        loadFilterOptions();
        setupEventListeners();
        
        // Set today's date as default for test dates
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('uploadTestDate').value = today;
        document.getElementById('manualTestDate').value = today;
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterReports);
    document.getElementById('patientFilter').addEventListener('change', filterReports);
    document.getElementById('testTypeFilter').addEventListener('change', filterReports);
    document.getElementById('dateRangeFilter').addEventListener('change', filterReports);
    
    // Patient selection change in upload modal
    document.getElementById('uploadPatientId').addEventListener('change', function() {
        loadAppointmentsForPatient(this.value, 'uploadAppointmentId');
    });
    
    // Patient selection change in manual entry modal
    document.getElementById('manualPatientId').addEventListener('change', function() {
        loadAppointmentsForPatient(this.value, 'manualAppointmentId');
    });
    
    // File upload change
    document.getElementById('pdfFile').addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            validateFileUpload(file);
        }
    });
}

// Load all reports
async function loadReports() {
    try {
        showLoading(true);
        const response = await apiCall('/test-results');
        
        if (response.success) {
            allReports = response.data;
            filteredReports = [...allReports];
            displayReports();
            updateReportCount();
        } else {
            console.error('Failed to load reports:', response.error);
            showAlert('Failed to load reports: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('Error loading reports: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allReports = [];
        filteredReports = [];
        displayReports();
        updateReportCount();
    } finally {
        showLoading(false);
    }
}

// Load report statistics
async function loadReportStats() {
    try {
        const response = await apiCall('/test-results/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalReportsCount').textContent = stats.total_reports || 0;
            document.getElementById('recentReportsCount').textContent = stats.recent_reports || 0;
            document.getElementById('uniquePatientsCount').textContent = stats.unique_patients || 0;
            document.getElementById('abnormalValuesCount').textContent = stats.abnormal_values || 0;
        }
    } catch (error) {
        console.error('Error loading report stats:', error);
        // Set defaults
        document.getElementById('totalReportsCount').textContent = '0';
        document.getElementById('recentReportsCount').textContent = '0';
        document.getElementById('uniquePatientsCount').textContent = '0';
        document.getElementById('abnormalValuesCount').textContent = '0';
    }
}

// Load filter options and dropdown data
async function loadFilterOptions() {
    try {
        const [patientsResponse, appointmentsResponse, institutionsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/appointments'),
            apiCall('/institutions')
        ]);
        
        // Load patients for filters and dropdowns
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            patients = patientsResponse.value.data;
            populatePatientDropdowns();
        }
        
        // Store appointments for later use
        if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value.success) {
            appointments = appointmentsResponse.value.data;
        }
        
        // Load institutions
        if (institutionsResponse.status === 'fulfilled' && institutionsResponse.value.success) {
            institutions = institutionsResponse.value.data;
            populateInstitutionDropdowns();
        }
        
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

// Populate patient dropdowns
function populatePatientDropdowns() {
    const patientOptions = patients.map(patient => 
        `<option value="${patient.id}">${patient.first_name} ${patient.last_name}</option>`
    ).join('');
    
    // Filter dropdown
    document.getElementById('patientFilter').innerHTML = 
        '<option value="">All Patients</option>' + patientOptions;
    
    // Upload modal dropdown
    document.getElementById('uploadPatientId').innerHTML = 
        '<option value="">Select Patient</option>' + patientOptions;
    
    // Manual entry modal dropdown
    document.getElementById('manualPatientId').innerHTML = 
        '<option value="">Select Patient</option>' + patientOptions;
}

// Populate institution dropdowns
function populateInstitutionDropdowns() {
    const institutionOptions = institutions.map(inst => 
        `<option value="${inst.id}">${inst.name}</option>`
    ).join('');
    
    document.getElementById('uploadInstitutionId').innerHTML = 
        '<option value="">Select Institution</option>' + institutionOptions;
}

// Load appointments for selected patient
function loadAppointmentsForPatient(patientId, targetSelectId) {
    const targetSelect = document.getElementById(targetSelectId);
    
    if (!patientId) {
        targetSelect.innerHTML = '<option value="">No specific appointment</option>';
        return;
    }
    
    const patientAppointments = appointments.filter(apt => apt.patient_id === patientId);
    const options = patientAppointments
        .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
        .map(apt => {
            const date = new Date(apt.appointment_date).toLocaleDateString();
            return `<option value="${apt.id}">${date} - ${apt.type || 'Consultation'}</option>`;
        }).join('');
    
    targetSelect.innerHTML = '<option value="">No specific appointment</option>' + options;
}

// Display reports in table
function displayReports() {
    const tbody = document.getElementById('reportsTableBody');
    const tableDiv = document.getElementById('reportsTable');
    const noReports = document.getElementById('noReports');
    
    if (filteredReports.length === 0) {
        tableDiv.style.display = 'none';
        noReports.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noReports.style.display = 'none';
    
    tbody.innerHTML = filteredReports.map(report => {
        const testDate = new Date(report.test_date).toLocaleDateString();
        const createdDate = new Date(report.created_at).toLocaleDateString();
        
        // Format lab values preview
        let valuesPreview = '';
        if (report.lab_values && report.lab_values.length > 0) {
            const topValues = report.lab_values.slice(0, 3);
            valuesPreview = topValues.map(val => {
                const status = val.status ? `<span class="badge bg-${getStatusColor(val.status)} ms-1">${val.status}</span>` : '';
                return `<small class="d-block">${val.parameter_name}: <strong>${val.value} ${val.unit || ''}</strong>${status}</small>`;
            }).join('');
            
            if (report.lab_values.length > 3) {
                valuesPreview += `<small class="text-muted">+${report.lab_values.length - 3} more values</small>`;
            }
        } else if (report.structured_data && Object.keys(report.structured_data).length > 0) {
            valuesPreview = '<small class="text-info">Structured data available</small>';
        } else {
            valuesPreview = '<small class="text-muted">No structured values</small>';
        }
        
        // Determine overall status
        let overallStatus = 'normal';
        let statusBadge = '<span class="badge bg-success">Normal</span>';
        
        if (report.lab_values) {
            const abnormalValues = report.lab_values.filter(val => 
                val.status && val.status.toLowerCase() !== 'normal'
            );
            if (abnormalValues.length > 0) {
                overallStatus = 'abnormal';
                statusBadge = `<span class="badge bg-warning">Abnormal (${abnormalValues.length})</span>`;
            }
        }
        
        return `
            <tr>
                <td>
                    <div>
                        <strong>${report.patient_first_name} ${report.patient_last_name}</strong>
                        ${report.patient_phone ? `<br><small class="text-muted"><i class="bi bi-telephone"></i> ${report.patient_phone}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${report.test_name}</strong>
                        <br><small class="text-muted">${report.test_type || 'General'}</small>
                        ${report.institution_name ? `<br><small class="text-info"><i class="bi bi-building"></i> ${report.institution_name}</small>` : ''}
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${testDate}</strong>
                        <br><small class="text-muted">Added: ${createdDate}</small>
                    </div>
                </td>
                <td>
                    <div style="min-width: 200px;">
                        ${valuesPreview}
                    </div>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-info" onclick="viewLabValues('${report.id}')" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-primary" onclick="editReport('${report.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        ${report.pdf_file_path ? `
                            <button class="btn btn-outline-success" onclick="viewPDF('${report.id}')" title="View PDF">
                                <i class="bi bi-file-earmark-pdf"></i>
                            </button>
                            <button class="btn btn-outline-secondary" onclick="downloadPDF('${report.id}')" title="Download PDF">
                                <i class="bi bi-download"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline-danger" onclick="deleteReport('${report.id}', '${report.test_name}', '${report.patient_first_name} ${report.patient_last_name}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status color for badges
function getStatusColor(status) {
    switch(status?.toLowerCase()) {
        case 'normal': return 'success';
        case 'high': return 'warning';
        case 'low': return 'info';
        case 'critical': return 'danger';
        default: return 'secondary';
    }
}

// Filter reports based on search and filters
function filterReports() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const patientFilter = document.getElementById('patientFilter').value;
    const testTypeFilter = document.getElementById('testTypeFilter').value;
    const dateRangeFilter = document.getElementById('dateRangeFilter').value;
    
    filteredReports = allReports.filter(report => {
        const matchesSearch = !searchTerm || 
            `${report.patient_first_name} ${report.patient_last_name}`.toLowerCase().includes(searchTerm) ||
            report.test_name.toLowerCase().includes(searchTerm) ||
            (report.test_type && report.test_type.toLowerCase().includes(searchTerm)) ||
            (report.lab_values && report.lab_values.some(val => 
                val.parameter_name.toLowerCase().includes(searchTerm)
            ));
        
        const matchesPatient = !patientFilter || report.patient_id === patientFilter;
        const matchesTestType = !testTypeFilter || report.test_type === testTypeFilter;
        
        let matchesDateRange = true;
        if (dateRangeFilter) {
            const testDate = new Date(report.test_date);
            const now = new Date();
            const daysAgo = {
                'week': 7,
                'month': 30,
                '3months': 90,
                'year': 365
            };
            const cutoffDate = new Date(now.getTime() - (daysAgo[dateRangeFilter] * 24 * 60 * 60 * 1000));
            matchesDateRange = testDate >= cutoffDate;
        }
        
        return matchesSearch && matchesPatient && matchesTestType && matchesDateRange;
    });
    
    displayReports();
    updateReportCount();
}

// Clear all filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('patientFilter').value = '';
    document.getElementById('testTypeFilter').value = '';
    document.getElementById('dateRangeFilter').value = '';
    filteredReports = [...allReports];
    displayReports();
    updateReportCount();
}

// Update report count badge
function updateReportCount() {
    document.getElementById('reportCount').textContent = filteredReports.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open upload modal
function openUploadModal() {
    console.log('Opening upload modal');
    document.getElementById('uploadForm').reset();
    document.getElementById('processingStatus').style.display = 'none';
    document.getElementById('extractedValues').style.display = 'none';
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('uploadTestDate').value = today;
}

// Open manual entry modal
function openManualEntryModal() {
    console.log('Opening manual entry modal');
    currentEditingId = null;
    document.getElementById('manualEntryForm').reset();
    document.getElementById('manualTestResultId').value = '';
    document.getElementById('manualModalTitle').innerHTML = '<i class="bi bi-plus-circle"></i> Manual Lab Values Entry';
    
    // Clear lab values container and add one empty row
    const container = document.getElementById('labValuesContainer');
    container.innerHTML = '';
    labValueCounter = 0;
    addLabValue();
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('manualTestDate').value = today;
}

// Add lab value input row
function addLabValue(data = null) {
    const container = document.getElementById('labValuesContainer');
    const valueId = ++labValueCounter;
    
    const valueRow = document.createElement('div');
    valueRow.className = 'row mb-3 lab-value-row';
    valueRow.id = `labValue${valueId}`;
    
    valueRow.innerHTML = `
        <div class="col-md-3">
            <input type="text" class="form-control" name="parameterName[]" 
                   placeholder="Parameter (e.g., Glucose)" value="${data?.name || ''}" required>
        </div>
        <div class="col-md-2">
            <input type="number" step="0.001" class="form-control" name="parameterValue[]" 
                   placeholder="Value" value="${data?.value || ''}" required>
        </div>
        <div class="col-md-2">
            <input type="text" class="form-control" name="parameterUnit[]" 
                   placeholder="Unit" value="${data?.unit || ''}">
        </div>
        <div class="col-md-3">
            <input type="text" class="form-control" name="referenceRange[]" 
                   placeholder="Reference Range" value="${data?.referenceRange || ''}">
        </div>
        <div class="col-md-2">
            <div class="input-group">
                <select class="form-select" name="parameterStatus[]">
                    <option value="normal" ${data?.status === 'normal' ? 'selected' : ''}>Normal</option>
                    <option value="high" ${data?.status === 'high' ? 'selected' : ''}>High</option>
                    <option value="low" ${data?.status === 'low' ? 'selected' : ''}>Low</option>
                    <option value="critical" ${data?.status === 'critical' ? 'selected' : ''}>Critical</option>
                </select>
                <button type="button" class="btn btn-outline-danger" onclick="removeLabValue(${valueId})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(valueRow);
}

// Remove lab value row
function removeLabValue(valueId) {
    const element = document.getElementById(`labValue${valueId}`);
    if (element) {
        element.remove();
    }
}

// Add common test template
function addCommonTest(testType) {
    if (!COMMON_TESTS[testType]) return;
    
    // Clear existing values
    const container = document.getElementById('labValuesContainer');
    container.innerHTML = '';
    labValueCounter = 0;
    
    // Set test name
    document.getElementById('manualTestName').value = `${testType} Panel`;
    
    // Add all values for this test type
    COMMON_TESTS[testType].forEach(testData => {
        addLabValue(testData);
    });
}

// Validate file upload
function validateFileUpload(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf'];
    
    if (!allowedTypes.includes(file.type)) {
        showAlert('Please upload a PDF file only.', 'danger');
        document.getElementById('pdfFile').value = '';
        return false;
    }
    
    if (file.size > maxSize) {
        showAlert('File size must be less than 10MB.', 'danger');
        document.getElementById('pdfFile').value = '';
        return false;
    }
    
    return true;
}

// Upload and process report
async function uploadReport() {
    const form = document.getElementById('uploadForm');
    const formData = new FormData(form);
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const file = document.getElementById('pdfFile').files[0];
    if (!file || !validateFileUpload(file)) {
        return;
    }
    
    try {
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
        
        document.getElementById('processingStatus').style.display = 'block';
        
        // Use authenticated API call for file upload
        const response = await window.authManager.apiRequest('/test-results/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Check if we have suggested values from PDF parsing
            if (result.data.suggestedValues && result.data.suggestedValues.length > 0) {
                showSuggestedValuesModal(result.data);
            } else {
                // No suggestions - PDF saved successfully
                const message = result.data.parsingEnabled ? 
                    'PDF uploaded successfully. No lab values could be extracted automatically.' : 
                    'PDF uploaded successfully.';
                showAlert(message, 'success');
                bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
                loadReports();
                loadReportStats();
            }
        } else {
            showAlert(result.error || 'Failed to upload report', 'danger');
        }
    } catch (error) {
        console.error('Error uploading report:', error);
        showAlert('Error uploading report: ' + error.message, 'danger');
    } finally {
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="bi bi-cloud-upload"></i> Upload & Process';
        document.getElementById('processingStatus').style.display = 'none';
    }
}

// Display extracted values preview
function displayExtractedValues(extractedValues) {
    const container = document.getElementById('extractedValuesContent');
    container.innerHTML = extractedValues.map(val => 
        `<div class="d-flex justify-content-between align-items-center border-bottom py-1">
            <span><strong>${val.parameter}</strong>: ${val.value} ${val.unit || ''}</span>
            <span class="badge bg-${getStatusColor(val.status)}">${val.status || 'Normal'}</span>
        </div>`
    ).join('');
}

// Show suggested values modal after PDF upload
function showSuggestedValuesModal(uploadData) {
    
    // Hide upload modal
    bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
    
    // Store the upload data for later use
    window.currentUploadData = uploadData;
    
    // Populate suggested values in the review modal
    const container = document.getElementById('suggestedValuesContainer');
    const suggestedValues = uploadData.suggestedValues || [];
    
    if (suggestedValues.length === 0) {
        container.innerHTML = '<p class="text-muted">No lab values could be extracted from the PDF.</p>';
    } else {
        container.innerHTML = `
            <div class="alert alert-info mb-3">
                <i class="bi bi-info-circle"></i> 
                <strong>Extracted ${suggestedValues.length} potential lab values</strong><br>
                <small>Please review and edit these values before saving. You can accept, modify, or remove any suggestions.</small>
            </div>
            <div id="editableValuesContainer">
                ${suggestedValues.map((value, index) => createEditableValueRow(value, index)).join('')}
            </div>
            <div class="mt-3">
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="addEmptyValueRow()">
                    <i class="bi bi-plus"></i> Add Another Value
                </button>
            </div>
        `;
    }
    
    // Update modal title
    document.getElementById('suggestedValuesModalLabel').textContent = 
        `Review Extracted Values - ${uploadData.testName}`;
    
    // Show the suggested values modal
    const suggestedModal = new bootstrap.Modal(document.getElementById('suggestedValuesModal'));
    suggestedModal.show();
}

// Create an editable row for a suggested value
function createEditableValueRow(value, index) {
    const confidenceBadge = value.confidence ? 
        `<span class="badge bg-${getConfidenceColor(value.confidence)} ms-2" title="Extraction confidence">
            ${Math.round(value.confidence * 100)}%
        </span>` : '';
    
    const statusColor = getStatusColor(value.status || 'normal');
    
    return `
        <div class="card mb-2 suggested-value-row" data-index="${index}">
            <div class="card-body p-3">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <label class="form-label small">Parameter</label>
                        <input type="text" class="form-control form-control-sm" 
                               name="parameter_name_${index}" 
                               value="${escapeHtml(value.parameter_name || '')}" 
                               placeholder="Parameter name">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Value</label>
                        <input type="number" class="form-control form-control-sm" 
                               name="parameter_value_${index}" 
                               value="${value.value || ''}" 
                               step="0.01" 
                               placeholder="Value">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Unit</label>
                        <input type="text" class="form-control form-control-sm" 
                               name="parameter_unit_${index}" 
                               value="${escapeHtml(value.unit || '')}" 
                               placeholder="Unit">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Reference</label>
                        <input type="text" class="form-control form-control-sm" 
                               name="reference_range_${index}" 
                               value="${escapeHtml(value.reference_range || '')}" 
                               placeholder="Normal range">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Status</label>
                        <select class="form-control form-control-sm" name="parameter_status_${index}">
                            <option value="normal" ${value.status === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="low" ${value.status === 'low' ? 'selected' : ''}>Low</option>
                            <option value="high" ${value.status === 'high' ? 'selected' : ''}>High</option>
                            <option value="critical" ${value.status === 'critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                    <div class="col-md-1">
                        <label class="form-label small">&nbsp;</label>
                        <button type="button" class="btn btn-outline-danger btn-sm d-block" 
                                onclick="removeSuggestedValueRow(${index})" title="Remove this value">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="row mt-2">
                    <div class="col-12">
                        <small class="text-muted">
                            Extracted: "${escapeHtml(value.raw_match || '')}"
                            ${confidenceBadge}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Add an empty value row
function addEmptyValueRow() {
    const container = document.getElementById('editableValuesContainer');
    const index = container.children.length;
    const emptyValue = {
        parameter_name: '',
        value: '',
        unit: '',
        reference_range: '',
        status: 'normal',
        raw_match: 'Manually added'
    };
    
    container.insertAdjacentHTML('beforeend', createEditableValueRow(emptyValue, index));
}

// Remove a suggested value row
function removeSuggestedValueRow(index) {
    const row = document.querySelector(`[data-index="${index}"]`);
    if (row) {
        row.remove();
    }
}

// Get confidence color for badges
function getConfidenceColor(confidence) {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'secondary';
}

// Save suggested lab values after review
async function saveSuggestedValues() {
    if (!window.currentUploadData) {
        showAlert('No upload data found', 'danger');
        return;
    }
    
    try {
        const saveBtn = document.getElementById('saveSuggestedValuesBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        // Collect all edited values
        const labValues = [];
        const valueRows = document.querySelectorAll('.suggested-value-row');
        
        valueRows.forEach((row, index) => {
            const parameterName = row.querySelector(`[name="parameter_name_${index}"]`)?.value?.trim();
            const parameterValue = row.querySelector(`[name="parameter_value_${index}"]`)?.value?.trim();
            const unit = row.querySelector(`[name="parameter_unit_${index}"]`)?.value?.trim();
            const referenceRange = row.querySelector(`[name="reference_range_${index}"]`)?.value?.trim();
            const status = row.querySelector(`[name="parameter_status_${index}"]`)?.value;
            
            // Only include values with both name and value
            if (parameterName && parameterValue) {
                labValues.push({
                    parameter_name: parameterName,
                    value: parseFloat(parameterValue) || parameterValue,
                    unit: unit || null,
                    reference_range: referenceRange || null,
                    status: status || 'normal'
                });
            }
        });
        
        if (labValues.length === 0) {
            showAlert('Please add at least one lab value', 'warning');
            return;
        }
        
        // Save values to the test result
        const response = await window.authManager.apiRequest(`/test-results/${window.currentUploadData.id}/lab-values`, {
            method: 'POST',
            body: JSON.stringify({
                lab_values: labValues
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(`Successfully saved ${labValues.length} lab values`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('suggestedValuesModal')).hide();
            loadReports();
            loadReportStats();
        } else {
            showAlert(result.error || 'Failed to save lab values', 'danger');
        }
        
    } catch (error) {
        console.error('Error saving suggested values:', error);
        showAlert('Error saving lab values: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveSuggestedValuesBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check"></i> Save Lab Values';
    }
}

// Make functions globally available
window.showSuggestedValuesModal = showSuggestedValuesModal;
window.saveSuggestedValues = saveSuggestedValues;
window.addEmptyValueRow = addEmptyValueRow;
window.removeSuggestedValueRow = removeSuggestedValueRow;

// Save manual entry
async function saveManualEntry() {
    const form = document.getElementById('manualEntryForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Collect lab values
    const parameterNames = Array.from(document.getElementsByName('parameterName[]')).map(el => el.value);
    const parameterValues = Array.from(document.getElementsByName('parameterValue[]')).map(el => el.value);
    const parameterUnits = Array.from(document.getElementsByName('parameterUnit[]')).map(el => el.value);
    const referenceRanges = Array.from(document.getElementsByName('referenceRange[]')).map(el => el.value);
    const parameterStatuses = Array.from(document.getElementsByName('parameterStatus[]')).map(el => el.value);
    
    const labValues = parameterNames.map((name, index) => ({
        parameter_name: name,
        value: parseFloat(parameterValues[index]),
        unit: parameterUnits[index] || null,
        reference_range: referenceRanges[index] || null,
        status: parameterStatuses[index] || 'normal'
    })).filter(val => val.parameter_name && !isNaN(val.value));
    
    if (labValues.length === 0) {
        showAlert('Please add at least one lab value.', 'warning');
        return;
    }
    
    const testResultData = {
        patient_id: document.getElementById('manualPatientId').value,
        test_name: document.getElementById('manualTestName').value,
        test_type: 'Blood', // Default for manual entry
        test_date: document.getElementById('manualTestDate').value,
        lab_values: labValues
    };
    
    console.log('Manual entry data:', testResultData);
    
    try {
        const saveBtn = document.getElementById('saveManualBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            response = await apiCall(`/test-results/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(testResultData)
            });
        } else {
            response = await apiCall('/test-results', {
                method: 'POST',
                body: JSON.stringify(testResultData)
            });
        }
        
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('manualEntryModal')).hide();
            loadReports(); // Reload the reports list
            loadReportStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to save lab report', 'danger');
        }
    } catch (error) {
        console.error('Error saving manual entry:', error);
        showAlert('Error saving lab report: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveManualBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update Lab Report' : 
            '<i class="bi bi-save"></i> Save Lab Report';
    }
}

// View lab values details
async function viewLabValues(reportId) {
    try {
        const response = await apiCall(`/test-results/${reportId}`);
        if (response.success) {
            const report = response.data;
            displayLabValuesDetails(report);
            new bootstrap.Modal(document.getElementById('labValuesModal')).show();
        }
    } catch (error) {
        showAlert('Error loading lab values: ' + error.message, 'danger');
    }
}

// Display lab values in detail modal
function displayLabValuesDetails(report) {
    document.getElementById('labValuesModalTitle').innerHTML = 
        `<i class="bi bi-clipboard-data"></i> ${report.test_name} - ${report.patient_first_name} ${report.patient_last_name}`;
    
    let detailsHTML = `
        <div class="mb-3">
            <h6>Test Information</h6>
            <div class="row">
                <div class="col-md-6">
                    <small class="text-muted">Test Date:</small>
                    <div><strong>${new Date(report.test_date).toLocaleDateString()}</strong></div>
                </div>
                <div class="col-md-6">
                    <small class="text-muted">Test Type:</small>
                    <div><strong>${report.test_type || 'General'}</strong></div>
                </div>
            </div>
        </div>
    `;
    
    if (report.lab_values && report.lab_values.length > 0) {
        detailsHTML += `
            <div class="mb-3">
                <h6>Lab Values</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Parameter</th>
                                <th>Value</th>
                                <th>Reference Range</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.lab_values.map(val => `
                                <tr>
                                    <td><strong>${val.parameter_name}</strong></td>
                                    <td>${val.value} ${val.unit || ''}</td>
                                    <td><small class="text-muted">${val.reference_range || 'Not specified'}</small></td>
                                    <td><span class="badge bg-${getStatusColor(val.status)}">${val.status || 'Normal'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        detailsHTML += '<div class="alert alert-info">No structured lab values available.</div>';
    }
    
    if (report.extracted_text) {
        detailsHTML += `
            <div class="mb-3">
                <h6>Extracted Text</h6>
                <div class="border rounded p-3 bg-light" style="max-height: 200px; overflow-y: auto;">
                    <pre class="mb-0" style="white-space: pre-wrap; font-size: 0.85em;">${report.extracted_text}</pre>
                </div>
            </div>
        `;
    }
    
    document.getElementById('labValuesDetail').innerHTML = detailsHTML;
    
    // Store report ID for editing
    document.getElementById('editLabValuesBtn').setAttribute('data-report-id', report.id);
}

// Edit lab values
function editLabValues() {
    const reportId = document.getElementById('editLabValuesBtn').getAttribute('data-report-id');
    if (reportId) {
        editReport(reportId);
        bootstrap.Modal.getInstance(document.getElementById('labValuesModal')).hide();
    }
}

// Edit report (placeholder - will load report into manual entry modal)
async function editReport(reportId) {
    try {
        const response = await apiCall(`/test-results/${reportId}`);
        if (response.success) {
            const report = response.data;
            
            // Populate manual entry modal with existing data
            currentEditingId = reportId;
            document.getElementById('manualTestResultId').value = reportId;
            document.getElementById('manualPatientId').value = report.patient_id;
            document.getElementById('manualTestName').value = report.test_name;
            // Format date for HTML date input (YYYY-MM-DD)
            const testDate = new Date(report.test_date).toISOString().split('T')[0];
            document.getElementById('manualTestDate').value = testDate;
            document.getElementById('manualModalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Lab Values';
            
            // Clear and populate lab values
            const container = document.getElementById('labValuesContainer');
            container.innerHTML = '';
            labValueCounter = 0;
            
            if (report.lab_values && report.lab_values.length > 0) {
                report.lab_values.forEach(val => {
                    addLabValue({
                        name: val.parameter_name,
                        value: val.value,
                        unit: val.unit,
                        referenceRange: val.reference_range,
                        status: val.status
                    });
                });
            } else {
                addLabValue(); // Add one empty row
            }
            
            new bootstrap.Modal(document.getElementById('manualEntryModal')).show();
        }
    } catch (error) {
        showAlert('Error loading report for editing: ' + error.message, 'danger');
    }
}

// Delete report
async function deleteReport(reportId, testName, patientName) {
    if (!confirm(`Are you sure you want to delete the "${testName}" report for "${patientName}"?\n\nThis action cannot be undone and will also delete all associated lab values.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/test-results/${reportId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadReports(); // Reload the reports list
            loadReportStats(); // Reload stats
        } else {
            showAlert(response.error || 'Failed to delete report', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting report: ' + error.message, 'danger');
    }
}

// View PDF in browser with authentication
async function viewPDF(reportId) {
    try {
        const response = await window.authManager.apiRequest(`/test-results/${reportId}/view`);
        
        if (!response) {
            showAlert('Authentication failed', 'danger');
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showAlert(errorData.error || 'Failed to load PDF', 'danger');
            return;
        }
        
        // Get the PDF blob
        const blob = await response.blob();
        
        // Create object URL and open in new tab
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, '_blank');
        
        // Clean up the URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
        
    } catch (error) {
        console.error('Error viewing PDF:', error);
        showAlert('Error viewing PDF: ' + error.message, 'danger');
    }
}

// Download PDF with authentication
async function downloadPDF(reportId) {
    try {
        const response = await window.authManager.apiRequest(`/test-results/${reportId}/download`);
        
        if (!response) {
            showAlert('Authentication failed', 'danger');
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showAlert(errorData.error || 'Failed to download PDF', 'danger');
            return;
        }
        
        // Get the PDF blob
        const blob = await response.blob();
        
        // Get filename from response headers or use default
        let filename = 'lab-report.pdf';
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) {
                filename = match[1];
            }
        }
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showAlert('Error downloading PDF: ' + error.message, 'danger');
    }
}

// Panel Management Variables
let allPanels = [];
let currentEditingPanel = null;
let extractedPDFData = null;

// Panel Management Functions
window.openPanelManagementModal = openPanelManagementModal;
window.showCreatePanelForm = showCreatePanelForm;
window.hideCreatePanelForm = hideCreatePanelForm;
window.createNewPanel = createNewPanel;
window.selectPanel = selectPanel;
window.addParameterToPanel = addParameterToPanel;
window.hideAddParameterForm = hideAddParameterForm;
window.saveNewParameter = saveNewParameter;
window.editPanelParameter = editPanelParameter;
window.deletePanelParameter = deletePanelParameter;
window.savePanelChanges = savePanelChanges;
window.cancelPanelEdit = cancelPanelEdit;
window.deletePanel = deletePanel;

// PDF Review Functions
window.saveReviewedValues = saveReviewedValues;
window.addManualValueToReview = addManualValueToReview;
window.deleteReviewValue = deleteReviewValue;
window.updateReviewValue = updateReviewValue;

async function openPanelManagementModal() {
    try {
        await loadLabPanels();
        
        // Show default state
        document.getElementById('noPanelSelected').style.display = 'block';
        document.getElementById('createPanelForm').style.display = 'none';
        document.getElementById('editPanelForm').style.display = 'none';
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('panelManagementModal'));
        modal.show();
    } catch (error) {
        console.error('Error opening panel management modal:', error);
        showAlert('Error loading panel management: ' + error.message, 'danger');
    }
}

async function loadLabPanels() {
    try {
        const response = await window.authManager.apiRequest('/test-results/panels');
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch lab panels`);
        }
        
        allPanels = await response.json();
        displayPanelsList();
    } catch (error) {
        console.error('Error loading lab panels:', error);
        showAlert('Error loading lab panels: ' + error.message, 'danger');
    }
}

function displayPanelsList() {
    const container = document.getElementById('panelsList');
    
    if (allPanels.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-inbox"></i>
                <p class="mb-0 mt-2">No lab panels found</p>
                <small>Create your first panel to get started</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allPanels.map(panel => `
        <div class="card mb-2 panel-item" style="cursor: pointer;" onclick="selectPanel(${panel.id})">
            <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="card-title mb-1">${escapeHtml(panel.name)}</h6>
                        <small class="text-muted">${panel.category || 'Blood'}</small>
                        <div class="mt-1">
                            <span class="badge bg-light text-dark">${panel.parameter_count || 0} parameters</span>
                        </div>
                    </div>
                    <i class="bi bi-chevron-right text-muted"></i>
                </div>
                ${panel.description ? `<p class="card-text small text-muted mt-2 mb-0">${escapeHtml(panel.description)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function showCreatePanelForm() {
    document.getElementById('createPanelForm').style.display = 'block';
    document.getElementById('editPanelForm').style.display = 'none';
    document.getElementById('noPanelSelected').style.display = 'none';
    
    // Clear form
    document.getElementById('newPanelName').value = '';
    document.getElementById('newPanelDescription').value = '';
    document.getElementById('newPanelCategory').value = 'Blood';
}

function hideCreatePanelForm() {
    document.getElementById('createPanelForm').style.display = 'none';
    document.getElementById('noPanelSelected').style.display = 'block';
}

async function createNewPanel() {
    try {
        const name = document.getElementById('newPanelName').value.trim();
        const description = document.getElementById('newPanelDescription').value.trim();
        const category = document.getElementById('newPanelCategory').value;
        
        if (!name) {
            showAlert('Panel name is required', 'warning');
            return;
        }
        
        const response = await window.authManager.apiRequest('/test-results/panels', {
            method: 'POST',
            body: JSON.stringify({ name, description, category })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert('Panel created successfully', 'success');
        await loadLabPanels();
        hideCreatePanelForm();
        selectPanel(result.panel.id);
    } catch (error) {
        console.error('Error creating panel:', error);
        showAlert(error.message || 'Error creating panel', 'danger');
    }
}

async function selectPanel(panelId) {
    try {
        // Remove active state from all panels
        document.querySelectorAll('.panel-item').forEach(item => {
            item.classList.remove('border-primary');
        });
        
        // Add active state to selected panel
        event?.target?.closest('.panel-item')?.classList.add('border-primary');
        
        const response = await window.authManager.apiRequest(`/test-results/panels/${panelId}`);
        if (!response) throw new Error('Failed to fetch panel details');
        
        const panel = await response.json();
        currentEditingPanel = panel;
        
        // Show edit form
        document.getElementById('editPanelForm').style.display = 'block';
        document.getElementById('createPanelForm').style.display = 'none';
        document.getElementById('noPanelSelected').style.display = 'none';
        
        // Populate form
        document.getElementById('editPanelId').value = panel.id;
        document.getElementById('editPanelName').value = panel.name;
        document.getElementById('editPanelTitle').textContent = `Edit ${panel.name}`;
        
        displayPanelParameters(panel.parameters || []);
    } catch (error) {
        console.error('Error selecting panel:', error);
        showAlert('Error loading panel details', 'danger');
    }
}

function displayPanelParameters(parameters) {
    const container = document.getElementById('panelParametersList');
    
    if (!parameters || parameters.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                <i class="bi bi-plus-circle"></i>
                <p class="mb-0 mt-2">No parameters defined</p>
                <small>Add parameters to this panel</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = parameters.map(param => `
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div class="flex-grow-1">
                <strong>${escapeHtml(param.parameter_name)}</strong>
                <div class="small text-muted">
                    ${param.unit ? `Unit: ${escapeHtml(param.unit)}` : 'No unit'}
                    ${param.reference_min || param.reference_max ? 
                        `| Range: ${param.reference_min || '−∞'} - ${param.reference_max || '∞'}` : 
                        ''}
                    ${param.gender_specific ? `| ${param.gender_specific === 'M' ? 'Male only' : 'Female only'}` : ''}
                </div>
                ${param.aliases ? `<div class="small text-muted">Aliases: ${escapeHtml(param.aliases)}</div>` : ''}
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary btn-sm" onclick="editPanelParameter(${param.id})" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="deletePanelParameter(${param.id})" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addParameterToPanel() {
    document.getElementById('addParameterForm').style.display = 'block';
    
    // Clear form
    document.getElementById('newParamName').value = '';
    document.getElementById('newParamUnit').value = '';
    document.getElementById('newParamMinNormal').value = '';
    document.getElementById('newParamMaxNormal').value = '';
    document.getElementById('newParamGender').value = '';
    document.getElementById('newParamAliases').value = '';
}

function hideAddParameterForm() {
    document.getElementById('addParameterForm').style.display = 'none';
    
    // Reset form state
    document.getElementById('addParameterForm').removeAttribute('data-editing-param-id');
    document.querySelector('#addParameterForm h6').textContent = 'Add New Parameter';
    document.querySelector('#addParameterForm .btn-success').innerHTML = '<i class="bi bi-save"></i> Add Parameter';
    
    // Clear form fields
    document.getElementById('newParamName').value = '';
    document.getElementById('newParamUnit').value = '';
    document.getElementById('newParamMinNormal').value = '';
    document.getElementById('newParamMaxNormal').value = '';
    document.getElementById('newParamGender').value = '';
    document.getElementById('newParamAliases').value = '';
}

async function saveNewParameter() {
    try {
        const panelId = currentEditingPanel.id;
        const parameterName = document.getElementById('newParamName').value.trim();
        const unit = document.getElementById('newParamUnit').value.trim();
        const referenceMin = document.getElementById('newParamMinNormal').value;
        const referenceMax = document.getElementById('newParamMaxNormal').value;
        const genderSpecific = document.getElementById('newParamGender').value;
        const aliases = document.getElementById('newParamAliases').value.trim();
        const editingParamId = document.getElementById('addParameterForm').getAttribute('data-editing-param-id');
        
        if (!parameterName) {
            showAlert('Parameter name is required', 'warning');
            return;
        }
        
        let response;
        if (editingParamId) {
            // Update existing parameter
            response = await window.authManager.apiRequest(`/test-results/panels/${panelId}/parameters/${editingParamId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    parameter_name: parameterName,
                    unit: unit || null,
                    reference_min: referenceMin ? parseFloat(referenceMin) : null,
                    reference_max: referenceMax ? parseFloat(referenceMax) : null,
                    gender_specific: genderSpecific || null,
                    aliases: aliases || null
                })
            });
        } else {
            // Create new parameter
            response = await window.authManager.apiRequest(`/test-results/panels/${panelId}/parameters`, {
                method: 'POST',
                body: JSON.stringify({
                    parameter_name: parameterName,
                    unit: unit || null,
                    reference_min: referenceMin ? parseFloat(referenceMin) : null,
                    reference_max: referenceMax ? parseFloat(referenceMax) : null,
                    gender_specific: genderSpecific || null,
                    aliases: aliases || null
                })
            });
        }
        
        if (!response) throw new Error('Authentication failed');
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert(editingParamId ? 'Parameter updated successfully' : 'Parameter added successfully', 'success');
        hideAddParameterForm();
        
        // Refresh panel details
        await selectPanel(panelId);
    } catch (error) {
        console.error('Error adding parameter:', error);
        showAlert(error.message || 'Error adding parameter', 'danger');
    }
}

function editPanelParameter(parameterId) {
    const parameter = currentEditingPanel.parameters.find(p => p.id === parameterId);
    if (!parameter) {
        showAlert('Parameter not found', 'danger');
        return;
    }
    
    // Show the add parameter form with existing values
    document.getElementById('addParameterForm').style.display = 'block';
    
    // Populate form with existing values
    document.getElementById('newParamName').value = parameter.parameter_name || '';
    document.getElementById('newParamUnit').value = parameter.unit || '';
    document.getElementById('newParamMinNormal').value = parameter.reference_min || '';
    document.getElementById('newParamMaxNormal').value = parameter.reference_max || '';
    document.getElementById('newParamGender').value = parameter.gender_specific || '';
    document.getElementById('newParamAliases').value = parameter.aliases || '';
    
    // Store the parameter ID for updating
    document.getElementById('addParameterForm').setAttribute('data-editing-param-id', parameterId);
    
    // Update form title and button
    document.querySelector('#addParameterForm h6').textContent = 'Edit Parameter';
    document.querySelector('#addParameterForm .btn-success').innerHTML = '<i class="bi bi-save"></i> Update Parameter';
}

async function deletePanelParameter(parameterId) {
    if (!confirm('Are you sure you want to delete this parameter?')) return;
    
    try {
        const panelId = currentEditingPanel.id;
        const response = await window.authManager.apiRequest(`/test-results/panels/${panelId}/parameters/${parameterId}`, {
            method: 'DELETE'
        });
        
        if (!response) throw new Error('Authentication failed');
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert('Parameter deleted successfully', 'success');
        
        // Refresh panel details
        await selectPanel(panelId);
    } catch (error) {
        console.error('Error deleting parameter:', error);
        showAlert(error.message || 'Error deleting parameter', 'danger');
    }
}

async function savePanelChanges() {
    try {
        const panelId = currentEditingPanel.id;
        const name = document.getElementById('editPanelName').value.trim();
        
        if (!name) {
            showAlert('Panel name is required', 'warning');
            return;
        }
        
        const response = await window.authManager.apiRequest(`/test-results/panels/${panelId}`, {
            method: 'PUT',
            body: JSON.stringify({ name })
        });
        
        if (!response) throw new Error('Authentication failed');
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert('Panel updated successfully', 'success');
        await loadLabPanels();
    } catch (error) {
        console.error('Error updating panel:', error);
        showAlert(error.message || 'Error updating panel', 'danger');
    }
}

function cancelPanelEdit() {
    document.getElementById('editPanelForm').style.display = 'none';
    document.getElementById('noPanelSelected').style.display = 'block';
    currentEditingPanel = null;
}

async function deletePanel() {
    if (!confirm(`Are you sure you want to delete the panel "${currentEditingPanel.name}"? This will also delete all its parameters.`)) {
        return;
    }
    
    try {
        const response = await window.authManager.apiRequest(`/test-results/panels/${currentEditingPanel.id}`, {
            method: 'DELETE'
        });
        
        if (!response) throw new Error('Authentication failed');
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert('Panel deleted successfully', 'success');
        await loadLabPanels();
        cancelPanelEdit();
    } catch (error) {
        console.error('Error deleting panel:', error);
        showAlert(error.message || 'Error deleting panel', 'danger');
    }
}

// PDF Review Functions
function showPDFReviewModal(extractedData) {
    console.log('showPDFReviewModal called with:', extractedData);
    extractedPDFData = extractedData;
    
    // Check if modal element exists
    const modalElement = document.getElementById('pdfReviewModal');
    if (!modalElement) {
        console.error('PDF Review modal not found in DOM');
        showAlert('PDF Review modal not found. Please refresh the page.', 'danger');
        return;
    }
    
    // Populate test information
    document.getElementById('reviewPatientName').textContent = extractedData.patientName || '-';
    document.getElementById('reviewTestName').textContent = extractedData.testName || '-';
    document.getElementById('reviewTestDate').textContent = extractedData.testDate || '-';
    document.getElementById('reviewValueCount').textContent = extractedData.labValues?.length || 0;
    
    // Display extracted values for review
    displayReviewValues(extractedData.labValues || []);
    
    // Show modal
    try {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        console.log('PDF Review modal should now be visible');
    } catch (error) {
        console.error('Error showing PDF Review modal:', error);
        showAlert('Error showing PDF Review modal: ' + error.message, 'danger');
    }
}

function displayReviewValues(labValues) {
    console.log('displayReviewValues called with:', labValues);
    const container = document.getElementById('reviewValuesContainer');
    
    if (!container) {
        console.error('reviewValuesContainer not found in DOM');
        return;
    }
    
    if (!labValues || labValues.length === 0) {
        console.log('No lab values to display');
        container.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-exclamation-triangle"></i>
                <p class="mt-2">No lab values were extracted from the PDF</p>
                <small>You can add values manually using the button on the right</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = labValues.map((value, index) => `
        <div class="card mb-2" id="reviewValue-${index}">
            <div class="card-body p-3">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <label class="form-label small">Parameter</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${escapeHtml(value.parameter_name)}" 
                               onchange="updateReviewValue(${index}, 'parameter_name', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Value</label>
                        <input type="number" step="0.01" class="form-control form-control-sm" 
                               value="${value.value}" 
                               onchange="updateReviewValue(${index}, 'value', this.value)">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Unit</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${escapeHtml(value.unit || '')}" 
                               onchange="updateReviewValue(${index}, 'unit', this.value)">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small">Status</label>
                        <select class="form-select form-select-sm" 
                                onchange="updateReviewValue(${index}, 'status', this.value)">
                            <option value="normal" ${value.status === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="high" ${value.status === 'high' ? 'selected' : ''}>High</option>
                            <option value="low" ${value.status === 'low' ? 'selected' : ''}>Low</option>
                            <option value="critical" ${value.status === 'critical' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                    <div class="col-md-1 text-end">
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteReviewValue(${index})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                ${value.reference_range ? `
                    <div class="row mt-2">
                        <div class="col-12">
                            <small class="text-muted">Reference Range: ${escapeHtml(value.reference_range)}</small>
                        </div>
                    </div>
                ` : ''}
                ${value.confidence ? `
                    <div class="row mt-1">
                        <div class="col-12">
                            <small class="text-muted">Confidence: ${Math.round(value.confidence * 100)}%</small>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateReviewValue(index, field, value) {
    if (extractedPDFData.labValues[index]) {
        extractedPDFData.labValues[index][field] = value;
    }
}

function deleteReviewValue(index) {
    if (confirm('Remove this lab value?')) {
        extractedPDFData.labValues.splice(index, 1);
        displayReviewValues(extractedPDFData.labValues);
        document.getElementById('reviewValueCount').textContent = extractedPDFData.labValues.length;
    }
}

function addManualValueToReview() {
    const newValue = {
        parameter_name: '',
        value: '',
        unit: '',
        status: 'normal',
        reference_range: null,
        confidence: null
    };
    
    extractedPDFData.labValues.push(newValue);
    displayReviewValues(extractedPDFData.labValues);
    document.getElementById('reviewValueCount').textContent = extractedPDFData.labValues.length;
}

async function saveReviewedValues() {
    try {
        if (!extractedPDFData || !extractedPDFData.labValues || extractedPDFData.labValues.length === 0) {
            showAlert('No lab values to save', 'warning');
            return;
        }
        
        // Validate required fields
        const validValues = extractedPDFData.labValues.filter(value => 
            value.parameter_name && value.parameter_name.trim() && 
            value.value !== null && value.value !== ''
        );
        
        if (validValues.length === 0) {
            showAlert('Please provide valid parameter names and values', 'warning');
            return;
        }
        
        document.getElementById('saveReviewedValuesBtn').disabled = true;
        document.getElementById('saveReviewedValuesBtn').innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Saving...';
        
        const requestData = {
            patient_id: extractedPDFData.patientId,
            appointment_id: extractedPDFData.appointmentId,
            institution_id: extractedPDFData.institutionId,
            test_name: extractedPDFData.testName,
            test_type: extractedPDFData.testType,
            test_date: extractedPDFData.testDate,
            lab_values: validValues,
            pdf_file_path: extractedPDFData.pdfFilePath
        };
        
        console.log('Sending request data:', requestData);
        
        const response = await window.authManager.apiRequest('/test-results', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
        
        
        const result = await response.json();
        console.log('Response data:', result);
        
        if (!response.ok) {
            throw new Error(result.message || result.error || `HTTP ${response.status}: Request failed`);
        }
        
        showAlert('Lab report saved successfully', 'success');
        
        // Close modals and refresh
        bootstrap.Modal.getInstance(document.getElementById('pdfReviewModal')).hide();
        bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
        
        await loadReports();
        await loadReportStats();
    } catch (error) {
        console.error('Error saving reviewed values:', error);
        showAlert(error.message || 'Error saving lab report', 'danger');
    } finally {
        document.getElementById('saveReviewedValuesBtn').disabled = false;
        document.getElementById('saveReviewedValuesBtn').innerHTML = '<i class="bi bi-save"></i> Save Lab Report';
    }
}

// Aggressive fix for Bootstrap modal focus and backdrop issues
function fixBootstrapModalFocus() {
    // Override Bootstrap's modal close behavior to prevent focus trapping and backdrop issues
    const originalModalProto = bootstrap.Modal.prototype.hide;
    
    bootstrap.Modal.prototype.hide = function() {
        const modalElement = this._element;
        
        // Before hiding modal, aggressively blur all focused elements
        if (modalElement && modalElement.contains(document.activeElement)) {
            document.activeElement.blur();
            
            // Force focus to body
            setTimeout(() => {
                document.body.focus();
                document.body.blur();
            }, 0);
        }
        
        // Call original hide method
        const result = originalModalProto.call(this);
        
        // Aggressive cleanup after modal hide
        setTimeout(() => {
            // Remove any lingering backdrops
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            
            // Remove modal-open class from body
            document.body.classList.remove('modal-open');
            
            // Reset body overflow
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            
            // Ensure modal is fully hidden
            if (modalElement) {
                modalElement.style.display = 'none';
                modalElement.classList.remove('show');
                modalElement.setAttribute('aria-hidden', 'true');
                modalElement.removeAttribute('aria-modal');
            }
        }, 100);
        
        return result;
    };
}

// Initialize modal fixes immediately
function initializeModalFocusManagement() {
    // Apply the bootstrap override
    fixBootstrapModalFocus();
    
    // Add click handlers to all modal dismiss buttons
    document.querySelectorAll('[data-bs-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', function(e) {
            // Immediately blur the button to prevent focus issues
            this.blur();
            
            // Find the modal this button belongs to
            const modal = this.closest('.modal');
            if (modal) {
                // Blur any focused elements in the modal
                const focusedElement = modal.querySelector(':focus');
                if (focusedElement) {
                    focusedElement.blur();
                }
                
                // Force focus away from modal
                document.body.focus();
                
                // Use a small delay to ensure DOM is ready
                setTimeout(() => {
                    document.body.blur();
                }, 50);
            }
        });
    });
    
    // Handle panel management modal specifically with extra cleanup
    const panelManagementModal = document.getElementById('panelManagementModal');
    if (panelManagementModal) {
        // Add extra handlers for panel modal close buttons
        const panelCloseButtons = panelManagementModal.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
        panelCloseButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Force immediate cleanup
                setTimeout(() => {
                    // Remove any lingering modal state
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    
                    // Remove backdrops
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    backdrops.forEach(backdrop => backdrop.remove());
                    
                    // Clear panel editing state
                    if (typeof cancelPanelEdit === 'function') {
                        cancelPanelEdit();
                    }
                }, 50);
            });
        });
        
        panelManagementModal.addEventListener('hidden.bs.modal', function() {
            // Additional cleanup after modal is hidden
            setTimeout(() => {
                // Final cleanup
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
                
                // Remove any remaining backdrops
                const remainingBackdrops = document.querySelectorAll('.modal-backdrop');
                remainingBackdrops.forEach(backdrop => backdrop.remove());
                
                // Clear any active panel editing
                if (typeof cancelPanelEdit === 'function') {
                    cancelPanelEdit();
                }
                
                // Return focus to the trigger button
                const managePanelsBtn = document.querySelector('button[data-bs-target="#panelManagementModal"]');
                if (managePanelsBtn) {
                    managePanelsBtn.focus();
                }
            }, 150);
        });
    }
}

// Initialize immediately if Bootstrap is available, otherwise wait for it
if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    initializeModalFocusManagement();
} else {
    // Wait for Bootstrap to load
    document.addEventListener('DOMContentLoaded', function() {
        // Small delay to ensure Bootstrap is fully loaded
        setTimeout(initializeModalFocusManagement, 100);
    });
}