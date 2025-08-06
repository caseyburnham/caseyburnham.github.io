//
//PRODUCTIONS

//PROD TABEL GEN
fetch('/json/productions.json')
  .then(response => response.json())
  .then(data => {
	const tableBody = document.querySelector('#productions tbody');
	data.forEach(entry => {
	  const row = document.createElement('tr');
	  row.innerHTML = `
		<td>${entry.Production}</td>
		<td>${entry.Company}</td>
		<td>${entry.A1}</td>
		<td>${entry.A2}</td>
		<td>${entry.SD}</td>
		<td>${entry.AD}</td>
		<td>${entry.LZ}</td>
		<td>${entry.Notes || ''}</td>
	  `;
	  tableBody.appendChild(row);
	});
  })
  .catch(error => console.error('Error loading productions:', error));
  
//END PRODUCTIONS
//

//
//MOUNTAINS

//MTNS TABLE GEN
async function loadMountains() {
	try {
		const res = await fetch('json/mountains.json');
		const data = await res.json();
		renderTable(data);
	} catch (err) {
		console.error('Failed to load or parse mountains.json:', err);
	}
}

function renderTable(data) {
	const tbody = document.querySelector('#mountains tbody');
	countElevations(data);
	tbody.innerHTML = '';

	data.forEach(({ Peak, Elevation, Range, Count }) => {
		const row = document.createElement('tr');
		row.innerHTML = `
	  <td>${Peak}${Count > 1 ? ` <small>x${Count}</small>` : ''}</td>
	  <td>${Elevation}</td>
	  <td>${Range}</td>
	`;
		tbody.appendChild(row);
	});
}

window.addEventListener('DOMContentLoaded', loadMountains);

// COUNT CLIMBS
function countElevations(mountains) {
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

	const total = mountains.length;

	// Inject into the DOM however you like
	document.querySelector('#totalMountains').textContent = total;
	document.querySelector('#thirteeners').textContent = count13ers;
	document.querySelector('#fourteeners').textContent = count14ers;
}

//END MOUNTAINS
//

//
//CONCERTS

//CONCERT TABLE GEN
async function loadConcerts() {
	try {
		const res = await fetch('json/concerts.json');
		const concertData = await res.json();

		const tbody = document.querySelector('#concerts tbody');

		concertData.forEach(concert => {
			const { Headliner, Support, Venue, Year } = concert;
			const vibe = concert["😃"];
			const photo = concert["📷"];

			const row = document.createElement('tr');
			row.innerHTML = `
		  <td>${Headliner}${Support ? `<br><small>${Support}</small>` : ''}</td>
		  <td>${Venue}</td>
		  <td>${Year}</td>
		  <td>${vibe}</td>
		  <td>${photo}</td>
		`;
			tbody.appendChild(row);
		});
		
		const countSpan = document.getElementById('concert-count');
		if (countSpan) {
			countSpan.textContent = concertData.length;
		}
				
		countTopArtistsAndVenues(concertData);
		highlightVenues();
		
	} catch (err) {
		console.error('Failed to load or parse concerts.json:', err);
	}
	
}

window.addEventListener('DOMContentLoaded', loadConcerts);

//TOP 8
function countTopArtistsAndVenues(data) {
	const artistCounts = new Map();
	const venueCounts = new Map();

	data.forEach(concert => {
		const { Headliner, Support, Venue } = concert;

		const mainArtist = Headliner.trim();
		const supportActs = Support
			? Support.split(',').map(act => act.trim())
			: [];

		if (mainArtist.toLowerCase() !== 'et al.') {
			artistCounts.set(mainArtist, (artistCounts.get(mainArtist) || 0) + 1);
		}

		supportActs.forEach(act => {
			if (act.toLowerCase() !== 'et al.') {
				artistCounts.set(act, (artistCounts.get(act) || 0) + 1);
			}
		});

		venueCounts.set(Venue, (venueCounts.get(Venue) || 0) + 1);
	});

	const topArtists = Array.from(artistCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([name, count]) => `${name} <small>x${count}</small>`)
		.join(', ');

	const topVenues = Array.from(venueCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([name, count]) => `${name} <small>x${count}</small>`)
		.join(', ');

	document.getElementById('top-artists').innerHTML = topArtists;
	document.getElementById('top-venues').innerHTML = topVenues;
}

// HIGHLIGHT
function styleWord(word, className) {
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	const nodes = [];
	while (walker.nextNode()) {
		nodes.push(walker.currentNode);
	}

	nodes.forEach(node => {
		const text = node.nodeValue;
		const regex = new RegExp(`(${word})`, 'gi');
		const newText = text.replace(regex, `<span class="${className}">$1</span>`);

		if (newText !== text) {
			const span = document.createElement('span');
			span.innerHTML = newText;
			node.replaceWith(span);
		}
	});
}

function highlightVenues() {
	styleWord('Red Rocks', 'red-rocks');
	styleWord('Bluebird Theater', 'bluebird');
	styleWord('Ogden Theater', 'ogden');
	styleWord('Belly Up', 'belly-up');
	styleWord('Vortex Music Fest', 'vortex');
	styleWord('Fiddlers Green', 'fiddlers');
	styleWord('Golden Triangle', 'golden-tri');
}

document.addEventListener('DOMContentLoaded', highlightVenues);

//END CONCERTS
//

//
// SORT & ANIMATE TABLES

document.addEventListener('DOMContentLoaded', () => {
  const sortableTables = document.querySelectorAll('.sortable-tables');

  sortableTables.forEach(table => {
	const tableBody = table.querySelector('tbody');
	const tableRows = Array.from(tableBody.querySelectorAll('tr'));
	let originalOrder = [...tableRows];

	// Add a data attribute to each row to hold its original index
	tableRows.forEach((row, index) => {
	  row.dataset.originalIndex = index;
	});

	const tableHeaders = table.querySelectorAll('th');
	tableHeaders.forEach((header, index) => {
	  header.addEventListener('click', () => {
		let currentSortState = header.dataset.sortState || 'none';

		// Clear sort state from other headers
		tableHeaders.forEach(h => {
		  if (h !== header) {
			h.dataset.sortState = 'none';
			h.classList.remove('sorted-asc', 'sorted-desc');
		  }
		});

		// Determine the next sort state
		let newSortState;
		if (currentSortState === 'asc') {
		  newSortState = 'desc';
		} else if (currentSortState === 'desc') {
		  newSortState = 'none';
		} else {
		  newSortState = 'asc';
		}
		header.dataset.sortState = newSortState;

		// Update CSS classes for styling
		header.classList.remove('sorted-asc', 'sorted-desc');
		if (newSortState === 'asc') {
		  header.classList.add('sorted-asc');
		} else if (newSortState === 'desc') {
		  header.classList.add('sorted-desc');
		}

		let sortedRows;
		if (newSortState === 'none') {
		  // Sort by original index
		  sortedRows = [...originalOrder];
		  sortedRows.sort((a, b) => a.dataset.originalIndex - b.dataset.originalIndex);
		} else {
		  sortedRows = [...tableRows];
		  sortedRows.sort((rowA, rowB) => {
			const cellA = rowA.children[index].innerText.toLowerCase();
			const cellB = rowB.children[index].innerText.toLowerCase();

			if (newSortState === 'asc') {
			  return cellA.localeCompare(cellB, undefined, { numeric: true, sensitivity: 'base' });
			} else {
			  return cellB.localeCompare(cellA, undefined, { numeric: true, sensitivity: 'base' });
			}
		  });
		}

		// Animate and re-render the rows
		tableBody.style.opacity = 0;
		setTimeout(() => {
		  tableBody.innerHTML = '';
		  sortedRows.forEach(row => tableBody.appendChild(row));
		  tableBody.style.opacity = 1;
		}, 300); // Wait for the fade-out to complete
	  });
	});
  });
});

//END SORT TABLES
//