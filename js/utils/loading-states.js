/**
 * Loading State Manager
 * @file loading-states.js
 * 
 * Centralized loading state management for consistent UX
 */

/**
 * @typedef {Object} LoadingOptions
 * @property {string} [message='Loading...'] - Loading message
 * @property {boolean} [spinner=true] - Show spinner
 * @property {string} [size='medium'] - Spinner size: 'small', 'medium', 'large'
 */

export class LoadingStateManager {
	/**
	 * Show loading state on element
	 * @param {HTMLElement} element - Target element
	 * @param {LoadingOptions} [options={}] - Loading options
	 * @returns {Function} Cleanup function to remove loading state
	 */
	static show(element, options = {}) {
		const {
			message = 'Loading...',
				spinner = true,
				size = 'medium'
		} = options;

		// Store original content
		const originalContent = element.innerHTML;
		const originalAriaLive = element.getAttribute('aria-live');
		const originalAriaBusy = element.getAttribute('aria-busy');

		// Create loading content
		const loadingDiv = document.createElement('div');
		loadingDiv.className = `loading-state loading-state--${size}`;
		loadingDiv.setAttribute('role', 'status');
		loadingDiv.setAttribute('aria-live', 'polite');

		if (spinner) {
			const spinnerEl = document.createElement('div');
			spinnerEl.className = 'loading-spinner';
			spinnerEl.setAttribute('aria-hidden', 'true');
			loadingDiv.appendChild(spinnerEl);
		}

		const messageEl = document.createElement('span');
		messageEl.className = 'loading-message';
		messageEl.textContent = message;
		loadingDiv.appendChild(messageEl);

		// Apply loading state
		element.innerHTML = '';
		element.appendChild(loadingDiv);
		element.classList.add('is-loading');
		element.setAttribute('aria-busy', 'true');

		// Return cleanup function
		return () => {
			element.classList.remove('is-loading');
			element.innerHTML = originalContent;

			if (originalAriaLive !== null) {
				element.setAttribute('aria-live', originalAriaLive);
			} else {
				element.removeAttribute('aria-live');
			}

			if (originalAriaBusy !== null) {
				element.setAttribute('aria-busy', originalAriaBusy);
			} else {
				element.removeAttribute('aria-busy');
			}
		};
	}

	/**
	 * Show loading state and execute async function
	 * @param {HTMLElement} element - Target element
	 * @param {Function} asyncFn - Async function to execute
	 * @param {LoadingOptions} [options={}] - Loading options
	 * @returns {Promise<any>} Result of async function
	 */
	static async withLoading(element, asyncFn, options = {}) {
		const cleanup = LoadingStateManager.show(element, options);

		try {
			const result = await asyncFn();
			return result;
		} finally {
			cleanup();
		}
	}

	/**
	 * Create inline spinner (for buttons, etc.)
	 * @param {string} [size='small'] - Spinner size
	 * @returns {HTMLElement} Spinner element
	 */
	static createSpinner(size = 'small') {
		const spinner = document.createElement('span');
		spinner.className = `inline-spinner inline-spinner--${size}`;
		spinner.setAttribute('role', 'status');
		spinner.setAttribute('aria-label', 'Loading');
		return spinner;
	}
}

// Convenience exports
export const { show: showLoading, withLoading, createSpinner } = LoadingStateManager;