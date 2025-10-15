// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  mediaImages: {
	Vinyl: 'vinyl-record.png',
	CD: 'cd-disc.png',
	Cassette: 'cassette-tape.png',
	default: 'vinyl-record.png'
  },
  
  // Configure how many records to show at different breakpoints
  // Adjust these values to your needs
  breakpoints: [
	{ maxWidth: 640, count: 2 },   // Mobile: 1 record
	{ maxWidth: 1024, count: 3 },  // Tablet: 3 records
	{ maxWidth: Infinity, count: 5 } // Desktop: 5 records
  ]
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determines the media type from Discogs format data
 */
const getMediaType = (formats) => {
  if (!Array.isArray(formats)) return 'Vinyl';
  
  const formatNames = formats.map(f => f.name);
  
  if (formatNames.includes('Vinyl')) return 'Vinyl';
  if (formatNames.includes('CD')) return 'CD';
  if (formatNames.includes('Cassette')) return 'Cassette';
  
  return 'Vinyl';
};

/**
 * Removes trailing catalog numbers from artist names (e.g., "Artist (123)")
 */
const cleanArtistName = (artist) => artist.replace(/\s\(\d+\)$/, '');

/**
 * Gets the current record count based on viewport width
 */
const getRecordCount = () => {
  const width = window.innerWidth;
  const breakpoint = CONFIG.breakpoints.find(bp => width <= bp.maxWidth);
  return breakpoint?.count ?? 5;
};

/**
 * Fetches data from a Netlify function
 */
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

/**
 * Creates a record element from template and data
 */
const createRecordElement = (template, data, options = {}) => {
  const { showPrice = false } = options;
  const clone = template.content.cloneNode(true);
  
  // Set link
  clone.querySelector('.record-link').href = data.url;
  
  // Set album art
  const coverImg = clone.querySelector('.album-art');
  coverImg.src = data.cover_image;
  coverImg.alt = `Cover art for ${data.title} by ${data.artist}`;
  
  // Set artist and title
  clone.querySelector('.record-artist').textContent = cleanArtistName(data.artist);
  clone.querySelector('.record-title').textContent = data.title;
  
  // Handle favorite star (5-star rating)
  if (data.rating === 5) {
	clone.querySelector('.record-title').classList.add('is-favorite');
  }
  
  // Set media type image
  const imageName = CONFIG.mediaImages[data.mediaType] || CONFIG.mediaImages.default;
  const slideOutImage = clone.querySelector('.slide-out-media');
  slideOutImage.src = `/images/assets/png/${imageName}`;
  
  // Add media type class
  const recordElement = clone.querySelector('.discogs-record');
  if (data.mediaType) {
	recordElement.classList.add(`is-${data.mediaType.toLowerCase()}`);
  }
  
  // Set price if applicable
  if (showPrice && data.price) {
	const priceEl = clone.querySelector('.record-price');
	priceEl.textContent = `$${data.price}`;
  }
  
  return clone;
};

/**
 * Renders records into a container
 */
const renderRecords = (container, template, records, options = {}) => {
  container.innerHTML = '';
  
  records.forEach(record => {
	const element = createRecordElement(template, record, options);
	container.appendChild(element);
  });
};

/**
 * Displays an error message in the container
 */
const showError = (container, message) => {
  container.innerHTML = `<p>${message}</p>`;
};

// ============================================================================
// Main Display Functions
// ============================================================================

/**
 * Fetches and displays random records from collection
 */
const displayRandomRecords = async () => {
  const container = document.getElementById('discogs-record-container');
  const template = document.getElementById('record-template');
  
  if (!container || !template) {
	console.error('Required elements not found: discogs-record-container or record-template');
	return;
  }
  
  try {
	// Always fetch the maximum count, then slice as needed
	const maxCount = Math.max(...CONFIG.breakpoints.map(bp => bp.count));
	const records = await fetchFromApi(`/.netlify/functions/get-record?count=${maxCount}`);
	cachedRecords = records; // Cache for resize events
	
	const count = getRecordCount();
	renderRecords(container, template, records.slice(0, count));
  } catch (error) {
	console.error('Error fetching random records:', error);
	showError(container, 'Could not fetch records at this time.');
  }
};

/**
 * Fetches and displays inventory items for sale
 */
const displayInventory = async () => {
  const container = document.getElementById('discogs-inventory-container');
  const template = document.getElementById('inventory-item-template');
  
  if (!container || !template) {
	console.error('Required elements not found: discogs-inventory-container or inventory-item-template');
	return;
  }
  
  try {
	// Always fetch the maximum count, then slice as needed
	const maxCount = Math.max(...CONFIG.breakpoints.map(bp => bp.count));
	const inventory = await fetchFromApi(`/.netlify/functions/get-inventory?count=${maxCount}`);
	cachedInventory = inventory; // Cache for resize events
	
	const count = getRecordCount();
	renderRecords(container, template, inventory.slice(0, count), { showPrice: true });
  } catch (error) {
	console.error('Error fetching inventory:', error);
	showError(container, 'Could not fetch sale items.');
  }
};

// ============================================================================
// Responsive Handling
// ============================================================================

// Store fetched data to avoid re-fetching on resize
let cachedRecords = null;
let cachedInventory = null;

/**
 * Re-renders existing data when window is resized (no new fetch)
 */
let resizeTimeout;
const handleResize = () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
	const recordContainer = document.getElementById('discogs-record-container');
	const inventoryContainer = document.getElementById('discogs-inventory-container');
	
	// Re-render cached records if they exist
	if (recordContainer && cachedRecords) {
	  const template = document.getElementById('record-template');
	  const count = getRecordCount();
	  renderRecords(recordContainer, template, cachedRecords.slice(0, count));
	}
	
	// Re-render cached inventory if it exists
	if (inventoryContainer && cachedInventory) {
	  const template = document.getElementById('inventory-item-template');
	  const count = getRecordCount();
	  renderRecords(inventoryContainer, template, cachedInventory.slice(0, count), { showPrice: true });
	}
  }, 250); // Debounce resize events
};

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the Discogs display functionality
 */
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