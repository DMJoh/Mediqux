// Environment Configuration for Medical Management System Frontend
// This file can be modified for different deployment environments

// Default configuration
const ENV_CONFIG = {
    // Backend API URL - modify this for different environments
    API_BASE_URL: window.MED_APP_API_URL || 'http://localhost:3000/api',
    
    // Other configurable options
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    
    // Health check interval (milliseconds)
    HEALTH_CHECK_INTERVAL: 30000,
    
    // Alert auto-close timeout (milliseconds) 
    ALERT_TIMEOUT: 5000
};

// Export configuration
window.ENV_CONFIG = ENV_CONFIG;

// Helper function to get backend URL
window.getApiBaseUrl = function() {
    return ENV_CONFIG.API_BASE_URL;
};

// Helper function to update API URL dynamically (if needed)
window.setApiBaseUrl = function(url) {
    ENV_CONFIG.API_BASE_URL = url;
    console.log('API Base URL updated to:', url);
};

console.log('Frontend configuration loaded:', {
    API_BASE_URL: ENV_CONFIG.API_BASE_URL,
    environment: window.location.hostname === 'localhost' ? 'development' : 'production'
});