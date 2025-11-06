import { CONFIG } from './config.js';
import { formatExifDate, normalizeImagePath } from '../shared-utils.js';
import dataCache from '../shared-data.js';

const STATS_LIMITS = {
	TOP_ARTISTS: 7,
	TOP_VENUES: 8
};

export const dataService = {
	/**
	 * Fetch data with error handling
	 * @param {string} url - URL to fetch
	 * @returns {Promise<any|null>} Data or null on error
	 */
	async fetchData(url) {
		try {
			return await dataCache.fetch(url); // ✅ Can throw
		} catch (error) {
			console.error(`Error fetching ${url}:`, error);
			return null; // ✅ Return null - let caller decide what to do
		}
	},

	/**
	 * Fetch all application data
	 * @returns {Promise<Object>} Object with all data (some may be null)
	 */
	async getAllData() {
		// Fetch all in parallel, don't let one failure break others
		const [exifData, productions, mountains, concerts] = await Promise.allSettled([
			this.fetchData(CONFIG.urls.exif),
			this.fetchData(CONFIG.urls.productions),
			this.fetchData(CONFIG.urls.mountains),
			this.fetchData(CONFIG.urls.concerts)
		]);

		return {
			productions: productions.status === 'fulfilled' ? productions.value : null,
			mountains: mountains.status === 'fulfilled' ? mountains.value : null,
			concerts: concerts.status === 'fulfilled' ? concerts.value : null,
			exifData: exifData.status === 'fulfilled' ? (exifData.value || {}) : {}
		};
	}
};

// ============================================================================
// Productions Processor
// ============================================================================

/**
 * Process productions data
 * @param {Array|null} data - Raw productions data
 * @returns {Array} Processed productions (empty array if null)
 */
export function processProductionsData(data) {
	return Array.isArray(data) ? data : []; // ✅ Safe default
}

// ============================================================================
// Mountain Processor
// ============================================================================

/**
 * Process single mountain entry
 * @param {Object} mountain - Mountain data
 * @param {Object} exifDataset - EXIF data
 * @returns {Object} Processed mountain data
 */
function processMountain(mountain, exifDataset) {
	let displayDate = mountain.Date;

	if (mountain.Image && exifDataset) {
		const normalizedPath = normalizeImagePath(mountain.Image);
		const exifEntry = exifDataset?.[normalizedPath];

		if (exifEntry?.date) {
			const formattedDate = formatExifDate(exifEntry.date);
			if (formattedDate) {
				displayDate = formattedDate;
			}
		}
	}

	return {
		...mountain,
		displayDate,
		year: displayDate ? displayDate.substring(0, 4) : 'N/A'
	};
}

/**
 * Process mountains data
 * @param {Array|null} data - Raw mountains data
 * @param {Object} exifData - EXIF data
 * @returns {Array} Processed and sorted mountains
 */
export function processMountainsData(data, exifData) {
	if (!Array.isArray(data)) {
		console.warn('Mountains data is not an array');
		return []; // ✅ Safe default
	}

	try {
		const processed = data
			.map(mountain => processMountain(mountain, exifData))
			.sort((a, b) => b.displayDate.localeCompare(a.displayDate));

		return processed;
	} catch (error) {
		console.error('Error processing mountains data:', error);
		return []; // ✅ Safe default
	}
}

/**
 * Calculate mountain statistics
 * @param {Array} mountains - Processed mountains data
 * @returns {Object} Statistics object
 */
export function calculateMountainStats(mountains) {
	if (!Array.isArray(mountains)) {
		console.warn('Mountains data is not an array');
		return { total: 0, thirteeners: 0, fourteeners: 0 }; // ✅ Safe default
	}

	const uniquePeaks = new Set();
	const counts = { thirteeners: 0, fourteeners: 0 };

	mountains.forEach(m => {
		if (!m?.Peak || !m?.Elevation) return; // ✅ Skip invalid entries

		if (uniquePeaks.has(m.Peak)) return;

		uniquePeaks.add(m.Peak);
		
		try {
			const elev = parseInt(m.Elevation.replace(/,/g, ''), 10);

			if (isNaN(elev)) {
				console.warn(`Invalid elevation for ${m.Peak}: ${m.Elevation}`);
				return;
			}

			if (elev >= 14000) {
				counts.fourteeners++;
			} else if (elev >= 13000) {
				counts.thirteeners++;
			}
		} catch (error) {
			console.warn(`Error parsing elevation for ${m.Peak}:`, error);
		}
	});

	return {
		total: uniquePeaks.size,
		thirteeners: counts.thirteeners,
		fourteeners: counts.fourteeners
	};
}


// ============================================================================
// Concert Processor
// ============================================================================

/**
 * Count artists and venues from concert data
 * @param {Array|null} data - Concert data
 * @returns {Object} Maps of artist and venue counts
 */
export function countArtistsAndVenues(data) {
	const artistCounts = new Map();
	const venueCounts = new Map();

	if (!Array.isArray(data)) {
		console.warn('Concert data is not an array');
		return { artists: artistCounts, venues: venueCounts }; // ✅ Safe default
	}

	data.forEach(concert => {
		try {
			const { Headliner, Support, Venue } = concert;

			if (!Headliner || !Venue) {
				console.warn('Concert missing required fields:', concert);
				return;
			}

			const allArtists = [Headliner, ...(Support ? Support.split(',') : [])];

			allArtists
				.map(artist => artist.trim())
				.filter(artist => artist && !CONFIG.concertArtistExclusions.has(artist.toLowerCase()))
				.forEach(artist => {
					artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
				});

			venueCounts.set(Venue, (venueCounts.get(Venue) || 0) + 1);
		} catch (error) {
			console.warn('Error processing concert:', concert, error);
		}
	});

	return { artists: artistCounts, venues: venueCounts };
}

/**
 * Format top items as DOM elements (safe from XSS)
 * @param {Map} countMap - Map of items to counts
 * @param {string} limitKey - Limit key from STATS_LIMITS
 * @returns {DocumentFragment} Fragment containing formatted items
 */
export function formatTopItems(countMap, limitKey) {
	const fragment = document.createDocumentFragment();

	if (!(countMap instanceof Map) || countMap.size === 0) {
		console.warn('Invalid or empty countMap provided to formatTopItems');
		return fragment; // ✅ Return empty fragment
	}

	try {
		const limit = STATS_LIMITS[limitKey] || 5;

		const sortedEntries = Array.from(countMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit);

		sortedEntries.forEach(([name, count], index) => {
			// Create wrapper span
			const wrapper = document.createElement('span');
			wrapper.className = 'nowrap';

			// Find venue configuration if it exists
			const venueConfig = CONFIG.venuesToHighlight?.find(
				v => v.name.toLowerCase() === name.toLowerCase()
			);

			// Create name element
			const nameSpan = document.createElement('span');
			if (venueConfig) {
				nameSpan.className = venueConfig.className;
			}
			nameSpan.textContent = name; // Safe - no HTML parsing

			// Create count element
			const countSmall = document.createElement('small');
			countSmall.textContent = `x${count}`;

			// Assemble elements
			wrapper.appendChild(nameSpan);
			wrapper.appendChild(document.createTextNode(' '));
			wrapper.appendChild(countSmall);

			// Add separator if not last item
			if (index < sortedEntries.length - 1) {
				wrapper.appendChild(document.createTextNode(', '));
				
				// Add word break opportunity
				const wbr = document.createElement('wbr');
				wrapper.appendChild(wbr);
			}

			fragment.appendChild(wrapper);
		});

		return fragment;
	} catch (error) {
		console.error('Error formatting top items:', error);
		return fragment; // ✅ Return empty fragment
	}
}