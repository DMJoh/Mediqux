// Authentication management
class AuthManager {
    constructor() {
        this.baseURL = window.getApiBaseUrl();
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        
        // Clear malformed tokens on startup
        this.validateAndClearTokens();
        
        // Initialize if we're on the login page
        if (window.location.pathname.includes('login.html')) {
            this.initLoginPage();
        } else {
            // Check authentication for protected pages
            this.checkAuth();
        }
    }

    // Validate and clear malformed tokens
    validateAndClearTokens() {
        if (this.token) {
            // Check if token looks like a valid JWT (has 3 parts separated by dots)
            const tokenParts = this.token.split('.');
            if (tokenParts.length !== 3 || this.token.length < 50) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                this.token = null;
                this.user = null;
            }
        }
    }

    // Initialize login page functionality
    async initLoginPage() {
        // Check if this is initial setup
        await this.checkInitialSetup();
        
        // Setup event listeners
        this.setupLoginEventListeners();
    }

    // Check if any users exist (initial setup)
    async checkInitialSetup() {
        try {
            // Make request without authentication headers (public endpoint)
            const response = await fetch(`${this.baseURL}/auth/check-setup`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && !result.data.hasUsers) {
                // Show setup alert and signup form
                document.getElementById('setupAlert').classList.remove('d-none');
                this.showSignupForm();
                document.getElementById('signupLink').classList.add('d-none');
            }
        } catch (error) {
            console.error('Setup check failed:', error);
            this.showError('Failed to check system setup');
        }
    }

    // Setup login page event listeners
    setupLoginEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Signup form
        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

        // Toggle password visibility
        document.getElementById('togglePassword').addEventListener('click', () => {
            const passwordField = document.getElementById('password');
            const icon = document.querySelector('#togglePassword i');
            
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                icon.classList.replace('bi-eye', 'bi-eye-slash');
            } else {
                passwordField.type = 'password';
                icon.classList.replace('bi-eye-slash', 'bi-eye');
            }
        });

        // Show signup form
        document.getElementById('showSignup')?.addEventListener('click', () => {
            this.showSignupForm();
        });

        // Back to login
        document.getElementById('backToLogin')?.addEventListener('click', () => {
            this.showLoginForm();
        });
    }

    // Handle login
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showError('Please enter both username and password');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                // Store authentication data
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data.user));
                
                this.showSuccess('Login successful! Redirecting...');
                
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.showError(result.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Login failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    // Handle signup
    async handleSignup() {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (!firstName || !lastName || !username || !email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch(`${this.baseURL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    username,
                    email,
                    password
                })
            });

            const result = await response.json();

            if (result.success) {
                // Store authentication data
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data.user));
                
                this.showSuccess('Account created successfully! Redirecting...');
                
                // Redirect to main app
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.showError(result.error || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Signup failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    // Show signup form
    showSignupForm() {
        document.getElementById('loginForm').classList.add('d-none');
        document.getElementById('signupSection').classList.remove('d-none');
        document.getElementById('signupLink').classList.add('d-none');
    }

    // Show login form
    showLoginForm() {
        document.getElementById('loginForm').classList.remove('d-none');
        document.getElementById('signupSection').classList.add('d-none');
        document.getElementById('signupLink').classList.remove('d-none');
    }

    // Check authentication for protected pages
    checkAuth() {
        if (!this.token || !this.user) {
            this.redirectToLogin();
            return false;
        }
        
        // Add user info to page if elements exist
        this.updateUserInfo();
        return true;
    }

    // Update user info in navigation
    updateUserInfo() {
        const userNameElements = document.querySelectorAll('.user-name');
        const userRoleElements = document.querySelectorAll('.user-role');
        
        if (this.user) {
            userNameElements.forEach(el => {
                el.textContent = `${this.user.firstName} ${this.user.lastName}`;
            });
            
            userRoleElements.forEach(el => {
                el.textContent = this.user.role.charAt(0).toUpperCase() + this.user.role.slice(1);
            });
            
            // Show/hide admin-only elements
            this.updateAdminElements();
        }
    }
    
    // Show/hide admin-only elements based on user role
    updateAdminElements() {
        const adminElements = document.querySelectorAll('.admin-only');
        const userOnlyElements = document.querySelectorAll('.user-only');
        const isAdmin = this.user && this.user.role === 'admin';
        
        adminElements.forEach(el => {
            if (isAdmin) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
        
        // Show user-only elements only for regular users
        userOnlyElements.forEach(el => {
            if (!isAdmin) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
        
        // Update navigation based on user role
        this.updateRoleBasedNavigation();
    }
    
    // Update navigation based on user role
    updateRoleBasedNavigation() {
        if (!this.user) return;
        
        const isAdmin = this.user.role === 'admin';
        
        // For regular users, show info about their assigned patient
        if (!isAdmin && this.user.patient_id) {
            const userRoleElements = document.querySelectorAll('.user-role');
            userRoleElements.forEach(el => {
                el.textContent = 'Limited Access User';
            });
            
            // Add note about limited access
            const userNameElements = document.querySelectorAll('.user-name');
            userNameElements.forEach(el => {
                if (!el.querySelector('.access-note')) {
                    const accessNote = document.createElement('small');
                    accessNote.className = 'access-note d-block text-muted';
                    accessNote.textContent = '(Patient-specific access)';
                    el.appendChild(accessNote);
                }
            });
        }
        
        // Show appropriate add/edit/delete buttons
        this.updateActionButtons();
    }
    
    // Update action buttons based on user role
    updateActionButtons() {
        if (!this.user) return;
        
        const isAdmin = this.user.role === 'admin';
        
        // Hide add/delete buttons for regular users on certain pages
        const restrictedButtons = document.querySelectorAll('.admin-action');
        restrictedButtons.forEach(button => {
            if (isAdmin) {
                button.style.display = '';
            } else {
                button.style.display = 'none';
            }
        });
    }

    // Make authenticated API request
    async apiRequest(endpoint, options = {}) {
        // Set up headers - don't set Content-Type for FormData (file uploads)
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };
        
        // Only set Content-Type to application/json if body is not FormData
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        const config = {
            headers,
            ...options
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            if (response.status === 401 || response.status === 403) {
                // Token expired, invalid, or forbidden - treat as authentication failure
                this.logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Logout
    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;
        this.redirectToLogin();
    }

    // Redirect to login
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    // Show loading spinner
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            if (show) {
                spinner.classList.remove('d-none');
            } else {
                spinner.classList.add('d-none');
            }
        }
    }

    // Show error message
    showError(message) {
        this.showAlert(message, 'danger');
    }

    // Show success message
    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    // Show alert
    showAlert(message, type) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.auth-alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} auth-alert alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Insert at top of card body
        const cardBody = document.querySelector('.card-body');
        if (cardBody) {
            cardBody.insertBefore(alert, cardBody.firstChild);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Setup logout functionality for all pages
document.addEventListener('DOMContentLoaded', () => {
    const logoutButtons = document.querySelectorAll('.logout-btn');
    logoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.authManager) {
                window.authManager.logout();
            }
        });
    });
});