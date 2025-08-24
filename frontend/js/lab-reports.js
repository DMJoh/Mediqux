// Lab Reports management JavaScript

let allReports = [];
let filteredReports = [];
let currentEditingId = null;
let patients = [];
let appointments = [];
let institutions = [];
let labValueCounter = 0;

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

// Initialize lab reports page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('reportsTableBody')) {
        console.log('Initializing lab reports page...');
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
    console.log('Loading lab reports...');
    try {
        showLoading(true);
        const response = await apiCall('/test-results');
        console.log('Reports response:', response);
        
        if (response.success) {
            allReports = response.data;
            filteredReports = [...allReports];
            displayReports();
            updateReportCount();
            console.log(`Loaded ${allReports.length} reports`);
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
                        ${report.pdf_file_path ? `<button class="btn btn-outline-secondary" onclick="downloadPDF('${report.id}')" title="Download PDF"><i class="bi bi-download"></i></button>` : ''}
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
    console.log('Upload report button clicked');
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
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Upload response:', result);
        
        if (result.success) {
            if (result.requiresReview) {
                // Show PDF review modal with extracted data
                const extractedData = {
                    patientId: formData.get('patientId'),
                    appointmentId: formData.get('appointmentId'),
                    institutionId: formData.get('institutionId'),
                    testName: formData.get('testName'),
                    testType: formData.get('testType'),
                    testDate: formData.get('testDate'),
                    patientName: result.patientName || 'Unknown',
                    labValues: result.extractedValues || [],
                    pdfFilePath: result.tempFile?.path || null,
                    tempFileData: result.tempFile
                };
                
                console.log('Extracted data for review:', extractedData);
                
                // Hide upload modal and show review modal
                bootstrap.Modal.getInstance(document.getElementById('uploadReportModal')).hide();
                
                // Add delay to ensure modal is closed before opening new one
                setTimeout(() => {
                    showPDFReviewModal(extractedData);
                }, 300);
            } else {
                // Old workflow - direct save (fallback)
                showAlert(result.message, 'success');
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

// Save manual entry
async function saveManualEntry() {
    console.log('Save manual entry button clicked');
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
        
        console.log('Save response:', response);
        
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
            document.getElementById('manualTestDate').value = report.test_date;
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

// Download PDF (placeholder function)
function downloadPDF(reportId) {
    window.open(`${CONFIG.API_BASE}/test-results/${reportId}/download`, '_blank');
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
window.editReviewValue = editReviewValue;
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
        console.log('Loading lab panels from:', `${CONFIG.API_BASE}/test-results/panels`);
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels`);
        console.log('Panel response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch lab panels`);
        }
        
        allPanels = await response.json();
        console.log('Loaded panels:', allPanels);
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
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels/${panelId}`);
        if (!response.ok) throw new Error('Failed to fetch panel details');
        
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
        
        if (!parameterName) {
            showAlert('Parameter name is required', 'warning');
            return;
        }
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels/${panelId}/parameters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parameter_name: parameterName,
                unit: unit || null,
                reference_min: referenceMin ? parseFloat(referenceMin) : null,
                reference_max: referenceMax ? parseFloat(referenceMax) : null,
                gender_specific: genderSpecific || null,
                aliases: aliases || null
            })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
        showAlert('Parameter added successfully', 'success');
        hideAddParameterForm();
        
        // Refresh panel details
        await selectPanel(panelId);
    } catch (error) {
        console.error('Error adding parameter:', error);
        showAlert(error.message || 'Error adding parameter', 'danger');
    }
}

async function deletePanelParameter(parameterId) {
    if (!confirm('Are you sure you want to delete this parameter?')) return;
    
    try {
        const panelId = currentEditingPanel.id;
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels/${panelId}/parameters/${parameterId}`, {
            method: 'DELETE'
        });
        
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
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels/${panelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
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
        const response = await fetch(`${CONFIG.API_BASE}/test-results/panels/${currentEditingPanel.id}`, {
            method: 'DELETE'
        });
        
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
        
        const response = await fetch(`${CONFIG.API_BASE}/test-results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientId: extractedPDFData.patientId,
                appointmentId: extractedPDFData.appointmentId,
                institutionId: extractedPDFData.institutionId,
                testName: extractedPDFData.testName,
                testType: extractedPDFData.testType,
                testDate: extractedPDFData.testDate,
                labValues: validValues,
                pdfFilePath: extractedPDFData.pdfFilePath
            })
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        
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