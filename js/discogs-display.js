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

const getMediaType = (formats) => {
  if (!Array.isArray(formats)) return 'Vinyl';
  
  const formatNames = formats.map(f => f.name);
  
  if (formatNames.includes('Vinyl')) return 'Vinyl';
  if (formatNames.includes('CD')) return 'CD';
  if (formatNames.includes('Cassette')) return 'Cassette';
  
  return 'Vinyl';
};

const cleanArtistName = (artist) => artist.replace(/\s\(\d+\)$/, '');

const getRecordCount = () => {
  const width = window.innerWidth;
  const breakpoint = CONFIG.breakpoints.find(bp => width <= bp.maxWidth);
  return breakpoint?.count ?? 5;
};

const getMaxRecordCount = () => {
  return Math.max(...CONFIG.breakpoints.map(bp => bp.count));
};

const fetchFromApi = async (endpoint) => {
  const response = await fetch(endpoint);
  
  if (!response.ok) {
	throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

// ============================================================================
// DOM Manipulation
// ============================================================================

const createRecordElement = (template, data, options = {}) => {
  const { showPrice = false } = options;
  const clone = template.content.cloneNode(true);
  
  clone.querySelector('.record-link').href = data.url;
  
  const coverImg = clone.querySelector('.album-art');
  coverImg.src = data.cover_image;
  coverImg.alt = `Cover art for ${data.title} by ${data.artist}`;
  
  clone.querySelector('.record-artist').textContent = cleanArtistName(data.artist);
  clone.querySelector('.record-title').textContent = data.title;
  
  if (data.rating === 5) {
	clone.querySelector('.record-title').classList.add('is-favorite');
  }
  
  const imageName = CONFIG.mediaImages[data.mediaType] || CONFIG.mediaImages.default;
  const slideOutImage = clone.querySelector('.album-media');
  slideOutImage.src = `/images/assets/png/${imageName}`;
  
  const recordElement = clone.querySelector('.discogs-record');
  if (data.mediaType) {
	recordElement.classList.add(`is-${data.mediaType.toLowerCase()}`);
  }
  
  if (showPrice && data.price) {
	const priceEl = clone.querySelector('.record-price');
	priceEl.textContent = `$${data.price}`;
  }
  
  return clone;
};

const renderRecords = (container, template, records, options = {}) => {
  container.innerHTML = '';
  
  records.forEach(record => {
	const element = createRecordElement(template, record, options);
	container.appendChild(element);
  });
  new AlbumHoverManager('.album-sleeve');
};

const showError = (container, message) => {
  container.innerHTML = '';
  
  const errorElement = document.createElement('p');
  errorElement.textContent = message;
  container.appendChild(errorElement);
};

// ============================================================================
// Main Display Functions
// ============================================================================

// Cache objects to store fetched data
const recordsCache = { data: null };
const inventoryCache = { data: null };

const displayRecords = async (config) => {
  const {
	containerId,
	templateId,
	apiEndpoint,
	cache,
	showPrice = false,
	errorMessage = 'Could not fetch records at this time.'
  } = config;
  
  const container = document.getElementById(containerId);
  const template = document.getElementById(templateId);
  
  if (!container || !template) {
	console.error(`Required elements not found: ${containerId} or ${templateId}`);
	return;
  }
  
  try {
	const maxCount = getMaxRecordCount();
	const records = await fetchFromApi(`${apiEndpoint}?count=${maxCount}`);
	
	// Cache the results
	cache.data = records;
	
	const count = getRecordCount();
	renderRecords(container, template, records.slice(0, count), { showPrice });
  } catch (error) {
	console.error(`Error fetching from ${apiEndpoint}:`, error);
	showError(container, errorMessage);
  }
};

const displayRandomRecords = async () => {
  await displayRecords({
	containerId: 'discogs-record-container',
	templateId: 'record-template',
	apiEndpoint: '/.netlify/functions/get-record',
	cache: recordsCache,
	showPrice: false,
	errorMessage: 'Could not fetch records at this time.'
  });
};

const displayInventory = async () => {
  await displayRecords({
	containerId: 'discogs-inventory-container',
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

const reRenderSection = (containerId, templateId, cache, showPrice = false) => {
  const container = document.getElementById(containerId);
  const template = document.getElementById(templateId);
  
  if (container && template && cache.data) {
	const count = getRecordCount();
	renderRecords(container, template, cache.data.slice(0, count), { showPrice });
  }
};

const handleResize = debounce(() => {
  // Re-render cached records if they exist
  reRenderSection('discogs-record-container', 'record-template', recordsCache, false);
  
  // Re-render cached inventory if it exists
  reRenderSection('discogs-inventory-container', 'inventory-item-template', inventoryCache, true);
}, 250);

// ============================================================================
// Initialization
// ============================================================================
  
const init = () => {
  // Display records if container exists
  if (document.getElementById('discogs-record-container')) {
	displayRandomRecords();
  }
  
  // Display inventory if container exists
  if (document.getElementById('discogs-inventory-container')) {
	displayInventory();
  }
  
  // Set up resize listener
  window.addEventListener('resize', handleResize);
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}