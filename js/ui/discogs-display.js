import { debounce } from '../utils/shared-utils.js';
import dataCache from '../utils/shared-data.js';

// Media type to image filename
const MEDIA_IMAGES = {
	'Vinyl': 'vinyl-record.png',
	'CD': 'cd-disc.png',
	'Cassette': 'cassette-tape.png'
};

// How many records to show at different screen sizes
function getRecordCount() {
	const width = window.innerWidth;
	if (width <= 640) return 2;
	if (width <= 1024) return 3;
	return 5;
}

// Utility to pause execution for a set time (in milliseconds)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch records with specific handling for Rate Limiting (429)
async function fetchRecords(endpoint, retries = 3, delay = 1000) {
	const url = `${endpoint}?count=5`;
	
	try {
		// Attempt the fetch via your dataCache
		return await dataCache.fetch(url);
		
	} catch (error) {
		// Check if we have retries left and if the error looks like a rate limit
		// (Assuming your dataCache/fetch error object includes a 'status' or 'code')
		const isRateLimit = error.status === 429 || error.code === 429;
		
		if (retries > 0 && isRateLimit) {
			console.warn(`Rate limit hit for ${endpoint}. Retrying in ${delay}ms...`);
			
			// Wait for the delay duration
			await wait(delay);
			
			// Recursive call: Decrement retries, double the delay (Exponential Backoff)
			return fetchRecords(endpoint, retries - 1, delay * 2);
		}
		
		// If it's not a 429 or we ran out of retries, throw the error normally
		throw error;
	}
}

// Create a single record element from template
function createRecord(template, data, showPrice) {
	const clone = template.content.cloneNode(true);
	
	// Link
	clone.querySelector('.record-link').href = data.url || '#';
	
	// Cover image
	const cover = clone.querySelector('.album-art');
	const artist = data.artist?.replace(/\s\(\d+\)$/, '') || 'Unknown';
	cover.src = data.cover_image || '';
	cover.alt = `${data.title || 'Unknown'} by ${artist}`;
	
	// Artist
	clone.querySelector('.record-artist').textContent = artist;
	
	// Title
	const title = clone.querySelector('.record-title');
	title.textContent = data.title || 'Unknown';
	if (data.rating === 5) title.classList.add('is-favorite');
	
	// Media type image
	const mediaType = data.mediaType || 'Vinyl';
	const mediaImg = clone.querySelector('.album-media');
	mediaImg.src = `/images/assets/png/${MEDIA_IMAGES[mediaType] || MEDIA_IMAGES.Vinyl}`;
	mediaImg.alt = `${mediaType} format`;
	
	// Add media type class
	clone.querySelector('.discogs-record').classList.add(`is-${mediaType.toLowerCase()}`);
	
	// Price (for sale items only)
	if (showPrice && data.price) {
		clone.querySelector('.record-price').textContent = `$${data.price}`;
	}
	
	return clone;
}

// Render records to the page
function renderRecords(sleeveContainer, captionContainer, template, records, showPrice) {
	if (!records?.length) {
		sleeveContainer.innerHTML = '<p>No records available</p>';
		captionContainer.innerHTML = '';
		return;
	}
	
	const sleeveFragment = document.createDocumentFragment();
	const captionFragment = document.createDocumentFragment();
	
	records.forEach(record => {
		const element = createRecord(template, record, showPrice);
		const [sleeve, caption] = element.children;
		
		sleeveFragment.appendChild(sleeve);
		captionFragment.appendChild(caption);
	});
	
	sleeveContainer.innerHTML = '';
	captionContainer.innerHTML = '';
	sleeveContainer.appendChild(sleeveFragment);
	captionContainer.appendChild(captionFragment);
	
	// Album hover effects
	initAlbumHover();
}

// Initialize hover effects for album sleeves
function initAlbumHover() {
	let zIndex = 10;
	
	document.querySelectorAll('.album-sleeve').forEach(album => {
		const parent = album.closest('.discogs-record');
		
		album.addEventListener('mouseenter', () => {
			album.classList.add('is-active');
			album.classList.remove('is-leaving');
			if (parent) {
				parent.classList.add('is-active');
				parent.classList.remove('is-leaving');
				// Always ensure the active card is higher than the last one visited
				parent.style.zIndex = zIndex++;
			}
		});
		
		album.addEventListener('mouseleave', () => {
			album.classList.remove('is-active');
			album.classList.add('is-leaving');
			if (parent) {
				parent.classList.remove('is-active');
				parent.classList.add('is-leaving');
			}
			
			// Use { once: true } to prevent event listener buildup
			album.addEventListener('transitionend', function cleanup(e) {
				if (e.propertyName === 'transform') {
					album.classList.remove('is-leaving');
					if (parent) {
						parent.classList.remove('is-leaving');
						// DELETED: parent.style.zIndex = ''; 
						// keeping the z-index ensures it stays above 
						// neighbors until a new one is hovered.
					}
				}
			}, { once: true });
		});
	});
}

// Display collection
async function displayCollection() {
	const sleeveContainer = document.getElementById('discogs-sleeve-container');
	const captionContainer = document.getElementById('discogs-caption-container');
	const template = document.getElementById('record-template');
	
	if (!sleeveContainer || !captionContainer || !template) return;
	
	sleeveContainer.classList.add('is-loading');
	
	try {
		const records = await fetchRecords('/.netlify/functions/get-record');
		const count = getRecordCount();
		renderRecords(sleeveContainer, captionContainer, template, records.slice(0, count), false);
	} catch (error) {
		console.error('Failed to load collection:', error);
		sleeveContainer.innerHTML = '<p class="error-message">Could not fetch records at this time.</p>';
		captionContainer.innerHTML = '';
	} finally {
		sleeveContainer.classList.remove('is-loading');
	}
}

// Display inventory (for sale)
async function displayInventory() {
	const sleeveContainer = document.getElementById('discogs-inventory-sleeve-container');
	const captionContainer = document.getElementById('discogs-inventory-caption-container');
	const template = document.getElementById('inventory-item-template');
	
	if (!sleeveContainer || !captionContainer || !template) return;
	
	sleeveContainer.classList.add('is-loading');
	
	try {
		const records = await fetchRecords('/.netlify/functions/get-inventory');
		const count = getRecordCount();
		renderRecords(sleeveContainer, captionContainer, template, records.slice(0, count), true);
	} catch (error) {
		console.error('Failed to load inventory:', error);
		sleeveContainer.innerHTML = '<p class="error-message">Could not fetch sale items.</p>';
		captionContainer.innerHTML = '';
	} finally {
		sleeveContainer.classList.remove('is-loading');
	}
}

// Re-render on window resize
const handleResize = debounce(() => {
	// Re-fetch from cache (instant since cached)
	const collectionContainer = document.getElementById('discogs-sleeve-container');
	const inventoryContainer = document.getElementById('discogs-inventory-sleeve-container');
	
	if (collectionContainer && dataCache.has('/.netlify/functions/get-record?count=5')) {
		displayCollection();
	}
	
	if (inventoryContainer && dataCache.has('/.netlify/functions/get-inventory?count=5')) {
		displayInventory();
	}
}, 250);

// Initialize
if (document.getElementById('discogs-collection-wrapper')) {
	displayCollection();
}

if (document.getElementById('discogs-inventory-wrapper')) {
	displayInventory();
}

window.addEventListener('resize', handleResize);