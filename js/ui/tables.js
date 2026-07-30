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
	{ name: 'Gothic Theater', className: 'venue--gothic' },
	{ name: 'Golden Triangle', className: 'venue--golden-tri' }
];

const ARTIST_EXCLUSIONS = new Set(['et al.', 'decadence', '(DJ Set)']);

const ELEVATION = { MIN: 13000, MAX: 14440 };

const RANGES_ORDERED = [
	'Front', 'Tenmile', 'Mosquito', 'Gore', 'Elks',
	'Sawatch', 'Sangre de Cristo', 'San Juan'
];

// ============================================================================
// Data Loading & Processing
// ============================================================================

function validateTemplates() {
	const required = [
		'production-row-template',
		'mountain-row-template',
		'summary-row-template',
		'concert-row-template',
		'table-tally-template'
	];
	
	const missing = required.filter(id => !document.getElementById(id));
	
	if (missing.length > 0) {
		throw new Error(`Missing required templates: ${missing.join(', ')}`);
	}
}

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

function renderRangeSummary(mountains) {
	const cell = document.querySelector('#range-summary-row td');
	const template = document.getElementById('table-tally-template');
	if (!cell || !template) return;

	const seenPeaks = new Set();
	const rangeCounts = new Map(RANGES_ORDERED.map(r => [r, 0]));

	mountains.forEach(m => {
		if (!m?.Peak || !m?.Range || seenPeaks.has(m.Peak)) return;
		seenPeaks.add(m.Peak);
		if (rangeCounts.has(m.Range)) {
			rangeCounts.set(m.Range, rangeCounts.get(m.Range) + 1);
		}
	});

	const sorted = Array.from(rangeCounts.entries())
		.sort((a, b) => b[1] - a[1]);

	cell.replaceChildren(createTallyList(sorted, template, {
		itemClass: ([, count]) => count === 0 ? 'range-tally--zero' : ''
	}));
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
		
		//SD
		row.querySelector('.prod-sd').textContent = prod.SD || '';
		
		//AD
		row.querySelector('.prod-ad').textContent = prod.AD || '';
		
		//LZ
		row.querySelector('.prod-lz').textContent = prod.LZ || '';
		
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
			// Set rowspan on the first row's date cell
			const firstDateCell = sameDayGroup[0].querySelector('.mtn-date');
			if (firstDateCell) {
				firstDateCell.rowSpan = sameDayGroup.length;
			}
			
			// Remove date cells from subsequent rows
			for (let i = 1; i < sameDayGroup.length; i++) {
				const dateCell = sameDayGroup[i].querySelector('.mtn-date');
				if (dateCell) {
					dateCell.remove();
				}
			}
			
			// Add sequence classes for styling
			sameDayGroup[0].classList.add('sequence-first');
			sameDayGroup[sameDayGroup.length - 1].classList.add('sequence-last');
			sameDayGroup.forEach(row => row.classList.add('sequence-group'));
			styleSequenceGroup(sameDayGroup);
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
	renderRangeSummary(mountains);
}

function createMountainRow(mountain, template) {
	const row = template.content.cloneNode(true);
	const tr = row.querySelector('tr');

	// Peak name
	tr.querySelector('.mtn-peak').textContent = mountain.Peak || '';

	// Elevation with gradient
	const elevationData = tr.querySelector('.mtn-elevation-data');
	if (mountain.Elevation) {
		const numElev = parseInt(mountain.Elevation.replace(/,/g, ''), 10);
		if (!isNaN(numElev) && elevationData) {
			const fraction = Math.max(0, Math.min(1, (numElev - ELEVATION.MIN) / (ELEVATION.MAX - ELEVATION.MIN)));
			const percent = fraction * 100;

			elevationData.textContent = mountain.Elevation;
			elevationData.value = numElev;
			elevationData.style.setProperty('--elevation-percent', `${percent.toFixed(2)}%`);
			elevationData.style.setProperty('--elevation-fraction', fraction.toFixed(3));
		} else {
			elevationData.textContent = mountain.Elevation;
		}
	} else {
		elevationData?.remove();
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
		prog.title = `${current}/${total} ${peakType}`; 
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
	const template = document.getElementById('table-tally-template');
	if (!element || !template || !countMap.size) return;

	const sorted = Array.from(countMap.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit);

	element.replaceChildren(createTallyList(sorted, template, {
		itemClass: ([name]) => {
			const venue = VENUES_TO_HIGHLIGHT.find(v => v.name.toLowerCase() === name.toLowerCase());
			return venue?.className || '';
		}
	}));
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

function createTallyList(entries, template, { itemClass = () => '' } = {}) {
	const fragment = document.createDocumentFragment();

	entries.forEach((entry, index) => {
		const [name, count] = entry;
		const tally = template.content.cloneNode(true);
		const nameElement = tally.querySelector('.table-tally-name');
		const className = itemClass(entry);

		nameElement.textContent = name;
		tally.querySelector('.table-tally-count').textContent = count;
		if (className) nameElement.classList.add(className);

		if (index === entries.length - 1) {
			tally.querySelector('.table-tally-separator')?.remove();
			tally.querySelector('.table-tally-break')?.remove();
		}

		fragment.appendChild(tally);
	});

	return fragment;
}

function styleSequenceGroup(rows) {
	const finalIndex = rows.length - 1;

	rows.forEach((row, index) => {
		const heading = row.querySelector('th');
		if (!heading) return;

		const position = index / finalIndex;
		const lightness = (position * 0.25).toFixed(3);
		const alpha = (0.05 + position * 0.15).toFixed(3);

		heading.style.backgroundColor =
			`oklch(from var(--color-accent-0) calc(l + ${lightness}) c h / ${alpha})`;
	});
}

// ============================================================================
// Initialization
// ============================================================================

export async function initTables() {
	validateTemplates();

	const { exifData, productions, mountains, concerts } = await loadAllData();

	if (productions) renderProductions(productions);
	if (concerts) renderConcerts(concerts);
	if (mountains) {
		const processed = processMountains(mountains, exifData);
		renderMountains(processed);
	}
}
