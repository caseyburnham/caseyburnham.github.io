// Table Data Manager
class TableManager {
  constructor() {
	this.data = {};
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
	const loaders = [
	  this.loadProductions(),
	  this.loadMountains(),
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

  // PRODUCTIONS TABLE
  async loadProductions() {
	const data = await this.fetchData('/json/productions.json', 'productions');
	const tableBody = document.querySelector('#productions tbody');
	if (!tableBody || !data.length) return;

	const rows = data.map(entry => this.createRow([
	  entry.Production,
	  entry.Company,
	  entry.A1,
	  entry.A2,
	  entry.SD,
	  entry.AD,
	  entry.LZ,
	  entry.Notes || ''
	]));

	tableBody.innerHTML = '';
	tableBody.append(...rows);
  }

  // MOUNTAINS TABLE
  async loadMountains() {
	const data = await this.fetchData('json/mountains.json', 'mountains');
	const tbody = document.querySelector('#mountains tbody');
	if (!tbody || !data.length) return;

	// Generate table rows
	const rows = data.map(({ Peak, Elevation, Range, Count }) => 
	  this.createRow([
		`${Peak}${Count > 1 ? ` <small>x${Count}</small>` : ''}`,
		Elevation,
		Range
	  ])
	);

	tbody.innerHTML = '';
	tbody.append(...rows);

	// Update statistics and progress bars
	this.updateMountainStats(data);
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

  // CONCERTS TABLE
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
		Year,
		vibe,
		photo
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
	  if (mainArtist.toLowerCase() !== 'et al.') {
		artistCounts.set(mainArtist, (artistCounts.get(mainArtist) || 0) + 1);
	  }

	  // Count support acts
	  if (Support) {
		const supportActs = Support.split(',').map(act => act.trim());
		supportActs.forEach(act => {
		  if (act.toLowerCase() !== 'et al.') {
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
	  .map(([name, count]) => `${name} <small>x${count}</small>`)
	  .join(', ');
  }

  // VENUE HIGHLIGHTING
  highlightVenues() {
	const venues = [
	  { name: 'Red Rocks', className: 'red-rocks' },
	  { name: 'Bluebird Theater', className: 'bluebird' },
	  { name: 'Ogden Theater', className: 'ogden' },
	  { name: 'Belly Up', className: 'belly-up' },
	  { name: 'Vortex Music Fest', className: 'vortex' },
	  { name: 'Fiddlers Green', className: 'fiddlers' },
	  { name: 'Golden Triangle', className: 'golden-tri' }
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

  // UTILITY METHODS
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