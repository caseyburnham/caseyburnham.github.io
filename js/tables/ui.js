// js/ui.js
import { CONFIG } from './config.js';

export const ui = {
	// Generic helper to update an element's content
	updateElement(selector, content, isHTML = false) {
		const element = document.querySelector(selector);
		if (!element) return;
		element[isHTML ? 'innerHTML' : 'textContent'] = content;
	},

	// Generic helper to render a table
	renderTable(selector, data, rowGenerator) {
		const tableBody = document.querySelector(selector);
		if (!tableBody || !data || !data.length) return;
		const rows = data.map(rowGenerator);
		tableBody.replaceChildren(...rows);
	},

	// Productions
	renderProductions(data) {
		const tableBody = document.querySelector(CONFIG.selectors.productionsTable);
		const template = document.getElementById('production-row-template');

		if (!tableBody || !template || !data) return;

		const rows = data.map(entry => {
			const rowClone = template.content.cloneNode(true);
			rowClone.querySelector('.prod-production').textContent = entry.Production;
			rowClone.querySelector('.prod-company').textContent = entry.Company;
			rowClone.querySelector('.prod-a1').textContent = entry.A1;
			rowClone.querySelector('.prod-sd').textContent = entry.SD;
			rowClone.querySelector('.prod-ad').textContent = entry.AD;
			rowClone.querySelector('.prod-lz').textContent = entry.LZ;
			rowClone.querySelector('.prod-notes').textContent = entry.Notes || '';
			return rowClone;
		});

		tableBody.replaceChildren(...rows);
	},

	// Concerts  
	renderConcerts(data) {
		this.updateElement(CONFIG.selectors.concertCount, data.length);

		const tableBody = document.querySelector(CONFIG.selectors.concertsTable);
		const template = document.getElementById('concert-row-template');

		if (!tableBody || !template || !data) return;
		const rows = data.map(concert => {
			const rowClone = template.content.cloneNode(true);
			const artistCell = rowClone.querySelector('.concert-artist');
			artistCell.innerHTML = `${concert.Headliner}${concert.Support ? `<br><small>${concert.Support}</small>` : ''}`;

			rowClone.querySelector('.concert-venue').textContent = concert.Venue;

			const yearCell = rowClone.querySelector('.concert-year');
			if (concert.Year) {
				yearCell.innerHTML = `<time datetime="${concert.Year}">${concert.Year}</time>`;
			}

			rowClone.querySelector('.concert-emoji').textContent = concert['😃'] || '';

			return rowClone;
		});

		tableBody.replaceChildren(...rows);

		this.updateConcertStats(data);
	},

	updateConcertStats(data) {
		const { artists, venues } = this.countArtistsAndVenues(data);
		const getTopItems = (countMap, limit) => Array.from(countMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([name, count]) => `<span class="nowrap">${name} <small>x${count}</small></span>`)
			.join(', <wbr>');

		this.updateElement(CONFIG.selectors.topArtists, getTopItems(artists, 8), true);
		this.updateElement(CONFIG.selectors.topVenues, getTopItems(venues, 8), true);
	},

	countArtistsAndVenues(data) {
		const artistCounts = new Map();
		const venueCounts = new Map();

		data.forEach(({ Headliner, Support, Venue }) => {
			const allArtists = [Headliner, ...(Support ? Support.split(',') : [])];
			allArtists
				.map(artist => artist.trim())
				.filter(artist => artist && !CONFIG.concertArtistExclusions.has(artist.toLowerCase()))
				.forEach(artist => artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1));

			venueCounts.set(Venue, (venueCounts.get(Venue) || 0) + 1);
		});

		return { artists: artistCounts, venues: venueCounts };
	},

	highlightVenues() {
		const venueMap = new Map(CONFIG.venuesToHighlight.map(v => [v.name.toLowerCase(), v.className]));
		const venueNames = CONFIG.venuesToHighlight.map(v => v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		const regex = new RegExp(`\\b(${venueNames.join('|')})\\b`, 'gi');

		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
			acceptNode: node => (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') ?
				NodeFilter.FILTER_ACCEPT :
				NodeFilter.FILTER_REJECT
		});

		// Collect nodes first to avoid modifying the list while iterating
		const textNodes = [];
		while (walker.nextNode()) textNodes.push(walker.currentNode);

		textNodes.forEach(node => {
			if (!regex.test(node.nodeValue)) return;

			const wrapper = document.createDocumentFragment();
			const parts = node.nodeValue.split(regex);

			parts.forEach((part, index) => {
				// Matched venue names will be at odd indices
				if (index % 2 === 1) {
					const span = document.createElement('span');
					span.className = venueMap.get(part.toLowerCase());
					span.textContent = part;
					wrapper.appendChild(span);
				} else if (part) {
					wrapper.appendChild(document.createTextNode(part));
				}
			});
			node.replaceWith(wrapper);
		});
	},

	// Mountains	
	renderMountains(data, exifData) {
		const processed = data
			.map(mountain => this.processMountain(mountain, exifData))
			.sort((a, b) => b.displayDate.localeCompare(a.displayDate));

		const tableBody = document.querySelector(CONFIG.selectors.mountainsTable);
		if (!tableBody) return;

		const allRows = this.generateMountainRowsWithSummaries(processed);
		tableBody.replaceChildren(...allRows);
		this.updateMountainStats(data);
	},

	processMountain(mountain, exifData) {
		let displayDate = mountain.Date;
		const normalizedPath = mountain.Image ? mountain.Image.replace(/^\/images\//, '') : '';
		const exifEntry = exifData[normalizedPath];

		if (exifEntry?.date) {
			const { year, month, day } = exifEntry.date;
			displayDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		}

		return { ...mountain, displayDate, year: displayDate ? displayDate.substring(0, 4) : 'N/A' };
	},
	
	generateMountainRowsWithSummaries(processedMountains) {
		const allRows = [];
		const template = document.getElementById('mountain-row-template');
		let currentYear = null;
		let yearPeakCount = 0;
	
		const createSummaryRow = (year, count) => {
			const row = document.createElement('tr');
			row.className = 'year-summary-row';
			row.innerHTML = `<td colspan="6"><strong>${count}</strong> ${count === 1 ? 'bag' : 'bags'} in ${year}</td>`;
			return row;
		};
	
		processedMountains.forEach((mountain, index) => {
			if (currentYear && mountain.year !== currentYear) {
				allRows.push(createSummaryRow(currentYear, yearPeakCount));
				yearPeakCount = 0;
			}
			currentYear = mountain.year;
			yearPeakCount++;
	
			const rowClone = template.content.cloneNode(true);
	
			const peakCell = rowClone.querySelector('.mtn-peak');
			peakCell.innerHTML = `${mountain.Peak}${mountain.Count > 1 ? ` <small>x${mountain.Count}</small>` : ''}`;
	
			const elevationCell = rowClone.querySelector('.mtn-elevation');
			if (mountain.Elevation) {
				// 1. Define the elevation range (can be hardcoded or from a simpler config)
				const minElevation = 13000;
				const maxElevation = 14440;
				
				// 2. Parse elevation string to a number
				const numericElevation = parseInt(mountain.Elevation.replace(/,/g, ''), 10);
				
				// 3. Calculate the elevation's percentage in the range
				const fraction = Math.max(0, Math.min(1, (numericElevation - minElevation) / (maxElevation - minElevation)));
				const percent = fraction * 100;
				
				// 4. Create the span and set the CSS custom property '--elevation-percent'
				const span = document.createElement('span');
				span.className = 'elevation';
				span.textContent = mountain.Elevation;
				span.style.setProperty('--elevation-percent', `${percent.toFixed(2)}%`);
				
				// 5. Add the new span to the cell
				elevationCell.innerHTML = ''; // Clear previous content
				elevationCell.appendChild(span);
			}
			
			const rankCell = rowClone.querySelector('.mtn-rank');
			if (mountain.ranked) {
				rankCell.innerHTML = `<span class="ranked">&#10004;</span>`;
			}
			else {
				rankCell.innerHTML = `<span class="unranked">-</span>`;
			}
	
			const dateCell = rowClone.querySelector('.mtn-date');
			if (mountain.displayDate) {
				dateCell.innerHTML = `<time datetime="${mountain.displayDate}">${mountain.displayDate.substring(5)}</time>`;
			}
	
			const imageCell = rowClone.querySelector('.mtn-image');
			if (mountain.Image) {
				imageCell.innerHTML = `<button class="camera-link" data-title="${mountain.Peak}" data-image="${mountain.Image}"></button>`;
			}
	
			rowClone.querySelector('.mtn-range').textContent = mountain.Range;
	
			allRows.push(rowClone);
	
			if (index === processedMountains.length - 1) {
				allRows.push(createSummaryRow(currentYear, yearPeakCount));
			}
		});
		return allRows;
	},
	
	updateMountainStats(mountains) {
		const uniquePeaks = new Set();
		const counts = mountains.reduce((acc, m) => {
			// If we've already counted this peak, skip it
			if (uniquePeaks.has(m.Peak)) {
				return acc;
			}
	
			// Otherwise, add it to our set of unique peaks and count it
			uniquePeaks.add(m.Peak);
	
			const elev = parseInt(m.Elevation.replace(/,/g, ''), 10);
			if (elev >= 14000) {
				acc.fourteeners++;
			} else if (elev >= 13000) {
				acc.thirteeners++;
			}
			return acc;
		}, { thirteeners: 0, fourteeners: 0 });
	
		// Update total count based on the number of unique peaks
		this.updateElement(CONFIG.selectors.totalMountains, uniquePeaks.size);
		this.updateElement(CONFIG.selectors.thirteeners, counts.thirteeners);
		this.updateElement(CONFIG.selectors.fourteeners, counts.fourteeners);
	
		this.updateProgressBar('thirteeners', counts.thirteeners);
		this.updateProgressBar('fourteeners', counts.fourteeners);
	},

	updateProgressBar(peakType, current) {
		document.querySelectorAll(`${CONFIG.selectors.peakProgress}[data-peak-type="${peakType}"]`).forEach(prog => {
			const total = parseInt(prog.dataset.total, 10) || 1;
			prog.value = Math.min(current, prog.max);
			const percent = Math.min((current / total) * 100, 100);
			prog.style.setProperty('--progress', `${percent}%`);
		});
	}
};