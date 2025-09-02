// User Management JavaScript

let allUsers = [];
let currentEditingId = null;
let patients = [];

// Make functions globally available
window.openAddUserModal = openAddUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.saveUser = saveUser;
window.togglePatientAccess = togglePatientAccess;
window.openResetPasswordModal = openResetPasswordModal;
window.resetPassword = resetPassword;

// Initialize users page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('usersTableBody')) {
        loadUsers();
        loadPatients();
        
        // Check if current user is admin
        checkAdminAccess();
    }
});

// Check if current user has admin access
function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
        // Redirect non-admin users
        showAlert('Access denied. Admin privileges required.', 'danger');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

// Load all users
async function loadUsers() {
    try {
        showLoading(true);
        const response = await apiCall('/users');
        
        if (response.success) {
            allUsers = response.data;
            displayUsers();
            updateUserCount();
        } else {
            console.error('Failed to load users:', response.error);
            showAlert('Failed to load users: ' + (response.error || 'Unknown error'), 'danger');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Error loading users: ' + error.message, 'danger');
        // Show empty state instead of infinite loading
        allUsers = [];
        displayUsers();
        updateUserCount();
    } finally {
        showLoading(false);
    }
}

// Load patients for dropdown
async function loadPatients() {
    try {
        const response = await apiCall('/patients');
        if (response.success) {
            patients = response.data;
            populatePatientDropdown();
        }
    } catch (error) {
        console.error('Error loading patients:', error);
    }
}

// Populate patient dropdown
function populatePatientDropdown() {
    const patientOptions = patients.map(patient => 
        `<option value="${patient.id}">${patient.first_name} ${patient.last_name}</option>`
    ).join('');
    
    document.getElementById('patientId').innerHTML = 
        '<option value="">No specific patient (no access)</option>' + patientOptions;
}

// Display users in table
function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    const tableDiv = document.getElementById('usersTable');
    const noUsers = document.getElementById('noUsers');
    
    if (allUsers.length === 0) {
        tableDiv.style.display = 'none';
        noUsers.style.display = 'block';
        return;
    }
    
    tableDiv.style.display = 'block';
    noUsers.style.display = 'none';
    
    tbody.innerHTML = allUsers.map(user => {
        const lastLogin = user.last_login ? 
            new Date(user.last_login).toLocaleDateString() : 'Never';
        
        const patientAccess = user.patient_id ? 
            `${user.patient_first_name} ${user.patient_last_name}` : 
            '<span class="text-muted">None</span>';
        
        const statusBadge = user.is_active ? 
            '<span class="badge bg-success">Active</span>' : 
            '<span class="badge bg-danger">Inactive</span>';
        
        const roleBadge = user.role === 'admin' ? 
            '<span class="badge bg-primary">Admin</span>' : 
            '<span class="badge bg-secondary">User</span>';
        
        return `
            <tr>
                <td>
                    <div>
                        <strong>${user.first_name} ${user.last_name}</strong>
                    </div>
                </td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td>${roleBadge}</td>
                <td>${patientAccess}</td>
                <td>${statusBadge}</td>
                <td>${lastLogin}</td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button class="btn btn-outline-primary" onclick="editUser('${user.id}')" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="openResetPasswordModal('${user.id}', '${user.first_name} ${user.last_name}')" title="Reset Password">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser('${user.id}', '${user.first_name} ${user.last_name}', '${user.role}')" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update user count badge
function updateUserCount() {
    document.getElementById('userCount').textContent = allUsers.length;
}

// Show/hide loading spinner
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Open add user modal
function openAddUserModal() {
    console.log('Opening add user modal');
    currentEditingId = null;
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus"></i> Add New User';
    document.getElementById('password').required = true;
    document.getElementById('passwordSection').style.display = 'block';
    document.getElementById('isActive').value = 'true';
    togglePatientAccess();
}

// Toggle patient access section based on role
function togglePatientAccess() {
    const role = document.getElementById('role').value;
    const patientSection = document.getElementById('patientAccessSection');
    
    if (role === 'admin') {
        patientSection.style.display = 'none';
        document.getElementById('patientId').value = '';
    } else {
        patientSection.style.display = 'block';
    }
}

// Edit user
async function editUser(userId) {
    try {
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            showAlert('User not found', 'danger');
            return;
        }
        
        currentEditingId = userId;
        
        // Populate form
        document.getElementById('userId').value = user.id;
        document.getElementById('firstName').value = user.first_name;
        document.getElementById('lastName').value = user.last_name;
        document.getElementById('username').value = user.username;
        document.getElementById('email').value = user.email;
        document.getElementById('role').value = user.role;
        document.getElementById('patientId').value = user.patient_id || '';
        document.getElementById('isActive').value = user.is_active.toString();
        
        // Update modal
        document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Edit User';
        document.getElementById('password').required = false;
        document.getElementById('passwordSection').style.display = 'none';
        
        togglePatientAccess();
        
        // Show modal
        new bootstrap.Modal(document.getElementById('userModal')).show();
        
    } catch (error) {
        showAlert('Error loading user for editing: ' + error.message, 'danger');
    }
}

// Save user
async function saveUser() {
    const form = document.getElementById('userForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        role: document.getElementById('role').value,
        patientId: document.getElementById('patientId').value || null,
        isActive: document.getElementById('isActive').value === 'true'
    };
    
    // Add password for new users
    if (!currentEditingId) {
        const password = document.getElementById('password').value;
        if (!password || password.length < 6) {
            showAlert('Password must be at least 6 characters long', 'warning');
            return;
        }
        userData.password = password;
    }
    
    console.log('User data:', userData);
    
    try {
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';
        
        let response;
        if (currentEditingId) {
            response = await apiCall(`/users/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        } else {
            response = await apiCall('/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        }
        
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
            loadUsers(); // Reload the users list
        } else {
            showAlert(response.error || 'Failed to save user', 'danger');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showAlert('Error saving user: ' + error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveUserBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = currentEditingId ? 
            '<i class="bi bi-save"></i> Update User' : 
            '<i class="bi bi-save"></i> Save User';
    }
}

// Delete user
async function deleteUser(userId, userName, userRole) {
    if (!confirm(`Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    if (userRole === 'admin') {
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
            showAlert('Cannot delete the last admin user', 'warning');
            return;
        }
    }
    
    try {
        const response = await apiCall(`/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            loadUsers(); // Reload the users list
        } else {
            showAlert(response.error || 'Failed to delete user', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting user: ' + error.message, 'danger');
    }
}

// Open reset password modal
function openResetPasswordModal(userId, userName) {
    document.getElementById('resetUserId').value = userId;
    document.getElementById('resetPasswordForm').reset();
    
    const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
    modal.show();
}

// Reset password
async function resetPassword() {
    const userId = document.getElementById('resetUserId').value;
    const newPassword = document.getElementById('newPassword').value;
    
    if (!newPassword || newPassword.length < 6) {
        showAlert('Password must be at least 6 characters long', 'warning');
        return;
    }
    
    try {
        const response = await apiCall(`/users/${userId}/reset-password`, {
            method: 'PUT',
            body: JSON.stringify({ newPassword })
        });
        
        if (response.success) {
            showAlert(response.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal')).hide();
        } else {
            showAlert(response.error || 'Failed to reset password', 'danger');
        }
    } catch (error) {
        showAlert('Error resetting password: ' + error.message, 'danger');
    }
}