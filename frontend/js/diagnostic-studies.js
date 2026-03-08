// Diagnostic Studies management JavaScript

let allStudies = [];
let filteredStudies = [];
let currentEditingId = null;
let patients = [];
let doctors = [];
let institutions = [];

// Utility
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---- Load reference data ----
async function loadReferenceData() {
    try {
        const [patientsRes, doctorsRes, institutionsRes] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/doctors'),
            apiCall('/institutions')
        ]);

        if (patientsRes.status === 'fulfilled' && patientsRes.value) {
            patients = patientsRes.value.data || patientsRes.value || [];
        }
        if (doctorsRes.status === 'fulfilled' && doctorsRes.value) {
            doctors = doctorsRes.value.data || doctorsRes.value || [];
        }
        if (institutionsRes.status === 'fulfilled' && institutionsRes.value) {
            institutions = institutionsRes.value.data || institutionsRes.value || [];
        }

        populatePatientDropdowns();
        populateDoctorDropdowns();
        populateInstitutionDropdown();
    } catch (error) {
        console.error('Error loading reference data:', error);
    }
}

function populatePatientDropdowns() {
    const selects = ['formPatientId', 'patientFilter'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = id === 'patientFilter'
            ? '<option value="">All Patients</option>'
            : '<option value="">Select Patient</option>';
        patients.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.first_name} ${p.last_name}`;
            el.appendChild(opt);
        });
        if (current) el.value = current;
    });
}

function populateDoctorDropdowns() {
    ['formOrderingPhysician', 'formPerformingPhysician'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = '<option value="">Select Doctor</option>';
        doctors.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `Dr. ${d.first_name} ${d.last_name}${d.specialty ? ` (${d.specialty})` : ''}`;
            el.appendChild(opt);
        });
        if (current) el.value = current;
    });
}

function populateInstitutionDropdown() {
    const el = document.getElementById('formInstitution');
    if (!el) return;
    const current = el.value;
    el.innerHTML = '<option value="">Select Institution</option>';
    institutions.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i.id;
        opt.textContent = i.name;
        el.appendChild(opt);
    });
    if (current) el.value = current;
}

// ---- Load studies ----
async function loadStudies() {
    try {
        const data = await apiCall('/diagnostic-studies');
        allStudies = data.data || [];
        applyFilters();
        loadStats();
    } catch (err) {
        console.error('Error loading studies:', err);
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('noStudies').style.display = 'block';
    }
}

async function loadStats() {
    try {
        const data = await apiCall('/diagnostic-studies/stats/summary');
        if (data && data.data) {
            const s = data.data;
            document.getElementById('totalStudiesCount').textContent = s.total_studies || 0;
            document.getElementById('thisMonthCount').textContent = s.this_month || 0;
            document.getElementById('uniquePatientsCount').textContent = s.unique_patients || 0;
        }
    } catch (_) {}
}

// ---- Filters ----
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const patientId = document.getElementById('patientFilter').value;
    const studyType = document.getElementById('studyTypeFilter').value;

    filteredStudies = allStudies.filter(s => {
        if (patientId && s.patient_id !== patientId) return false;
        if (studyType && s.study_type !== studyType) return false;
        if (search) {
            const hay = [
                s.study_type, s.body_region, s.findings, s.conclusion,
                s.patient_first_name, s.patient_last_name, s.clinical_indication
            ].join(' ').toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    renderTable();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('patientFilter').value = '';
    document.getElementById('studyTypeFilter').value = '';
    applyFilters();
}

// ---- Render table ----
function renderTable() {
    const spinner = document.getElementById('loadingSpinner');
    const table = document.getElementById('studiesTable');
    const noStudies = document.getElementById('noStudies');
    const tbody = document.getElementById('studiesTableBody');
    const countBadge = document.getElementById('studyCount');

    spinner.style.display = 'none';
    countBadge.textContent = filteredStudies.length;

    if (filteredStudies.length === 0) {
        table.style.display = 'none';
        noStudies.style.display = 'block';
        return;
    }

    table.style.display = 'block';
    noStudies.style.display = 'none';

    tbody.innerHTML = filteredStudies.map(s => {
        const patientName = `${escapeHtml(s.patient_first_name)} ${escapeHtml(s.patient_last_name)}`;
        const ordering = s.ordering_physician
            ? `Dr. ${escapeHtml(s.ordering_physician.first_name)} ${escapeHtml(s.ordering_physician.last_name)}`
            : '<span class="text-muted">—</span>';
        const performing = s.performing_physician
            ? `Dr. ${escapeHtml(s.performing_physician.first_name)} ${escapeHtml(s.performing_physician.last_name)}`
            : '<span class="text-muted">—</span>';

        let attachmentBadge = '<span class="text-muted">—</span>';
        if (s.attachment_path) {
            const icon = s.attachment_mime_type === 'application/pdf'
                ? 'bi-file-earmark-pdf text-danger'
                : 'bi-file-earmark-image text-primary';
            const filePath = window.getApiBaseUrl().replace(/\/api$/, '') + s.attachment_path.replace(/\\/g, '/').replace(/.*uploads\//, '/uploads/');
            attachmentBadge = `<a href="${filePath}" target="_blank" class="btn btn-sm btn-outline-secondary">
                <i class="bi ${icon}"></i> View
            </a>`;
        }

        return `<tr>
            <td>${patientName}</td>
            <td><span class="badge bg-secondary">${escapeHtml(s.study_type)}</span></td>
            <td>${escapeHtml(s.body_region) || '<span class="text-muted">—</span>'}</td>
            <td>${formatDate(s.study_date)}</td>
            <td>${ordering}</td>
            <td>${performing}</td>
            <td>${attachmentBadge}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" onclick="viewStudy('${s.id}')" title="View">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-primary" onclick="editStudy('${s.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteStudy('${s.id}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ---- Modal: Add ----
function openAddModal() {
    currentEditingId = null;
    document.getElementById('studyModalTitle').innerHTML = '<i class="bi bi-body-text"></i> Add Diagnostic Study';
    document.getElementById('studyForm').reset();
    document.getElementById('existingAttachment').style.display = 'none';
    populateDoctorDropdowns();
    populateInstitutionDropdown();
    populatePatientDropdowns();
    document.getElementById('formStudyDate').value = new Date().toISOString().split('T')[0];
    const modal = new bootstrap.Modal(document.getElementById('studyModal'));
    modal.show();
}

// ---- Modal: Edit ----
function editStudy(id) {
    const study = allStudies.find(s => s.id === id);
    if (!study) return;

    currentEditingId = id;
    document.getElementById('studyModalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit Diagnostic Study';

    populateDoctorDropdowns();
    populateInstitutionDropdown();
    populatePatientDropdowns();

    document.getElementById('formPatientId').value = study.patient_id || '';
    document.getElementById('formStudyType').value = study.study_type || '';
    document.getElementById('formStudyDate').value = study.study_date ? study.study_date.split('T')[0] : '';
    document.getElementById('formBodyRegion').value = study.body_region || '';
    document.getElementById('formOrderingPhysician').value = study.ordering_physician?.id || '';
    document.getElementById('formPerformingPhysician').value = study.performing_physician?.id || '';
    document.getElementById('formInstitution').value = study.institution?.id || '';
    document.getElementById('formClinicalIndication').value = study.clinical_indication || '';
    document.getElementById('formFindings').value = study.findings || '';
    document.getElementById('formConclusion').value = study.conclusion || '';
    document.getElementById('formNotes').value = study.notes || '';

    if (study.attachment_original_name) {
        document.getElementById('existingAttachmentName').textContent = study.attachment_original_name;
        document.getElementById('existingAttachment').style.display = 'block';
    } else {
        document.getElementById('existingAttachment').style.display = 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('studyModal'));
    modal.show();
}

// ---- Save ----
async function saveStudy() {
    const form = document.getElementById('studyForm');

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);

    // Remove empty optional selects so backend gets NULL not ''
    ['ordering_physician_id', 'performing_physician_id', 'institution_id'].forEach(k => {
        if (!formData.get(k)) formData.delete(k);
    });

    try {
        const url = currentEditingId
            ? `/diagnostic-studies/${currentEditingId}`
            : '/diagnostic-studies';
        const method = currentEditingId ? 'PUT' : 'POST';

        // Use authManager for file upload (FormData, no Content-Type override)
        const response = await window.authManager.apiRequest(url, { method, body: formData });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Error saving study');

        bootstrap.Modal.getInstance(document.getElementById('studyModal')).hide();
        await loadStudies();
        showAlert(currentEditingId ? 'Study updated successfully' : 'Study added successfully', 'success');
    } catch (err) {
        showAlert(err.message || 'Error saving study', 'danger');
    }
}

// ---- View ----
function viewStudy(id) {
    const s = allStudies.find(s => s.id === id);
    if (!s) return;

    const ordering = s.ordering_physician
        ? `Dr. ${escapeHtml(s.ordering_physician.first_name)} ${escapeHtml(s.ordering_physician.last_name)}${s.ordering_physician.specialty ? ` <small class="text-muted">(${escapeHtml(s.ordering_physician.specialty)})</small>` : ''}`
        : '—';
    const performing = s.performing_physician
        ? `Dr. ${escapeHtml(s.performing_physician.first_name)} ${escapeHtml(s.performing_physician.last_name)}${s.performing_physician.specialty ? ` <small class="text-muted">(${escapeHtml(s.performing_physician.specialty)})</small>` : ''}`
        : '—';

    let attachmentHtml = '<span class="text-muted">No attachment</span>';
    if (s.attachment_path) {
        const filePath = window.getApiBaseUrl().replace(/\/api$/, '') + s.attachment_path.replace(/\\/g, '/').replace(/.*uploads\//, '/uploads/');
        const icon = s.attachment_mime_type === 'application/pdf'
            ? 'bi-file-earmark-pdf text-danger'
            : 'bi-file-earmark-image text-primary';
        attachmentHtml = `<a href="${filePath}" target="_blank" class="btn btn-sm btn-outline-secondary">
            <i class="bi ${icon}"></i> ${escapeHtml(s.attachment_original_name)}
        </a>`;
    }

    document.getElementById('viewStudyBody').innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <label class="form-label fw-bold text-muted small">PATIENT</label>
                <p>${escapeHtml(s.patient_first_name)} ${escapeHtml(s.patient_last_name)}</p>
            </div>
            <div class="col-md-3">
                <label class="form-label fw-bold text-muted small">STUDY TYPE</label>
                <p><span class="badge bg-secondary">${escapeHtml(s.study_type)}</span></p>
            </div>
            <div class="col-md-3">
                <label class="form-label fw-bold text-muted small">STUDY DATE</label>
                <p>${formatDate(s.study_date)}</p>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-bold text-muted small">BODY REGION</label>
                <p>${escapeHtml(s.body_region) || '—'}</p>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-bold text-muted small">INSTITUTION</label>
                <p>${s.institution ? escapeHtml(s.institution.name) : '—'}</p>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-bold text-muted small">ORDERING PHYSICIAN</label>
                <p>${ordering}</p>
            </div>
            <div class="col-md-6">
                <label class="form-label fw-bold text-muted small">PERFORMING PHYSICIAN / RADIOLOGIST</label>
                <p>${performing}</p>
            </div>
            ${s.clinical_indication ? `
            <div class="col-12">
                <label class="form-label fw-bold text-muted small">CLINICAL INDICATION</label>
                <p>${escapeHtml(s.clinical_indication)}</p>
            </div>` : ''}
            ${s.findings ? `
            <div class="col-12">
                <label class="form-label fw-bold text-muted small">FINDINGS</label>
                <p style="white-space: pre-wrap;">${escapeHtml(s.findings)}</p>
            </div>` : ''}
            ${s.conclusion ? `
            <div class="col-12">
                <label class="form-label fw-bold text-muted small">CONCLUSION / IMPRESSION</label>
                <p style="white-space: pre-wrap;">${escapeHtml(s.conclusion)}</p>
            </div>` : ''}
            ${s.notes ? `
            <div class="col-12">
                <label class="form-label fw-bold text-muted small">NOTES</label>
                <p>${escapeHtml(s.notes)}</p>
            </div>` : ''}
            <div class="col-12">
                <label class="form-label fw-bold text-muted small">ATTACHMENT</label>
                <p>${attachmentHtml}</p>
            </div>
        </div>
    `;

    document.getElementById('viewEditBtn').onclick = () => {
        bootstrap.Modal.getInstance(document.getElementById('viewStudyModal')).hide();
        editStudy(id);
    };

    const modal = new bootstrap.Modal(document.getElementById('viewStudyModal'));
    modal.show();
}

// ---- Delete ----
async function deleteStudy(id) {
    const study = allStudies.find(s => s.id === id);
    if (!study) return;
    if (!confirm(`Delete ${study.study_type}${study.body_region ? ' — ' + study.body_region : ''} for ${study.patient_first_name} ${study.patient_last_name}? This cannot be undone.`)) return;

    try {
        await apiCall(`/diagnostic-studies/${id}`, { method: 'DELETE' });
        await loadStudies();
        showAlert('Study deleted', 'success');
    } catch (err) {
        showAlert(err.message || 'Error deleting study', 'danger');
    }
}

// ---- Event listeners ----
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('patientFilter').addEventListener('change', applyFilters);
    document.getElementById('studyTypeFilter').addEventListener('change', applyFilters);
});

// ---- Init ----
async function initPage() {
    await loadReferenceData();
    await loadStudies();
}

// app.js calls initPage or it runs via DOMContentLoaded — match pattern of other pages
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}
