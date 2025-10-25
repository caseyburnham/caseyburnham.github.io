// js/ui.js
import { CONFIG } from './config.js';

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
	// Generic helper to update an element's content
	updateElement(selector, content, isHTML = false) {
		const element = document.querySelector(selector);
		if (!element) return;
		element[isHTML ? 'innerHTML' : 'textContent'] = content;
	},

	// Generic helper to render a table
	renderTable(selector, data, rowGenerator) {
		const tableBody = document.querySelector(selector);
		if (!tableBody || !data?.length) return;
		
		const fragment = document.createDocumentFragment();
		data.forEach(item => fragment.appendChild(rowGenerator(item)));
		tableBody.replaceChildren(fragment);
	},

	// Productions
	renderProductions(data) {
		if (!data?.length) return;

		const tableBody = document.querySelector(CONFIG.selectors.productionsTable);
		const template = document.getElementById('production-row-template');

		if (!tableBody || !template) {
			console.warn('Productions table or template not found');
			return;
		}

		const fragment = document.createDocumentFragment();
		data.forEach(entry => {
			const row = this.createProductionRow(entry, template);
			fragment.appendChild(row);
		});

		tableBody.replaceChildren(fragment);
	},

	createProductionRow(entry, template) {
		const row = template.content.cloneNode(true);
		
		row.querySelector('.prod-production').textContent = entry.Production;
		row.querySelector('.prod-company').textContent = entry.Company;
		row.querySelector('.prod-a1').textContent = entry.A1;
		row.querySelector('.prod-a1').classList.add('prod-role');
		row.querySelector('.prod-sd').textContent = entry.SD;
		row.querySelector('.prod-sd').classList.add('prod-role');
		row.querySelector('.prod-ad').textContent = entry.AD;
		row.querySelector('.prod-ad').classList.add('prod-role');
		row.querySelector('.prod-lz').textContent = entry.LZ;
		row.querySelector('.prod-lz').classList.add('prod-role');
		row.querySelector('.prod-notes').textContent = entry.Notes || '';
		
		return row;
	},
	
	// Mountains	
	renderMountains(data, exifData) {
		if (!data?.length) return;

		const processed = this.processMountainsData(data, exifData);
		const tableBody = document.querySelector(CONFIG.selectors.mountainsTable);
		
		if (!tableBody) {
			console.warn('Mountains table not found');
			return;
		}
	
		const allRows = this.generateMountainRowsWithSummaries(processed);
		const fragment = document.createDocumentFragment();
		allRows.forEach(row => fragment.appendChild(row));
		
		tableBody.replaceChildren(fragment);
		this.updateMountainStats(data);
	},

	processMountainsData(data, exifData) {
		return data
			.map(mountain => this.processMountain(mountain, exifData))
			.sort((a, b) => b.displayDate.localeCompare(a.displayDate));
	},
	
	processMountain(mountain, exifData) {
		let displayDate = mountain.Date;
		const normalizedPath = mountain.Image?.replace(/^\/images\//, '') || '';
		const exifEntry = exifData?.[normalizedPath];
	
		if (exifEntry?.date) {
			const { year, month, day } = exifEntry.date;
			displayDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		}
	
		return { 
			...mountain, 
			displayDate, 
			year: displayDate ? displayDate.substring(0, 4) : 'N/A' 
		};
	},
	
	generateMountainRowsWithSummaries(processedMountains) {
		const allRows = [];
		const template = document.getElementById('mountain-row-template');
		
		if (!template) {
			console.warn('Mountain row template not found');
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
			// Handle year summary rows
			if (currentYear && mountain.year !== currentYear) {
				finalizeSameDayGroup();
				currentDate = null;
				allRows.push(this.createSummaryRow(currentYear, yearPeakCount));
				yearPeakCount = 0;
			}
			
			currentYear = mountain.year;
			yearPeakCount++;
	
			// Check if this row has a different date than the previous
			if (mountain.displayDate !== currentDate) {
				finalizeSameDayGroup();
				currentDate = mountain.displayDate;
			}
	
			const tr = this.createMountainRow(mountain, template);
			sameDayGroup.push(tr);
			allRows.push(tr);
	
			// Handle last row
			if (index === processedMountains.length - 1) {
				finalizeSameDayGroup();
				allRows.push(this.createSummaryRow(currentYear, yearPeakCount));
			}
		});
		
		return allRows;
	},

	createSummaryRow(year, count) {
		const template = document.getElementById('summary-row-template');
		if (!template) return document.createElement('tr');

		const row = template.content.cloneNode(true);
		row.querySelector('.summary-count').textContent = count;
		row.querySelector('.summary-label').textContent = count === 1 ? 'bag' : 'bags';
		row.querySelector('.summary-year').textContent = year;
		
		return row.querySelector('tr');
	},

	createMountainRow(mountain, template) {
		const rowClone = template.content.cloneNode(true);
		const tr = rowClone.querySelector('tr');

		// Peak name
		tr.querySelector('.mtn-peak').textContent = mountain.Peak;

		// Elevation with gradient
		this.populateElevationCell(tr, mountain.Elevation);

		// Rank
		this.populateRankCell(tr, mountain.ranked);

		// Date
		this.populateDateCell(tr, mountain.displayDate);

		// Image
		this.populateImageCell(tr, mountain.Peak, mountain.Image);

		// Range
		tr.querySelector('.mtn-range').textContent = mountain.Range;

		return tr;
	},

	populateElevationCell(tr, elevation) {
		const elevationCell = tr.querySelector('.mtn-elevation');
		if (!elevation) return;

		const numericElevation = parseInt(elevation.replace(/,/g, ''), 10);
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
	},

	populateRankCell(tr, isRanked) {
		const rankCell = tr.querySelector('.mtn-rank');
		if (isRanked) {
			rankCell.querySelector('.unranked')?.remove();
		} else {
			rankCell.querySelector('.ranked')?.remove();
		}
	},

	populateDateCell(tr, displayDate) {
		const dateCell = tr.querySelector('.mtn-date');
		const timeEl = dateCell.querySelector('time');
		
		if (displayDate && timeEl) {
			timeEl.dateTime = displayDate;
			timeEl.textContent = displayDate.substring(5);
		} else if (timeEl) {
			timeEl.remove();
		}
	},

	populateImageCell(tr, peakName, imagePath) {
		const imageCell = tr.querySelector('.mtn-image');
		const buttonEl = imageCell.querySelector('button');
		
		if (imagePath && buttonEl) {
			buttonEl.dataset.title = peakName;
			buttonEl.dataset.image = imagePath;
		} else if (buttonEl) {
			buttonEl.remove();
		}
	},
	
	updateMountainStats(mountains) {
		const uniquePeaks = new Set();
		const counts = { thirteeners: 0, fourteeners: 0 };

		mountains.forEach(m => {
			// Skip if we've already counted this peak
			if (uniquePeaks.has(m.Peak)) return;

			uniquePeaks.add(m.Peak);
			const elev = parseInt(m.Elevation.replace(/,/g, ''), 10);
			
			if (elev >= 14000) {
				counts.fourteeners++;
			} else if (elev >= 13000) {
				counts.thirteeners++;
			}
		});
	
		// Update total count based on the number of unique peaks
		this.updateElement(CONFIG.selectors.totalMountains, uniquePeaks.size);
		this.updateElement(CONFIG.selectors.thirteeners, counts.thirteeners);
		this.updateElement(CONFIG.selectors.fourteeners, counts.fourteeners);
	
		this.updateProgressBar('thirteeners', counts.thirteeners);
		this.updateProgressBar('fourteeners', counts.fourteeners);
	},
	
	updateProgressBar(peakType, current) {
		const progressBars = document.querySelectorAll(
			`${CONFIG.selectors.peakProgress}[data-peak-type="${peakType}"]`
		);
		
		progressBars.forEach(prog => {
			const total = parseInt(prog.dataset.total, 10) || 1;
			prog.value = Math.min(current, prog.max);
			const percent = Math.min((current / total) * 100, 100);
			prog.style.setProperty('--progress', `${percent}%`);
		});
	},

	// Concerts  
	renderConcerts(data) {
		if (!data?.length) return;

		this.updateElement(CONFIG.selectors.concertCount, data.length);

		const tableBody = document.querySelector(CONFIG.selectors.concertsTable);
		const template = document.getElementById('concert-row-template');

		if (!tableBody || !template) {
			console.warn('Concert table or template not found');
			return;
		}
		
		const fragment = this.createConcertRows(data, template);
		tableBody.replaceChildren(fragment);
		this.updateConcertStats(data);
	},

	createConcertRows(concerts, template) {
		const fragment = document.createDocumentFragment();
		
		concerts.forEach(concert => {
			const row = this.createConcertRow(concert, template);
			fragment.appendChild(row);
		});
		
		return fragment;
	},

	createConcertRow(concert, template) {
		const row = template.content.cloneNode(true);
		
		this.populateArtistCell(row, concert);
		row.querySelector('.concert-venue').textContent = concert.Venue;
		row.querySelector('.concert-emoji').textContent = concert['😃'] || '';
		this.populateYearCell(row, concert.Year);
		
		return row;
	},

	populateArtistCell(row, concert) {
		const artistCell = row.querySelector('.concert-artist');
		artistCell.querySelector('.artist-headliner').textContent = concert.Headliner;
		
		const supportGroup = artistCell.querySelector('.artist-support-group');
		if (concert.Support) {
			supportGroup.querySelector('.artist-support-name').textContent = concert.Support;
		} else {
			supportGroup.remove();
		}
	},

	populateYearCell(row, year) {
		const yearCell = row.querySelector('.concert-year');
		const timeEl = yearCell.querySelector('time');
		
		if (year && timeEl) {
			timeEl.dateTime = year;
			timeEl.textContent = year;
		} else if (timeEl) {
			timeEl.remove();
		}
	},

	updateConcertStats(data) {
		const { artists, venues } = this.countArtistsAndVenues(data);
		
		this.updateElement(
			CONFIG.selectors.topArtists, 
			this.getTopItems(artists, 7), 
			true
		);
		
		this.updateElement(
			CONFIG.selectors.topVenues, 
			this.getTopItems(venues, 8), 
			true
		);
	},

	getTopItems(countMap, limit) {
		return Array.from(countMap.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([name, count]) => `<span class="nowrap">${name} <small>x${count}</small></span>`)
			.join(', <wbr>');
	},

	countArtistsAndVenues(data) {
		const artistCounts = new Map();
		const venueCounts = new Map();

		data.forEach(({ Headliner, Support, Venue }) => {
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
	},

	highlightVenues() {
	  const venueMap = new Map(CONFIG.venuesToHighlight.map(v => 
		[v.name.toLowerCase(), v.className]
	  ));
	  
	  // Only target venue cells
	  document.querySelectorAll('.concert-venue').forEach(cell => {
		const venueName = cell.textContent.trim().toLowerCase();
		const className = venueMap.get(venueName);
		if (className) {
		  cell.classList.add(className);
		}
	  });
	}
};