// Table Data Manager
class TableManager {
  constructor() {
	this.data = {};
	this.exifData = {}; // To store exif-data.json
	this.init();
  }

  init() {
	if (document.readyState === 'loading') {
	  document.addEventListener('DOMContentLoaded', () => this.loadAllTables());
	} else {
	  this.loadAllTables();
	}
  }

  async loadAllTables() {
	// Load exif data first as it might be needed by other loaders
	await this.fetchExifData();

	const loaders = [
	  this.loadProductions(),
	  this.loadMountains(), // loadMountains now depends on exifData
	  this.loadConcerts()
	];

	await Promise.allSettled(loaders);
	this.highlightVenues(); // Apply highlighting after all tables are loaded
  }

  async fetchData(url, name) {
	try {
	  const response = await fetch(url);
	  if (!response.ok) throw new Error(`HTTP ${response.status}`);
	  const data = await response.json();
	  this.data[name] = data;
	  return data;
	} catch (error) {
	  console.error(`Error loading ${name}:`, error);
	  return [];
	}
  }

  /**
   * Fetches EXIF data from 'exif-data.json' and stores it.
   */
  async fetchExifData() {
	try {
	  // Assuming exif-data.json is in the same directory as the HTML or accessible via this path
	  const response = await fetch('json/exif-data.json');
	  if (!response.ok) throw new Error(`HTTP ${response.status}`);
	  this.exifData = await response.json();
	} catch (error) {
	  console.error('Error loading exif data:', error);
	  this.exifData = {}; // Ensure it's an empty object on failure
	}
  }

  // PRODUCTIONS TABLE (remains unchanged)
  async loadProductions() {
	const data = await this.fetchData('/json/productions.json', 'productions');
	const tableBody = document.querySelector('#productions tbody');
	if (!tableBody || !data.length) return;

	const rows = data.map(entry => this.createRow([
	  entry.Production,
	  entry.Company,
	  entry.A1,
	  //entry.A2,
	  entry.SD,
	  entry.AD,
	  entry.LZ,
	  entry.Notes || ''
	]));

	tableBody.innerHTML = '';
	tableBody.append(...rows);
  }

  // MOUNTAINS TABLE (modified to incorporate EXIF dates and yearly summaries)
  async loadMountains() {
	const data = await this.fetchData('json/mountains.json', 'mountains');
	const tbody = document.querySelector('#mountains tbody');
	if (!tbody || !data.length) return;

	const allTableRows = []; // To store all generated TR elements (mountains and summaries)

	// First, process each mountain to get its final display date and sort it
	const processedMountains = data.map(mountain => {
	  let displayDate = mountain.Date;
	  let dateTimeAttr = mountain.Date;

	  if (mountain.Image && this.exifData && typeof this.exifData === 'object') {
		const normalizedImagePath = mountain.Image.replace(/^\/images\//, '');
		const exifEntry = this.exifData[normalizedImagePath];

		if (exifEntry && exifEntry.date) {
		  const { year, month, day } = exifEntry.date;
		  // Format the date as YYYY-MM-DD, ensuring month and day are two digits
		  displayDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		  dateTimeAttr = displayDate;
		}
	  }
	  return { ...mountain, displayDate, dateTimeAttr, year: displayDate ? displayDate.substring(0, 4) : 'N/A' };
	});

	// Sort mountains by date in descending order (most recent first)
	processedMountains.sort((a, b) => {
	  if (a.displayDate < b.displayDate) return 1;
	  if (a.displayDate > b.displayDate) return -1;
	  return 0;
	});

	let currentYear = null;
	let peaksInCurrentYear = 0;

	// Iterate through sorted mountains to add year summary rows
	processedMountains.forEach((mountain, index) => {
	  const year = mountain.year;

	  if (currentYear === null) {
		// First mountain, initialize currentYear
		currentYear = year;
	  } else if (year !== currentYear) {
		// Year changed, add summary for the previous year
		allTableRows.push(this.createYearSummaryRow(currentYear, peaksInCurrentYear, 5)); // 5 is the total number of columns
		currentYear = year;
		peaksInCurrentYear = 0; // Reset count for the new year
	  }

	  // Add the mountain row
	  allTableRows.push(
		this.createRow([
		  `${mountain.Peak}${mountain.Count > 1 ? ` <small>x${mountain.Count}</small>` : ''}`,
		  mountain.Elevation,
		  mountain.Range,
		  mountain.displayDate ? `<time datetime="${mountain.dateTimeAttr}">${mountain.displayDate}</time>` : "",
		  mountain.Image ? `<button class="camera-link" data-title="${mountain.Peak}" data-image="${mountain.Image}"></button>` : ""
		])
	  );
	  peaksInCurrentYear++;

	  // If this is the last mountain, add the summary for its year
	  if (index === processedMountains.length - 1) {
		allTableRows.push(this.createYearSummaryRow(currentYear, peaksInCurrentYear, 5));
	  }
	});

	tbody.innerHTML = '';
	tbody.append(...allTableRows);

	// Update statistics and progress bars (using the original data for consistency)
	this.updateMountainStats(data);
  }

  // Helper to create a year summary row with two cells
  createYearSummaryRow(year, count, totalColumns) {
	const row = document.createElement('tr');
	row.classList.add('year-summary-row'); // Add a class for styling

	// First cell for the descriptive text, spanning all columns but the last
	const textCell = document.createElement('td');
	textCell.setAttribute('colspan', totalColumns - 2);
	textCell.innerHTML = `Bags in <i>${year}</i>`;
	row.append(textCell);

	// Second cell for the count, spanning the last column
	const countCell = document.createElement('td');
	countCell.setAttribute('colspan', 2);
	countCell.innerHTML = `<strong>${count}</strong>`;
	row.append(countCell);

	return row;
  }

  updateMountainStats(mountains) {
	let count13ers = 0;
	let count14ers = 0;

	mountains.forEach(m => {
	  const elevation = parseInt(m.Elevation.replace(/,/g, ''));
	  if (elevation >= 14000) {
		count14ers++;
	  } else if (elevation >= 13000) {
		count13ers++;
	  }
	});

	// Update count displays
	this.updateElement('#totalMountains', mountains.length);
	this.updateElement('#thirteeners', count13ers);
	this.updateElement('#fourteeners', count14ers);

	// Update progress bars
	this.updateProgressBars('thirteeners', count13ers);
	this.updateProgressBars('fourteeners', count14ers);
  }

  updateProgressBars(peakType, current) {
	document.querySelectorAll(`td.peak-progress[data-peak-type="${peakType}"]`).forEach(cell => {
	  const total = parseInt(cell.dataset.total) || 1;
	  const percent = Math.min((current / total) * 100, 100);
	  cell.style.setProperty('--width', `${percent}%`);
	});
  }

  // CONCERTS TABLE (remains unchanged)
  async loadConcerts() {
	const data = await this.fetchData('json/concerts.json', 'concerts');
	const tbody = document.querySelector('#concerts tbody');
	if (!tbody || !data.length) return;

	const rows = data.map(concert => {
	  const { Headliner, Support, Venue, Year } = concert;
	  const vibe = concert["😃"] || '';
	  const photo = concert["📷"] || '';

	  return this.createRow([
		`${Headliner}${Support ? `<br><small>${Support}</small>` : ''}`,
		Venue,
		Year ? `<time class="nowrap" datetime="${Year}">${Year}</time>` : "",
		vibe
		//photo
	  ]);
	});

	tbody.innerHTML = '';
	tbody.append(...rows);

	// Update concert statistics
	this.updateElement('#concert-count', data.length);
	this.updateConcertStats(data);
  }

  updateConcertStats(data) {
	const { artists, venues } = this.countArtistsAndVenues(data);

	const topArtists = this.getTopItems(artists, 8);
	const topVenues = this.getTopItems(venues, 8);

	this.updateElement('#top-artists', topArtists, true);
	this.updateElement('#top-venues', topVenues, true);
  }

  countArtistsAndVenues(data) {
	const artistCounts = new Map();
	const venueCounts = new Map();

	data.forEach(concert => {
	  const { Headliner, Support, Venue } = concert;

	  // Count main artist
	  const mainArtist = Headliner.trim();
	  if (mainArtist.toLowerCase() !== 'et al.' && mainArtist.toLowerCase() !== 'decadence') {
		artistCounts.set(mainArtist, (artistCounts.get(mainArtist) || 0) + 1);
	  }

	  // Count support acts
	  if (Support) {
		const supportActs = Support.split(',').map(act => act.trim());
		supportActs.forEach(act => {
		  const lower = act.toLowerCase();
		  if (lower !== 'et al.' && lower !== 'decadence') {
			artistCounts.set(act, (artistCounts.get(act) || 0) + 1);
		  }
		});
	  }


	  // Count venues
	  venueCounts.set(Venue, (venueCounts.get(Venue) || 0) + 1);
	});

	return { artists: artistCounts, venues: venueCounts };
  }

  getTopItems(countMap, limit) {
	return Array.from(countMap.entries())
	  .sort((a, b) => b[1] - a[1])
	  .slice(0, limit)
	  .map(([name, count]) => `<span class="nowrap">${name} <small>x${count}</small></span>`)
	  .join(', <wbr>');
  }

  // VENUE HIGHLIGHTING (remains unchanged)
  highlightVenues() {
	const venues = [
	  { name: 'Red Rocks', className: 'venue--red-rocks' },
	  { name: 'Bluebird Theater', className: 'venue--bluebird' },
	  { name: 'Ogden Theater', className: 'venue--ogden' },
	  { name: 'Belly Up', className: 'venue--belly-up' },
	  { name: 'Vortex Music Fest', className: 'venue--vortex' },
	  { name: 'Golden Triangle', className: 'venue--golden-tri' }
	];

	venues.forEach(({ name, className }) => this.styleWord(name, className));
  }

  styleWord(word, className) {
	const walker = document.createTreeWalker(
	  document.body,
	  NodeFilter.SHOW_TEXT,
	  {
		acceptNode: (node) => {
		  // Skip script and style tags
		  const parent = node.parentElement;
		  return parent && !['SCRIPT', 'STYLE'].includes(parent.tagName)
			? NodeFilter.FILTER_ACCEPT
			: NodeFilter.FILTER_REJECT;
		}
	  }
	);

	const textNodes = [];
	let node;
	while (node = walker.nextNode()) {
	  textNodes.push(node);
	}

	textNodes.forEach(textNode => {
	  const text = textNode.nodeValue;
	  const regex = new RegExp(`\\b(${this.escapeRegex(word)})\\b`, 'gi');

	  if (regex.test(text)) {
		const newText = text.replace(regex, `<span class="${className}">$1</span>`);
		const wrapper = document.createElement('span');
		wrapper.innerHTML = newText;
		textNode.replaceWith(...wrapper.childNodes);
	  }
	});
  }

  escapeRegex(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // UTILITY METHODS (remains unchanged)
  createRow(cells) {
	const row = document.createElement('tr');
	row.innerHTML = cells.map(cell => `<td>${cell}</td>`).join('');
	return row;
  }

  updateElement(selector, content, isHTML = false) {
	const element = document.querySelector(selector);
	if (element) {
	  if (isHTML) {
		element.innerHTML = content;
	  } else {
		element.textContent = content;
	  }
	}
  }
}

// Initialize when script loads
new TableManager();