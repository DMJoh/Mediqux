// Environment Configuration for Mediqux Frontend
// This file can be modified for different deployment environments

// Default configuration
const ENV_CONFIG = {
    // Backend API URL - modify this for different environments
    API_BASE_URL: window.MEDIQUX_API_URL || 'http://192.168.10.50:3000/api',
    
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
};

