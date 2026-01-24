// ================================
// TOAST NOTIFICATION SYSTEM
// NGM HUB - Global Module
// ================================

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultDuration: 5000,      // 5 seconds
        errorDuration: 8000,        // 8 seconds for errors (more time to read)
        maxToasts: 5,               // Maximum toasts shown at once
        position: 'top-right'
    };

    // Icons for each toast type
    const ICONS = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'i'
    };

    // Ensure container exists
    function getContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    // Create a toast element
    function createToastElement(type, title, message, details) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = 'toast-icon';
        iconEl.textContent = ICONS[type] || 'i';
        toast.appendChild(iconEl);

        // Content
        const contentEl = document.createElement('div');
        contentEl.className = 'toast-content';

        const titleEl = document.createElement('div');
        titleEl.className = 'toast-title';
        titleEl.textContent = title;
        contentEl.appendChild(titleEl);

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.className = 'toast-message';
            messageEl.textContent = message;
            contentEl.appendChild(messageEl);
        }

        if (details) {
            const detailsEl = document.createElement('div');
            detailsEl.className = 'toast-details';
            detailsEl.textContent = details;
            contentEl.appendChild(detailsEl);
        }

        toast.appendChild(contentEl);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close notification');
        toast.appendChild(closeBtn);

        return toast;
    }

    // Show a toast notification
    function showToast(type, title, message, options = {}) {
        const container = getContainer();
        const duration = options.duration ?? (type === 'error' ? CONFIG.errorDuration : CONFIG.defaultDuration);
        const details = options.details || null;
        const persistent = options.persistent || false;

        // Create toast element
        const toast = createToastElement(type, title, message, details);

        // Add progress bar for auto-dismiss toasts
        if (!persistent && duration > 0) {
            const progressContainer = document.createElement('div');
            progressContainer.className = 'toast-progress';
            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress-bar';
            progressBar.style.width = '100%';
            progressContainer.appendChild(progressBar);
            toast.appendChild(progressContainer);

            // Animate progress bar
            requestAnimationFrame(() => {
                progressBar.style.transition = `width ${duration}ms linear`;
                progressBar.style.width = '0%';
            });
        }

        // Remove oldest toast if at max
        const existingToasts = container.querySelectorAll('.toast:not(.toast-hiding)');
        if (existingToasts.length >= CONFIG.maxToasts) {
            dismissToast(existingToasts[0]);
        }

        // Add to container
        container.appendChild(toast);

        // Auto-dismiss timer
        let dismissTimer = null;
        if (!persistent && duration > 0) {
            dismissTimer = setTimeout(() => {
                dismissToast(toast);
            }, duration);
        }

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            if (dismissTimer) clearTimeout(dismissTimer);
            dismissToast(toast);
        });

        // Log to console for debugging
        const logMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
        console[logMethod](`[TOAST ${type.toUpperCase()}] ${title}${message ? ': ' + message : ''}${details ? '\nDetails: ' + details : ''}`);

        return toast;
    }

    // Dismiss a toast with animation
    function dismissToast(toast) {
        if (!toast || toast.classList.contains('toast-hiding')) return;

        toast.classList.add('toast-hiding');

        toast.addEventListener('animationend', () => {
            toast.remove();
        }, { once: true });

        // Fallback removal in case animationend doesn't fire
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }

    // Clear all toasts
    function clearAll() {
        const container = getContainer();
        const toasts = container.querySelectorAll('.toast');
        toasts.forEach(toast => dismissToast(toast));
    }

    // Public API
    window.Toast = {
        success: (title, message, options) => showToast('success', title, message, options),
        error: (title, message, options) => showToast('error', title, message, options),
        warning: (title, message, options) => showToast('warning', title, message, options),
        info: (title, message, options) => showToast('info', title, message, options),
        show: showToast,
        dismiss: dismissToast,
        clearAll: clearAll,
        config: CONFIG
    };

    // Also expose as ngmToast for namespacing
    window.ngmToast = window.Toast;

})();
