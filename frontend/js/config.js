const ENV_CONFIG = {
    API_BASE_URL: window.MEDIQUX_API_URL || 'http://192.168.10.50:3000/api',
    
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    
    HEALTH_CHECK_INTERVAL: 30000,
    
    ALERT_TIMEOUT: 5000
};

window.ENV_CONFIG = ENV_CONFIG;

window.getApiBaseUrl = function() {
    return ENV_CONFIG.API_BASE_URL;
};

window.setApiBaseUrl = function(url) {
    ENV_CONFIG.API_BASE_URL = url;
};

