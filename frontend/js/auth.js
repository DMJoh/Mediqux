class AuthManager {
    constructor() {
        this.baseURL = window.getApiBaseUrl();
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
        
        this.validateAndClearTokens();
        
        if (window.location.pathname.includes('login.html')) {
            this.initLoginPage();
        } else {
            this.checkAuth();
        }
    }

    validateAndClearTokens() {
        if (this.token) {
            const tokenParts = this.token.split('.');
            if (tokenParts.length !== 3 || this.token.length < 50) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                this.token = null;
                this.user = null;
            }
        }
    }

    async initLoginPage() {
        await this.checkInitialSetup();
        
        this.setupLoginEventListeners();
    }

    async checkInitialSetup() {
        try {
            const response = await fetch(`${this.baseURL}/auth/initial-config`, {
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
                document.getElementById('setupAlert').classList.remove('d-none');
                this.showSignupForm();
                document.getElementById('signupLink').classList.add('d-none');
            } else {
                this.showLoginForm();
            }
        } catch (error) {
            console.error('Setup check failed:', error);
            this.showError('Failed to check system setup');
        }
    }

    setupLoginEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('signupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSignup();
        });

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

        document.getElementById('showSignup')?.addEventListener('click', () => {
            this.showSignupForm();
        });

        document.getElementById('backToLogin')?.addEventListener('click', () => {
            this.showLoginForm();
        });
    }

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
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data.user));
                
                this.showSuccess('Login successful! Redirecting...');
                
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

    async handleSignup() {
        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

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
                localStorage.setItem('authToken', result.data.token);
                localStorage.setItem('user', JSON.stringify(result.data.user));
                
                this.showSuccess('Account created successfully! Redirecting...');
                
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

    showSignupForm() {
        document.getElementById('loginForm').classList.add('d-none');
        document.getElementById('signupSection').classList.remove('d-none');
        document.getElementById('signupLink').classList.add('d-none');
        document.documentElement.style.setProperty('--login-visibility', 'visible');
    }

    showLoginForm() {
        document.getElementById('loginForm').classList.remove('d-none');
        document.getElementById('signupSection').classList.add('d-none');
        document.getElementById('signupLink').classList.remove('d-none');
        document.documentElement.style.setProperty('--login-visibility', 'visible');
    }

    checkAuth() {
        if (!this.token || !this.user) {
            this.redirectToLogin();
            return false;
        }
        
        this.updateUserInfo();
        return true;
    }

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
            
            this.updateAdminElements();
        }
    }
    
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
        
        userOnlyElements.forEach(el => {
            if (!isAdmin) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
        
        this.updateRoleBasedNavigation();
    }
    
    updateRoleBasedNavigation() {
        if (!this.user) return;
        
        const isAdmin = this.user.role === 'admin';
        
        if (!isAdmin && this.user.patient_id) {
            const userRoleElements = document.querySelectorAll('.user-role');
            userRoleElements.forEach(el => {
                el.textContent = 'Limited Access User';
            });
            
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
        
        this.updateActionButtons();
    }
    
    updateActionButtons() {
        if (!this.user) return;
        
        const isAdmin = this.user.role === 'admin';
        
        const restrictedButtons = document.querySelectorAll('.admin-action');
        restrictedButtons.forEach(button => {
            if (isAdmin) {
                button.style.display = '';
            } else {
                button.style.display = 'none';
            }
        });
    }

    async apiRequest(endpoint, options = {}) {
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };
        
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
                this.logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        this.token = null;
        this.user = null;
        this.redirectToLogin();
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

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

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showAlert(message, type) {
        const existingAlerts = document.querySelectorAll('.auth-alert');
        existingAlerts.forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} auth-alert alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const cardBody = document.querySelector('.card-body');
        if (cardBody) {
            cardBody.insertBefore(alert, cardBody.firstChild);
        }

        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

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