// ============================================================================
// Configuration
// ============================================================================
import AlbumHoverManager from './candy.js';
import { debounce } from './shared-utils.js';

const CONFIG = {
	mediaImages: {
		Vinyl: 'vinyl-record.png',
		CD: 'cd-disc.png',
		Cassette: 'cassette-tape.png',
		default: 'vinyl-record.png'
	},

	breakpoints: [
		{ maxWidth: 640, count: 2 },
		{ maxWidth: 1024, count: 3 },
		{ maxWidth: Infinity, count: 5 }
	]
};

// ============================================================================
// Utility Functions
// ============================================================================

const cleanArtistName = (artist) => {
	if (!artist) return '';
	return artist.replace(/\s\(\d+\)$/, '');
};

const getRecordCount = () => {
	const width = window.innerWidth;
	const breakpoint = CONFIG.breakpoints.find(bp => width <= bp.maxWidth);
	return breakpoint?.count ?? 5;
};

const getMaxRecordCount = () => {
	return Math.max(...CONFIG.breakpoints.map(bp => bp.count));
};

const fetchFromApi = async (endpoint) => {
	try {
		const response = await fetch(endpoint);

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		return response.json();
	} catch (error) {
		console.error(`Failed to fetch from ${endpoint}:`, error);
		throw error;
	}
};

// ============================================================================
// DOM Manipulation
// ============================================================================

const createRecordElement = (template, data, options = {}) => {
	const { showPrice = false } = options;

	try {
		const clone = template.content.cloneNode(true);

		const recordLink = clone.querySelector('.record-link');
		if (recordLink) {
			recordLink.href = data.url || '#';
		}

		const coverImg = clone.querySelector('.album-art');
		if (coverImg) {
			coverImg.src = data.cover_image || '';
			coverImg.alt = `Cover art for ${data.title || 'Unknown'} by ${cleanArtistName(data.artist) || 'Unknown'}`;
		}

		const artistEl = clone.querySelector('.record-artist');
		if (artistEl) {
			artistEl.textContent = cleanArtistName(data.artist);
		}

		const titleEl = clone.querySelector('.record-title');
		if (titleEl) {
			titleEl.textContent = data.title || 'Unknown';

			if (data.rating === 5) {
				titleEl.classList.add('is-favorite');
			}
		}

		const mediaType = data.mediaType || 'Vinyl';
		const imageName = CONFIG.mediaImages[mediaType] || CONFIG.mediaImages.default;
		const slideOutImage = clone.querySelector('.album-media');
		if (slideOutImage) {
			slideOutImage.src = `/images/assets/png/${imageName}`;
			slideOutImage.alt = `${mediaType} format`;
		}

		const recordElement = clone.querySelector('.discogs-record');
		if (recordElement && mediaType) {
			recordElement.classList.add(`is-${mediaType.toLowerCase()}`);
		}

		if (showPrice && data.price) {
			const priceEl = clone.querySelector('.record-price');
			if (priceEl) {
				priceEl.textContent = `$${data.price}`;
			}
		}

		return clone;
	} catch (error) {
		console.error('Error creating record element:', data, error);
		return null;
	}
};

const renderRecords = (sleeveContainer, captionContainer, template, records, options = {}) => {
	if (!sleeveContainer || !captionContainer || !template) {
		console.error('One or more containers or template not found for rendering records');
		return;
	}

	if (!Array.isArray(records) || records.length === 0) {
		console.warn('No records to render');
		sleeveContainer.innerHTML = '<p>No records available</p>';
		captionContainer.innerHTML = '';
		return;
	}

	try {
		sleeveContainer.innerHTML = '';
		captionContainer.innerHTML = '';

		const sleeveFragment = document.createDocumentFragment();
		const captionFragment = document.createDocumentFragment();

		records.forEach(record => {
			const element = createRecordElement(template, record, options);

			if (element) {
				const sleeve = element.children[0];
				const caption = element.children[1];

				if (sleeve && caption) {
					sleeveFragment.appendChild(sleeve);
					captionFragment.appendChild(caption);
				} else {
					console.warn('Template clone does not have two element children', element);
				}
			}
		});

		sleeveContainer.appendChild(sleeveFragment);
		captionContainer.appendChild(captionFragment);

		// Initialize hover manager on the sleeves
		new AlbumHoverManager('.album-sleeve');
	} catch (error) {
		console.error('Error rendering records:', error);
		showError(sleeveContainer, 'Failed to display records');
		if (captionContainer) captionContainer.innerHTML = '';
	}
};

const showError = (container, message) => {
	if (!container) return;

	try {
		container.innerHTML = '';

		const errorElement = document.createElement('p');
		errorElement.className = 'error-message';
		errorElement.textContent = message;
		container.appendChild(errorElement);
	} catch (error) {
		console.error('Error showing error message:', error);
	}
};

// ============================================================================
// Main Display Functions
// ============================================================================

// Cache objects to store fetched data
const recordsCache = { data: null };
const inventoryCache = { data: null };

const displayRecords = async (config) => {
	const {
		sleeveContainerId,
		captionContainerId,
		templateId,
		apiEndpoint,
		cache,
		showPrice = false,
		errorMessage = 'Could not fetch records at this time.'
	} = config;

	const sleeveContainer = document.getElementById(sleeveContainerId);
	const captionContainer = document.getElementById(captionContainerId);
	const template = document.getElementById(templateId);

	if (!sleeveContainer || !captionContainer) {
		console.error(`Container not found: ${sleeveContainerId} or ${captionContainerId}`);
		return;
	}

	if (!template) {
		console.error(`Template not found: ${templateId}`);
		return;
	}

	// Show loading state
	sleeveContainer.classList.add('is-loading');
	sleeveContainer.setAttribute('aria-busy', 'true');

	try {
		const maxCount = getMaxRecordCount();
		const records = await fetchFromApi(`${apiEndpoint}?count=${maxCount}`);

		if (!Array.isArray(records)) {
			throw new Error('Invalid response format from API');
		}

		// Cache the results
		cache.data = records;

		const count = getRecordCount();
		// Pass both containers to renderRecords
		renderRecords(sleeveContainer, captionContainer, template, records.slice(0, count), { showPrice });
	} catch (error) {
		console.error(`Error fetching from ${apiEndpoint}:`, error);
		showError(sleeveContainer, errorMessage);
		if (captionContainer) captionContainer.innerHTML = '';
	} finally {
		// Always remove loading state
		sleeveContainer.classList.remove('is-loading');
		sleeveContainer.setAttribute('aria-busy', 'false');
	}
};

const displayRandomRecords = async () => {
	await displayRecords({
		sleeveContainerId: 'discogs-sleeve-container',
		captionContainerId: 'discogs-caption-container',
		templateId: 'record-template',
		apiEndpoint: '/.netlify/functions/get-record',
		cache: recordsCache,
		showPrice: false,
		errorMessage: 'Could not fetch records at this time.'
	});
};

const displayInventory = async () => {
	await displayRecords({
		sleeveContainerId: 'discogs-inventory-sleeve-container',
		captionContainerId: 'discogs-inventory-caption-container',
		templateId: 'inventory-item-template',
		apiEndpoint: '/.netlify/functions/get-inventory',
		cache: inventoryCache,
		showPrice: true,
		errorMessage: 'Could not fetch sale items.'
	});
};

// ============================================================================
// Responsive Handling
// ============================================================================

const reRenderSection = (sleeveContainerId, captionContainerId, templateId, cache, showPrice = false) => {
	const sleeveContainer = document.getElementById(sleeveContainerId);
	const captionContainer = document.getElementById(captionContainerId);
	const template = document.getElementById(templateId);

	if (!sleeveContainer || !captionContainer || !template) {
		console.warn(`Cannot re-render section: ${sleeveContainerId}`);
		return;
	}

	if (!cache.data || !Array.isArray(cache.data)) {
		console.warn(`No cached data for section: ${sleeveContainerId}`);
		return;
	}

	try {
		const count = getRecordCount();
		// Pass both containers to renderRecords
		renderRecords(sleeveContainer, captionContainer, template, cache.data.slice(0, count), { showPrice });
	} catch (error) {
		console.error(`Error re-rendering section ${sleeveContainerId}:`, error);
	}
};

const handleResize = debounce(() => {
	// Re-render cached records if they exist
	reRenderSection(
		'discogs-sleeve-container',
		'discogs-caption-container',
		'record-template',
		recordsCache,
		false
	);

	// Re-render cached inventory if it exists
	reRenderSection(
		'discogs-inventory-sleeve-container',
		'discogs-inventory-caption-container',
		'inventory-item-template',
		inventoryCache,
		true
	);
}, 250);

// ============================================================================
// Initialization
// ============================================================================

const init = () => {
	try {
		// Display records if a wrapper exists (using the new wrapper ID)
		if (document.getElementById('discogs-collection-wrapper')) {
			displayRandomRecords()
				.catch(error => {
					console.error('Failed to display random records:', error);
				});
		}

		// Display inventory if a wrapper exists (using the new wrapper ID)
		if (document.getElementById('discogs-inventory-wrapper')) {
			displayInventory()
				.catch(error => {
					console.error('Failed to display inventory:', error);
				});
		}

		// Set up resize listener
		window.addEventListener('resize', handleResize);
	} catch (error) {
		console.error('Discogs display initialization failed:', error);
	}
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}