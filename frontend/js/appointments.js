// Appointment management JavaScript

let allAppointments = [];
let filteredAppointments = [];
let patients = [];
let doctors = [];
let institutions = [];
let currentEditingId = null;

// Make functions globally available
window.saveAppointment = saveAppointment;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.viewAppointment = viewAppointment;
window.openAddAppointmentModal = openAddAppointmentModal;
window.clearFilters = clearFilters;

// Initialize appointments page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('appointmentsTableBody')) {
        console.log('Initializing appointments page...');
        loadAppointments();
        loadDropdownData();
        loadAppointmentStats();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search and filter functionality
    document.getElementById('searchInput').addEventListener('input', filterAppointments);
    document.getElementById('statusFilter').addEventListener('change', filterAppointments);
    document.getElementById('patientFilter').addEventListener('change', filterAppointments);
    document.getElementById('doctorFilter').addEventListener('change', filterAppointments);
    
    // Show/hide diagnosis field based on status
    document.getElementById('status').addEventListener('change', function() {
        const diagnosisSection = document.getElementById('diagnosisSection');
        if (this.value === 'completed') {
            diagnosisSection.style.display = 'block';
        } else {
            diagnosisSection.style.display = 'none';
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

// Load all appointments
async function loadAppointments() {
    console.log('Loading appointments...');
    try {
        showLoading(true);
        const response = await apiCall('/appointments');
        console.log('Appointments response:', response);
        
        if (response.success) {
            allAppointments = response.data;
            filteredAppointments = [...allAppointments];
            displayAppointments();
            updateAppointmentCount();
            console.log(`Loaded ${allAppointments.length} appointments`);
        } else {
            console.error('Failed to load appointments:', response.error);
            showAlert('Failed to load appointments: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
        showAlert('Error loading appointments: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allAppointments = [];
        filteredAppointments = [];
        displayAppointments();
        updateAppointmentCount();
    } finally {
        showLoading(false);
    }
}

// Load dropdown data (patients, doctors, institutions)
async function loadDropdownData() {
    try {
        const [patientsResponse, doctorsResponse, institutionsResponse] = await Promise.allSettled([
            apiCall('/patients'),
            apiCall('/doctors'),
            apiCall('/institutions')
        ]);
        
        // Load patients
        if (patientsResponse.status === 'fulfilled' && patientsResponse.value.success) {
            patients = patientsResponse.value.data;
            populatePatientDropdowns();
        }
        
        // Load doctors
        if (doctorsResponse.status === 'fulfilled' && doctorsResponse.value.success) {
            doctors = doctorsResponse.value.data;
            populateDoctorDropdowns();
        }
        
        // Load institutions
        if (institutionsResponse.status === 'fulfilled' && institutionsResponse.value.success) {
            institutions = institutionsResponse.value.data;
            populateInstitutionDropdowns();
        }
    } catch (error) {
        console.error('Error loading dropdown data:', error);
    }
}

// Load appointment statistics
async function loadAppointmentStats() {
    try {
        const response = await apiCall('/appointments/stats/summary');
        if (response.success) {
            const stats = response.data;
            document.getElementById('totalAppointmentsCount').textContent = stats.total_appointments || 0;
            document.getElementById('upcomingCount').textContent = stats.upcoming || 0;
            document.getElementById('completedCount').textContent = stats.completed || 0;
            document.getElementById('todayCount').textContent = stats.today || 0;
        }
    } catch (error) {
        console.error('Error loading appointment stats:', error);
    }
}

// Populate patient dropdowns
function populatePatientDropdowns() {
    const modalSelect = document.getElementById('patientId');
    const filterSelect = document.getElementById('patientFilter');
    
    const options = patients.map(patient => 
        `<option value="${patient.id}">${patient.first_name} ${patient.last_name}</option>`
    ).join('');
    
    modalSelect.innerHTML = '<option value="">Select Patient</option>' + options;
    filterSelect.innerHTML = '<option value="">All Patients</option>' +