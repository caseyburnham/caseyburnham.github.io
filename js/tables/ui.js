import { CONFIG } from './config.js';
import {
	calculateMountainStats,
	countArtistsAndVenues,
	formatTopItems
} from './data-processor.js';

// Constants
const ELEVATION = {
	MIN: 13000,
	MAX: 14440
};

const CSS_CLASSES = {
	SEQUENCE_FIRST: 'sequence-first',
	SEQUENCE_LAST: 'sequence-last',
	SEQUENCE_GROUP: 'sequence-group'
};

export const ui = {
	/**
	 * Update element content safely
	 * @param {string} selector - CSS selector
	 * @param {string|Node|DocumentFragment} content - Content to set
	 */
	updateElement(selector, content) {
		const element = document.querySelector(selector);
		if (!element) {
			console.warn(`Element not found: ${selector}`);
			return;
		}
		
		try {
			// If content is a DocumentFragment or Node, append it
			if (content instanceof DocumentFragment || content instanceof Node) {
				element.textContent = ''; // Clear first
				element.appendChild(content);
			} else {
				// Otherwise treat as text content
				element.textContent = content;
			}
		} catch (error) {
			console.error(`Error updating element ${selector}:`, error);
		}
	},

	// ========================================================================
	// Productions
	// ========================================================================

	/**
	 * Render productions table
	 * @param {Array} data - Productions data
	 */
	renderProductions(data) {
		if (!Array.isArray(data) || data.length === 0) {
			console.warn('No productions data to render');
			return;
		}

		const tableBody = document.querySelector(CONFIG.selectors.productionsTable);
		const template = document.getElementById('production-row-template');

		if (!tableBody) {
			console.error('Productions table body not found');
			return;
		}

		if (!template) {
			console.error('Production row template not found');
			return;
		}

		try {
			const fragment = document.createDocumentFragment();
			data.forEach(entry => {
				const row = this.createProductionRow(entry, template);
				if (row) {
					fragment.appendChild(row);
				}
			});

			tableBody.replaceChildren(fragment);
		} catch (error) {
			console.error('Error rendering productions:', error);
		}
	},

	/**
	 * Create production table row
	 * @param {Object} entry - Production data
	 * @param {HTMLTemplateElement} template - Row template
	 * @returns {DocumentFragment|null} Row fragment or null on error
	 */
	createProductionRow(entry, template) {
		try {
			const row = template.content.cloneNode(true);

			row.querySelector('.prod-production').textContent = entry.Production || '';
			row.querySelector('.prod-company').textContent = entry.Company || '';
			
			const a1El = row.querySelector('.prod-a1');
			a1El.textContent = entry.A1 || '';
			a1El.classList.add('prod-role');
			
			const sdEl = row.querySelector('.prod-sd');
			sdEl.textContent = entry.SD || '';
			sdEl.classList.add('prod-role');
			
			const adEl = row.querySelector('.prod-ad');
			adEl.textContent = entry.AD || '';
			adEl.classList.add('prod-role');
			
			const lzEl = row.querySelector('.prod-lz');
			lzEl.textContent = entry.LZ || '';
			lzEl.classList.add('prod-role');
			
			row.querySelector('.prod-notes').textContent = entry.Notes || '';

			return row;
		} catch (error) {
			console.error('Error creating production row:', entry, error);
			return null;
		}
	},

	// ========================================================================
	// Mountains
	// ========================================================================

	/**
	 * Render mountains table
	 * @param {Array} processedMountains - Processed mountain data
	 */
	renderMountains(processedMountains) {
		if (!Array.isArray(processedMountains) || processedMountains.length === 0) {
			console.warn('No mountains data to render');
			return;
		}

		const tableBody = document.querySelector(CONFIG.selectors.mountainsTable);

		if (!tableBody) {
			console.error('Mountains table body not found');
			return;
		}

		try {
			const allRows = this.generateMountainRowsWithSummaries(processedMountains);
			const fragment = document.createDocumentFragment();
			allRows.forEach(row => {
				if (row) fragment.appendChild(row);
			});

			tableBody.replaceChildren(fragment);

			const stats = calculateMountainStats(processedMountains);
			this.updateMountainStats(stats);
		} catch (error) {
			console.error('Error rendering mountains:', error);
		}
	},

	/**
	 * Generate mountain rows with summary rows
	 * @param {Array} processedMountains - Processed mountain data
	 * @returns {Array} Array of table rows
	 */
	generateMountainRowsWithSummaries(processedMountains) {
		const allRows = [];
		const template = document.getElementById('mountain-row-template');

		if (!template) {
			console.error('Mountain row template not found');
			return allRows;
		}

		let currentYear = null;
		let yearPeakCount = 0;
		let currentDate = null;
		let sameDayGroup = [];

		const finalizeSameDayGroup = () => {
			if (sameDayGroup.length > 1) {
				sameDayGroup[0].classList.add(CSS_CLASSES.SEQUENCE_FIRST);
				sameDayGroup[sameDayGroup.length - 1].classList.add(CSS_CLASSES.SEQUENCE_LAST);
				sameDayGroup.forEach(row => row.classList.add(CSS_CLASSES.SEQUENCE_GROUP));
			}
			sameDayGroup = [];
		};

		processedMountains.forEach((mountain, index) => {
			try {
				if (currentYear && mountain.year !== currentYear) {
					finalizeSameDayGroup();
					currentDate = null;
					const summaryRow = this.createSummaryRow(currentYear, yearPeakCount);
					if (summaryRow) allRows.push(summaryRow);
					yearPeakCount = 0;
				}

				currentYear = mountain.year;
				yearPeakCount++;

				if (mountain.displayDate !== currentDate) {
					finalizeSameDayGroup();
					currentDate = mountain.displayDate;
				}

				const tr = this.createMountainRow(mountain, template);
				if (tr) {
					sameDayGroup.push(tr);
					allRows.push(tr);
				}

				if (index === processedMountains.length - 1) {
					finalizeSameDayGroup();
					const summaryRow = this.createSummaryRow(currentYear, yearPeakCount);
					if (summaryRow) allRows.push(summaryRow);
				}
			} catch (error) {
				console.error('Error processing mountain:', mountain, error);
			}
		});

		return allRows;
	},

	/**
	 * Create summary row
	 * @param {string} year - Year
	 * @param {number} count - Count
	 * @returns {HTMLElement|null} Summary row or null
	 */
	createSummaryRow(year, count) {
		const template = document.getElementById('summary-row-template');
		if (!template) {
			console.error('Summary row template not found');
			return null;
		}

		try {
			const row = template.content.cloneNode(true);
			row.querySelector('.summary-count').textContent = count;
			row.querySelector('.summary-label').textContent = count === 1 ? 'bag' : 'bags';
			row.querySelector('.summary-year').textContent = year;

			return row.querySelector('tr');
		} catch (error) {
			console.error('Error creating summary row:', error);
			return null;
		}
	},

	/**
	 * Create mountain table row
	 * @param {Object} mountain - Mountain data
	 * @param {HTMLTemplateElement} template - Row template
	 * @returns {HTMLElement|null} Table row or null
	 */
	createMountainRow(mountain, template) {
		try {
			const rowClone = template.content.cloneNode(true);
			const tr = rowClone.querySelector('tr');

			// Peak name
			tr.querySelector('.mtn-peak').textContent = mountain.Peak || '';

			// Elevation with gradient
			this.populateElevationCell(tr, mountain.Elevation);

			// Rank
			this.populateRankCell(tr, mountain.ranked);

			// Date
			this.populateDateCell(tr, mountain.displayDate);

			// Image
			this.populateImageCell(tr, mountain.Peak, mountain.Image);

			// Range
			tr.querySelector('.mtn-range').textContent = mountain.Range || '';

			return tr;
		} catch (error) {
			console.error('Error creating mountain row:', mountain, error);
			return null;
		}
	},

	populateElevationCell(tr, elevation) {
		const elevationCell = tr.querySelector('.mtn-elevation');
		if (!elevation || !elevationCell) return;

		try {
			const numericElevation = parseInt(elevation.replace(/,/g, ''), 10);
			
			if (isNaN(numericElevation)) {
				elevationCell.textContent = elevation;
				return;
			}

			const fraction = Math.max(0, Math.min(1,
				(numericElevation - ELEVATION.MIN) / (ELEVATION.MAX - ELEVATION.MIN)
			));
			const percent = fraction * 100;

			const data = document.createElement('data');
			data.textContent = elevation;
			data.value = numericElevation;
			data.style.setProperty('--elevation-percent', `${percent.toFixed(2)}%`);
			data.style.setProperty('--elevation-fraction', fraction.toFixed(3));

			elevationCell.appendChild(data);
		} catch (error) {
			console.error('Error populating elevation cell:', error);
			elevationCell.textContent = elevation;
		}
	},

	populateRankCell(tr, isRanked) {
		try {
			const rankCell = tr.querySelector('.mtn-rank');
			if (!rankCell) return;

			if (isRanked) {
				rankCell.querySelector('.unranked')?.remove();
			} else {
				rankCell.querySelector('.ranked')?.remove();
			}
		} catch (error) {
			console.error('Error populating rank cell:', error);
		}
	},

	populateDateCell(tr, displayDate) {
		try {
			const dateCell = tr.querySelector('.mtn-date');
			const timeEl = dateCell?.querySelector('time');

			if (displayDate && timeEl) {
				timeEl.dateTime = displayDate;
				timeEl.textContent = displayDate.substring(5);
			} else if (timeEl) {
				timeEl.remove();
			}
		} catch (error) {
			console.error('Error populating date cell:', error);
		}
	},

	populateImageCell(tr, peakName, imagePath) {
		try {
			const imageCell = tr.querySelector('.mtn-image');
			const buttonEl = imageCell?.querySelector('button');

			if (imagePath && buttonEl) {
				buttonEl.dataset.title = peakName;
				buttonEl.dataset.image = imagePath;
			} else if (buttonEl) {
				buttonEl.remove();
			}
		} catch (error) {
			console.error('Error populating image cell:', error);
		}
	},

	/**
	 * Update mountain statistics
	 * @param {Object} stats - Statistics object
	 */
	updateMountainStats(stats) {
		try {
			this.updateElement(CONFIG.selectors.totalMountains, stats.total);
			this.updateElement(CONFIG.selectors.thirteeners, stats.thirteeners);
			this.updateElement(CONFIG.selectors.fourteeners, stats.fourteeners);

			this.updateProgressBar('thirteeners', stats.thirteeners);
			this.updateProgressBar('fourteeners', stats.fourteeners);
		} catch (error) {
			console.error('Error updating mountain stats:', error);
		}
	},

	/**
	 * Update progress bar
	 * @param {string} peakType - Peak type (thirteeners or fourteeners)
	 * @param {number} current - Current count
	 */
	updateProgressBar(peakType, current) {
		try {
			const progressBars = document.querySelectorAll(
				`${CONFIG.selectors.peakProgress}[data-peak-type="${peakType}"]`
			);

			progressBars.forEach(prog => {
				const total = parseInt(prog.dataset.total, 10) || 1;
				prog.value = Math.min(current, prog.max);
				const percent = Math.min((current / total) * 100, 100);
				prog.style.setProperty('--progress', `${percent}%`);
			});
		} catch (error) {
			console.error('Error updating progress bar:', error);
		}
	},

	// ========================================================================
	// Concerts
	// ========================================================================

	/**
	 * Render concerts table
	 * @param {Array} data - Concert data
	 */
	renderConcerts(data) {
		if (!Array.isArray(data) || data.length === 0) {
			console.warn('No concert data to render');
			return;
		}

		try {
			this.updateElement(CONFIG.selectors.concertCount, data.length);

			const tableBody = document.querySelector(CONFIG.selectors.concertsTable);
			const template = document.getElementById('concert-row-template');

			if (!tableBody) {
				console.error('Concert table body not found');
				return;
			}

			if (!template) {
				console.error('Concert row template not found');
				return;
			}

			const fragment = this.createConcertRows(data, template);
			tableBody.replaceChildren(fragment);
			this.updateConcertStats(data);
		} catch (error) {
			console.error('Error rendering concerts:', error);
		}
	},

	/**
	 * Create concert rows
	 * @param {Array} concerts - Concert data
	 * @param {HTMLTemplateElement} template - Row template
	 * @returns {DocumentFragment} Fragment containing rows
	 */
	createConcertRows(concerts, template) {
		const fragment = document.createDocumentFragment();

		concerts.forEach(concert => {
			try {
				const row = this.createConcertRow(concert, template);
				if (row) {
					fragment.appendChild(row);
				}
			} catch (error) {
				console.error('Error creating concert row:', concert, error);
			}
		});

		return fragment;
	},

	/**
	 * Create concert table row
	 * @param {Object} concert - Concert data
	 * @param {HTMLTemplateElement} template - Row template
	 * @returns {DocumentFragment|null} Row fragment or null
	 */
	createConcertRow(concert, template) {
		try {
			const row = template.content.cloneNode(true);

			this.populateArtistCell(row, concert);
			row.querySelector('.concert-venue').textContent = concert.Venue || '';
			row.querySelector('.concert-emoji').textContent = concert['😃'] || '';
			this.populateYearCell(row, concert.Year);

			return row;
		} catch (error) {
			console.error('Error creating concert row:', error);
			return null;
		}
	},

	populateArtistCell(row, concert) {
		try {
			const artistCell = row.querySelector('.concert-artist');
			artistCell.querySelector('.artist-headliner').textContent = concert.Headliner || '';

			const supportGroup = artistCell.querySelector('.artist-support-group');
			if (concert.Support) {
				supportGroup.querySelector('.artist-support-name').textContent = concert.Support;
			} else {
				supportGroup.remove();
			}
		} catch (error) {
			console.error('Error populating artist cell:', error);
		}
	},

	populateYearCell(row, year) {
		try {
			const yearCell = row.querySelector('.concert-year');
			const timeEl = yearCell?.querySelector('time');

			if (year && timeEl) {
				timeEl.dateTime = year;
				timeEl.textContent = year;
			} else if (timeEl) {
				timeEl.remove();
			}
		} catch (error) {
			console.error('Error populating year cell:', error);
		}
	},

	/**
	 * Update concert statistics
	 * @param {Array} data - Concert data
	 */
	updateConcertStats(data) {
		try {
			const { artists, venues } = countArtistsAndVenues(data);

			// Update top artists
			const topArtistsElement = document.querySelector(CONFIG.selectors.topArtists);
			if (topArtistsElement) {
				topArtistsElement.textContent = ''; // Clear existing content
				const artistsFragment = formatTopItems(artists, 'TOP_ARTISTS');
				topArtistsElement.appendChild(artistsFragment);
			}

			// Update top venues
			const topVenuesElement = document.querySelector(CONFIG.selectors.topVenues);
			if (topVenuesElement) {
				topVenuesElement.textContent = ''; // Clear existing content
				const venuesFragment = formatTopItems(venues, 'TOP_VENUES');
				topVenuesElement.appendChild(venuesFragment);
			}
		} catch (error) {
			console.error('Error updating concert stats:', error);
		}
	},

	/**
	 * Highlight venue cells
	 */
	highlightVenues() {
		if (!CONFIG.venuesToHighlight?.length) return;

		try {
			const venueMap = new Map(
				CONFIG.venuesToHighlight.map(v => [v.name.toLowerCase(), v.className])
			);

			document.querySelectorAll('.concert-venue')
				.forEach(cell => {
					try {
						const venueName = cell.textContent.trim().toLowerCase();
						const className = venueMap.get(venueName);
						if (className) {
							cell.classList.add(className);
						}
					} catch (error) {
						console.warn('Error highlighting venue cell:', error);
					}
				});
		} catch (error) {
			console.error('Error highlighting venues:', error);
		}
	}
};