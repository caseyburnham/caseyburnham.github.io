/**
 * Tables - Productions, Mountains, and Concerts
 */
import dataCache from '../utils/shared-data.js';
import { formatExifDate, normalizeImagePath } from '../utils/exif-utils.js';

// Configuration
const VENUES_TO_HIGHLIGHT = [
	{ name: 'Red Rocks', className: 'venue--red-rocks' },
	{ name: 'Bluebird Theater', className: 'venue--bluebird' },
	{ name: 'Ogden Theater', className: 'venue--ogden' },
	{ name: 'Belly Up', className: 'venue--belly-up' },
	{ name: 'Summit Music Hall', className: 'venue--summit' },
	{ name: 'Fillmore Auditorium', className: 'venue--fillmore' },
	{ name: 'Ball Arena', className: 'venue--ball-arena' },
	{ name: 'Gothic Theater', className: 'venue--gothic' }
];

const ARTIST_EXCLUSIONS = new Set(['et al.', 'decadence']);

const ELEVATION = { MIN: 13000, MAX: 14440 };

// ============================================================================
// Data Loading & Processing
// ============================================================================

async function loadAllData() {
	const [exif, productions, mountains, concerts] = await Promise.allSettled([
		dataCache.fetch('/json/exif-data.json'),
		dataCache.fetch('/json/production-data.json'),
		dataCache.fetch('/json/mountain-data.json'),
		dataCache.fetch('/json/concert-data.json')
	]);

	return {
		exifData: exif.status === 'fulfilled' ? exif.value || {} : {},
		productions: productions.status === 'fulfilled' ? productions.value : null,
		mountains: mountains.status === 'fulfilled' ? mountains.value : null,
		concerts: concerts.status === 'fulfilled' ? concerts.value : null
	};
}

function processMountains(mountains, exifData) {
	if (!Array.isArray(mountains)) return [];

	return mountains
		.map(mountain => {
			let displayDate = mountain.Date;

			// Try to get date from EXIF if image exists
			if (mountain.Image && exifData) {
				const path = normalizeImagePath(mountain.Image);
				const exif = exifData[path];
				if (exif?.date) {
					const formatted = formatExifDate(exif.date);
					if (formatted) displayDate = formatted;
				}
			}

			return {
				...mountain,
				displayDate,
				year: displayDate ? displayDate.substring(0, 4) : 'N/A'
			};
		})
		.sort((a, b) => b.displayDate.localeCompare(a.displayDate));
}

function calculateMountainStats(mountains) {
	if (!Array.isArray(mountains)) return { total: 0, thirteeners: 0, fourteeners: 0 };

	const uniquePeaks = new Set();
	const counts = { thirteeners: 0, fourteeners: 0 };

	mountains.forEach(m => {
		if (!m?.Peak || !m?.Elevation || uniquePeaks.has(m.Peak)) return;

		uniquePeaks.add(m.Peak);
		const elev = parseInt(m.Elevation.replace(/,/g, ''), 10);

		if (isNaN(elev)) return;

		if (elev >= 14000) counts.fourteeners++;
		else if (elev >= 13000) counts.thirteeners++;
	});

	return {
		total: uniquePeaks.size,
		thirteeners: counts.thirteeners,
		fourteeners: counts.fourteeners
	};
}

function countArtistsAndVenues(concerts) {
	const artists = new Map();
	const venues = new Map();

	if (!Array.isArray(concerts)) return { artists, venues };

	concerts.forEach(concert => {
		const { Headliner, Support, Venue } = concert;
		if (!Headliner || !Venue) return;

		// Count artists
		const allArtists = [Headliner, ...(Support ? Support.split(',') : [])];
		allArtists
			.map(a => a.trim())
			.filter(a => a && !ARTIST_EXCLUSIONS.has(a.toLowerCase()))
			.forEach(artist => {
				artists.set(artist, (artists.get(artist) || 0) + 1);
			});

		// Count venues
		venues.set(Venue, (venues.get(Venue) || 0) + 1);
	});

	return { artists, venues };
}

// ============================================================================
// Rendering - Productions
// ============================================================================

function renderProductions(productions) {
	if (!Array.isArray(productions) || !productions.length) return;

	const tbody = document.querySelector('#productions tbody');
	const template = document.getElementById('production-row-template');
	if (!tbody || !template) return;

	const fragment = document.createDocumentFragment();

	productions.forEach(prod => {
		const row = template.content.cloneNode(true);
		
		//Production
		row.querySelector('.prod-production').textContent = prod.Production || '';
		
		//Company
		row.querySelector('.prod-company').textContent = prod.Company || '';
		
		//A1
		row.querySelector('.prod-a1').textContent = prod.A1 || '';
		row.querySelector('.prod-a1').classList.add('prod-role');
		
		//SD
		row.querySelector('.prod-sd').textContent = prod.SD || '';
		row.querySelector('.prod-sd').classList.add('prod-role');
		
		//AD
		row.querySelector('.prod-ad').textContent = prod.AD || '';
		row.querySelector('.prod-ad').classList.add('prod-role');
		
		//LZ
		row.querySelector('.prod-lz').textContent = prod.LZ || '';
		row.querySelector('.prod-lz').classList.add('prod-role');
		
		//Emoji
		row.querySelector('.prod-notes').textContent = prod.Notes || '';

		fragment.appendChild(row);
	});

	tbody.replaceChildren(fragment);
}

// ============================================================================
// Rendering - Mountains
// ============================================================================

function renderMountains(mountains) {
	if (!Array.isArray(mountains) || !mountains.length) return;

	const tbody = document.querySelector('#mountains tbody');
	const rowTemplate = document.getElementById('mountain-row-template');
	const summaryTemplate = document.getElementById('summary-row-template');
	if (!tbody || !rowTemplate || !summaryTemplate) return;

	const fragment = document.createDocumentFragment();
	let currentYear = null;
	let yearCount = 0;
	let currentDate = null;
	let sameDayGroup = [];

	const finalizeSameDayGroup = () => {
		if (sameDayGroup.length > 1) {
			sameDayGroup[0].classList.add('sequence-first');
			sameDayGroup[sameDayGroup.length - 1].classList.add('sequence-last');
			sameDayGroup.forEach(row => row.classList.add('sequence-group'));
		}
		sameDayGroup = [];
	};

	mountains.forEach((mountain, index) => {
		// Insert year summary when year changes
		if (currentYear && mountain.year !== currentYear) {
			finalizeSameDayGroup();
			currentDate = null;
			fragment.appendChild(createYearSummary(currentYear, yearCount, summaryTemplate));
			yearCount = 0;
		}

		currentYear = mountain.year;
		yearCount++;

		// Track same-day groups
		if (mountain.displayDate !== currentDate) {
			finalizeSameDayGroup();
			currentDate = mountain.displayDate;
		}

		const tr = createMountainRow(mountain, rowTemplate);
		sameDayGroup.push(tr);
		fragment.appendChild(tr);

		// Last mountain - add final summary
		if (index === mountains.length - 1) {
			finalizeSameDayGroup();
			fragment.appendChild(createYearSummary(currentYear, yearCount, summaryTemplate));
		}
	});

	tbody.replaceChildren(fragment);

	// Update stats
	const stats = calculateMountainStats(mountains);
	updateElement('#totalMountains', stats.total);
	updateElement('#thirteeners', stats.thirteeners);
	updateElement('#fourteeners', stats.fourteeners);
	updateProgressBar('thirteeners', stats.thirteeners);
	updateProgressBar('fourteeners', stats.fourteeners);
}

function createMountainRow(mountain, template) {
	const row = template.content.cloneNode(true);
	const tr = row.querySelector('tr');

	// Peak name
	tr.querySelector('.mtn-peak').textContent = mountain.Peak || '';

	// Elevation with gradient
	const elevCell = tr.querySelector('.mtn-elevation');
	if (mountain.Elevation) {
		const numElev = parseInt(mountain.Elevation.replace(/,/g, ''), 10);
		if (!isNaN(numElev)) {
			const fraction = Math.max(0, Math.min(1, (numElev - ELEVATION.MIN) / (ELEVATION.MAX - ELEVATION.MIN)));
			const percent = fraction * 100;

			const data = document.createElement('data');
			data.textContent = mountain.Elevation;
			data.value = numElev;
			data.style.setProperty('--elevation-percent', `${percent.toFixed(2)}%`);
			data.style.setProperty('--elevation-fraction', fraction.toFixed(3));
			elevCell.appendChild(data);
		} else {
			elevCell.textContent = mountain.Elevation;
		}
	}

	// Range
	tr.querySelector('.mtn-range').textContent = mountain.Range || '';

	// Date
	const timeEl = tr.querySelector('.mtn-date time');
	if (mountain.displayDate && timeEl) {
		timeEl.dateTime = mountain.displayDate;
		timeEl.textContent = mountain.displayDate.substring(5);
	} else {
		timeEl?.remove();
	}

	// Ranked
	const rankCell = tr.querySelector('.mtn-rank');
	if (mountain.ranked) {
		rankCell.querySelector('.unranked')?.remove();
	} else {
		rankCell.querySelector('.ranked')?.remove();
	}

	// Image button
	const imageButton = tr.querySelector('.mtn-image button');
	if (mountain.Image && imageButton) {
		imageButton.dataset.title = mountain.Peak;
		imageButton.dataset.image = mountain.Image;
	} else {
		imageButton?.remove();
	}

	return tr;
}

function createYearSummary(year, count, template) {
	const row = template.content.cloneNode(true);
	row.querySelector('.summary-count').textContent = count;
	row.querySelector('.summary-label').textContent = count === 1 ? 'bag' : 'bags';
	row.querySelector('.summary-year').textContent = year;
	return row.querySelector('tr');
}

function updateProgressBar(peakType, current) {
	const progressBars = document.querySelectorAll(`progress.peak-progress[data-peak-type="${peakType}"]`);
	progressBars.forEach(prog => {
		const total = parseInt(prog.dataset.total, 10) || 1;
		prog.value = Math.min(current, prog.max);
		const percent = Math.min((current / total) * 100, 100);
		prog.style.setProperty('--progress', `${percent}%`);
	});
}

// ============================================================================
// Rendering - Concerts
// ============================================================================

function renderConcerts(concerts) {
	if (!Array.isArray(concerts) || !concerts.length) return;

	const tbody = document.querySelector('#concerts tbody');
	const template = document.getElementById('concert-row-template');
	if (!tbody || !template) return;

	const fragment = document.createDocumentFragment();

	concerts.forEach(concert => {
		const row = template.content.cloneNode(true);

		// Artist
		row.querySelector('.artist-headliner').textContent = concert.Headliner || '';
		if (concert.Support) {
			row.querySelector('.artist-support-name').textContent = concert.Support;
		} else {
			row.querySelector('.artist-support-group')?.remove();
		}

		// Venue
		row.querySelector('.concert-venue').textContent = concert.Venue || '';

		// Emoji
		row.querySelector('.concert-emoji').textContent = concert['😃'] || '';

		// Year
		const timeEl = row.querySelector('.concert-year time');
		if (concert.Year && timeEl) {
			timeEl.dateTime = concert.Year;
			timeEl.textContent = concert.Year;
		} else {
			timeEl?.remove();
		}

		fragment.appendChild(row);
	});

	tbody.replaceChildren(fragment);

	// Update stats
	updateElement('#concert-count', concerts.length);

	const { artists, venues } = countArtistsAndVenues(concerts);
	updateTopList('#top-artists', artists, 7);
	updateTopList('#top-venues', venues, 8);

	highlightVenues();
}

function updateTopList(selector, countMap, limit) {
	const element = document.querySelector(selector);
	if (!element || !countMap.size) return;

	const sorted = Array.from(countMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit);

	const html = sorted.map(([name, count], index) => {
		// Check if venue should be highlighted
		const venue = VENUES_TO_HIGHLIGHT.find(v => v.name.toLowerCase() === name.toLowerCase());
		const className = venue ? venue.className : '';
		
		const span = `<span class="nowrap"><span class="${className}">${name}</span> <small>x${count}</small></span>`;
		return index < sorted.length - 1 ? span + ', <wbr>' : span;
	}).join('');

	element.innerHTML = html;
}

function highlightVenues() {
	const venueMap = new Map(VENUES_TO_HIGHLIGHT.map(v => [v.name.toLowerCase(), v.className]));

	document.querySelectorAll('.concert-venue').forEach(cell => {
		const venueName = cell.textContent.trim().toLowerCase();
		const className = venueMap.get(venueName);
		if (className) cell.classList.add(className);
	});
}

// ============================================================================
// Utilities
// ============================================================================

function updateElement(selector, content) {
	const element = document.querySelector(selector);
	if (element) element.textContent = content;
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
	const { exifData, productions, mountains, concerts } = await loadAllData();

	if (productions) renderProductions(productions);
	if (concerts) renderConcerts(concerts);
	if (mountains) {
		const processed = processMountains(mountains, exifData);
		renderMountains(processed);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}