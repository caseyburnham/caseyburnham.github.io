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

	// Inject counts into spans
	document.querySelector('#totalMountains').textContent = total;
	document.querySelector('#thirteeners').textContent = count13ers;
	document.querySelector('#fourteeners').textContent = count14ers;

	// *** NEW: Update progress bars ***
	document.querySelectorAll('td.peak-progress').forEach(cell => {
		const total = +cell.dataset.total || 1;
		let current = 0;

		if (cell.dataset.peakType === 'thirteeners') {
			current = count13ers;
		} else if (cell.dataset.peakType === 'fourteeners') {
			current = count14ers;
		}

		const percent = Math.min((current / total) * 100, 100);
		cell.style.setProperty('--width', percent + '%');
	});
}

//BAG BAR
function updatePeakProgress(thirteenersCount, fourteenersCount) {
	const thirteenersSpan = document.getElementById('thirteeners');
	const fourteenersSpan = document.getElementById('fourteeners');

	thirteenersSpan.textContent = thirteenersCount;
	fourteenersSpan.textContent = fourteenersCount;

	document.querySelectorAll('td.peak-progress').forEach(cell => {
		const total = +cell.dataset.total || 1;

		if (cell.dataset.peakType === 'thirteeners') {
			const percent = Math.min((thirteenersCount / total) * 100, 100);
			cell.style.setProperty('--width', percent + '%');
		} else if (cell.dataset.peakType === 'fourteeners') {
			const percent = Math.min((fourteenersCount / total) * 100, 100);
			cell.style.setProperty('--width', percent + '%');
		}
	});
}

// Initial call with current values
window.addEventListener('DOMContentLoaded', () => {
	updatePeakProgress(
		+document.getElementById('thirteeners').textContent || 0,
		+document.getElementById('fourteeners').textContent || 0
	);
});

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
		const supportActs = Support ?
			Support.split(',').map(act => act.trim()) :
			[];

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

//
//VIDEO CONTROLS
const video = document.getElementById('livephoto');

video.addEventListener('ended', () => video.pause());

// Replay on hover
video.addEventListener('mouseenter', () => {
	video.currentTime = 0;
	video.play();
});

// Replay on tap (for touch devices)
video.addEventListener('click', () => {
	if (video.paused) {
		video.currentTime = 0;
		video.play();
	} else {
		video.pause();
	}
});
//END VIDEO
//

//
//PHOTO MODAL
let exifData = {};
let photoKeys = [];
let currentIndex = 0;

// Create modal once, hidden initially
const modal = document.createElement('div');
modal.className = 'modal';
modal.innerHTML = `
  <span class="modal-close">&times;</span>
  <div class="modal-card">
   <img src="" alt="">
   <div class="modal-caption"></div>
 </div>
`;
document.body.appendChild(modal);

const modalImg = modal.querySelector('img');
const caption = modal.querySelector('.modal-caption');
const closeBtn = modal.querySelector('.modal-close');

function openModal(filename) {
  const photo = exifData[filename];
  if (!photo) return;

  currentIndex = photoKeys.indexOf(filename);

  modalImg.src = `/images/${filename}`;
  modalImg.alt = photo.title;
  caption.innerHTML = `
	<h2>${photo.title}</h2>
	<hr>
	<small class="exif-row">
	<span>ISO ${photo.iso}</span>
	<span>${photo.lens}mm</span>
	<span>${photo.ev} ev</span>
	<span><i>&#402;</i>${photo.aperture}</span>
	<span>${photo.shutter}s</span>
	<span class="format">${photo.format}</span>
	</small>
  `;

  modal.style.display = 'flex';
  // Allow pointer events and fade in
  requestAnimationFrame(() => {
	modal.style.pointerEvents = 'auto';
	modal.style.opacity = '1';
  });
}

function closeModal() {
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';

  modal.addEventListener('transitionend', function handler() {
	modal.style.display = 'none';
	modal.removeEventListener('transitionend', handler);
  });
}

closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (modal.style.display !== 'flex') return;

  if (e.key === 'ArrowRight') {
	currentIndex = (currentIndex + 1) % photoKeys.length;
	openModal(photoKeys[currentIndex]);
  } else if (e.key === 'ArrowLeft') {
	currentIndex = (currentIndex - 1 + photoKeys.length) % photoKeys.length;
	openModal(photoKeys[currentIndex]);
  } else if (e.key === 'Escape') {
	closeModal();
  }
});

fetch('/json/exif-data.json')
  .then(res => res.json())
  .then(data => {
	exifData = data;
	photoKeys = Object.keys(exifData);
	initModal();
  });

function initModal() {
  document.querySelectorAll('.photo-thumb img').forEach(img => {
	img.parentElement.addEventListener('click', () => {
	  const filename = img.src.split('/').pop();
	  openModal(filename);
	});
  });
}
//END PHOTO MODAL
//

//
//PHOTO ASPECT
document.querySelectorAll('.photo-thumb img').forEach(img => {
	img.addEventListener('load', () => {
		const ratio = img.naturalWidth / img.naturalHeight;
		if (ratio > 2) {
			img.parentElement.classList.add('pano');
		} else if (ratio < 0.8) {
			img.parentElement.classList.add('portrait');
		} else if (Math.abs(ratio - 1) < 0.1) {
			img.parentElement.classList.add('square'); // optional
		} else {
			img.parentElement.classList.add('landscape');
		}
	});
});
//END ASPECT
//