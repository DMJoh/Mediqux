// Immediately apply saved theme to prevent flash
(function() {
    const savedTheme = localStorage.getItem('mediqux-theme') || 'light';
    const htmlElement = document.documentElement;
    
    if (savedTheme === 'dark') {
        htmlElement.setAttribute('data-bs-theme', 'dark');
    } else {
        htmlElement.setAttribute('data-bs-theme', 'light');
    }
})();

// Theme Management for Mediqux
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('mediqux-theme') || 'light';
        this.init();
    }

    init() {
        // Apply saved theme
        this.applyTheme(this.currentTheme);
        
        // Create and add theme toggle button
        this.createThemeToggle();
        
        // Listen for system theme changes
        this.watchSystemTheme();
    }

    applyTheme(theme) {
        const htmlElement = document.documentElement;
        
        if (theme === 'dark') {
            htmlElement.setAttribute('data-bs-theme', 'dark');
        } else {
            htmlElement.setAttribute('data-bs-theme', 'light');
        }
        
        this.currentTheme = theme;
        localStorage.setItem('mediqux-theme', theme);
        
        // Update toggle button icon
        this.updateToggleIcon();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    createThemeToggle() {
        // Check if toggle already exists
        if (document.getElementById('theme-toggle')) {
            return;
        }

        // Try to add to navbar first, fallback to body
        const navbar = document.querySelector('.navbar .container');
        const userDropdown = document.querySelector('.nav-item.dropdown');
        
        if (navbar && userDropdown) {
            // Create toggle button for navbar
            const toggle = document.createElement('button');
            toggle.id = 'theme-toggle';
            toggle.className = 'btn btn-outline-secondary me-3 theme-toggle-nav';
            toggle.setAttribute('aria-label', 'Toggle theme');
            toggle.setAttribute('title', 'Toggle light/dark theme');
            
            // Add click handler
            toggle.addEventListener('click', () => this.toggleTheme());
            
            // Insert before user dropdown
            userDropdown.parentNode.insertBefore(toggle, userDropdown);
        } else {
            // Fallback: create floating toggle
            const toggle = document.createElement('button');
            toggle.id = 'theme-toggle';
            toggle.className = 'theme-toggle-float';
            toggle.setAttribute('aria-label', 'Toggle theme');
            toggle.setAttribute('title', 'Toggle light/dark theme');
            
            // Add click handler
            toggle.addEventListener('click', () => this.toggleTheme());
            
            // Add to body
            document.body.appendChild(toggle);
        }
        
        // Update initial icon
        this.updateToggleIcon();
    }

    updateToggleIcon() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;

        if (this.currentTheme === 'dark') {
            toggle.innerHTML = '<i class="bi bi-sun-fill"></i>'; // Sun icon for switching to light
            toggle.setAttribute('title', 'Switch to light theme');
        } else {
            toggle.innerHTML = '<i class="bi bi-moon-fill"></i>'; // Moon icon for switching to dark  
            toggle.setAttribute('title', 'Switch to dark theme');
        }
    }

    watchSystemTheme() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            mediaQuery.addEventListener('change', (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!localStorage.getItem('mediqux-theme')) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Get current theme
    getTheme() {
        return this.currentTheme;
    }

    // Set theme programmatically
    setTheme(theme) {
        if (theme === 'light' || theme === 'dark') {
            this.applyTheme(theme);
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.themeManager = new ThemeManager();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}