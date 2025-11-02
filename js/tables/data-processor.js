import { CONFIG } from './config.js';
import { formatExifDate, normalizeImagePath } from '../shared-utils.js';
import dataCache from '../shared-data.js';

const STATS_LIMITS = {
	TOP_ARTISTS: 7,
	TOP_VENUES: 8
};

export const dataService = {
	async fetchData(url) {
		try {
			return await dataCache.fetch(url);
		} catch (error) {
			console.error(`Error fetching ${url}:`, error);
			return null;
		}
	},

	async getAllData() {
		const [exifData, productions, mountains, concerts] = await Promise.all([
			this.fetchData(CONFIG.urls.exif),
			this.fetchData(CONFIG.urls.productions),
			this.fetchData(CONFIG.urls.mountains),
			this.fetchData(CONFIG.urls.concerts)
		]);

		return {
			productions,
			mountains,
			concerts,
			exifData: exifData || {}
		};
	}
};

// ============================================================================
// Productions Processor
// ============================================================================

export function processProductionsData(data) {
	return data || [];
}

// ============================================================================
// Mountain Processor
// ============================================================================

function processMountain(mountain, exifDataset) {
	let displayDate = mountain.Date;

	if (mountain.Image) {
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

export function processMountainsData(data, exifData) {
	const processed = (data || [])
		.map(mountain => processMountain(mountain, exifData))
		.sort((a, b) => b.displayDate.localeCompare(a.displayDate));

	return processed;
}

export function calculateMountainStats(mountains) {
	const uniquePeaks = new Set();
	const counts = { thirteeners: 0, fourteeners: 0 };

	(mountains || [])
	.forEach(m => {
		if (uniquePeaks.has(m.Peak)) return;

		uniquePeaks.add(m.Peak);
		const elev = parseInt(m.Elevation.replace(/,/g, ''), 10);

		if (elev >= 14000) {
			counts.fourteeners++;
		} else if (elev >= 13000) {
			counts.thirteeners++;
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

export function countArtistsAndVenues(data) {
	const artistCounts = new Map();
	const venueCounts = new Map();

	(data || [])
	.forEach(({ Headliner, Support, Venue }) => {
		const allArtists = [Headliner, ...(Support ? Support.split(',') : [])];

		allArtists
			.map(artist => artist.trim())
			.filter(artist => artist && !CONFIG.concertArtistExclusions.has(artist.toLowerCase()))
			.forEach(artist => {
				artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
			});

		venueCounts.set(Venue, (venueCounts.get(Venue) || 0) + 1);
	});

	return { artists: artistCounts, venues: venueCounts };
}

export function formatTopItemsHTML(countMap, limitKey) {
	const limit = STATS_LIMITS[limitKey] || 5;

	return Array.from(countMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([name, count]) => {
			const venueConfig = CONFIG.venuesToHighlight?.find(
				v => v.name.toLowerCase() === name.toLowerCase()
			);

			const displayName = venueConfig ?
				`<span class="${venueConfig.className}">${name}</span>` :
				name;

			return `<span class="nowrap">${displayName} <small>x${count}</small></span>`;
		})
		.join(', <wbr>');
}