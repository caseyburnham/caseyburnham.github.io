import {
	createTallyList,
	updateElement
}
from './table-utils.js';
const VENUES_TO_HIGHLIGHT = [{
	name: 'Red Rocks',
	className: 'venue--red-rocks'
}, {
	name: 'Bluebird Theater',
	className: 'venue--bluebird'
}, {
	name: 'Ogden Theater',
	className: 'venue--ogden'
}, {
	name: 'Belly Up',
	className: 'venue--belly-up'
}, {
	name: 'Summit Music Hall',
	className: 'venue--summit'
}, {
	name: 'Fillmore Auditorium',
	className: 'venue--fillmore'
}, {
	name: 'Ball Arena',
	className: 'venue--ball-arena'
}, {
	name: 'Gothic Theater',
	className: 'venue--gothic'
}, {
	name: 'Golden Triangle',
	className: 'venue--golden-tri'
}];
const ARTIST_EXCLUSIONS = new Set(['et al.', 'decadence', '(DJ Set)']);

function countArtistsAndVenues(concerts) {
	const artists = new Map();
	const venues = new Map();
	concerts.forEach(({
		Headliner,
		Support,
		Venue
	}) => {
		if (!Headliner || !Venue) return;
		[Headliner, ...(Support ? Support.split(',') : [])].map(artist => artist.trim())
			.filter(artist => artist && !ARTIST_EXCLUSIONS.has(artist.toLowerCase()))
			.forEach(artist => artists.set(artist, (artists.get(artist) || 0) + 1));
		venues.set(Venue, (venues.get(Venue) || 0) + 1);
	});
	return {
		artists,
		venues
	};
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
			const venue = VENUES_TO_HIGHLIGHT.find(item => item.name.toLowerCase() === name.toLowerCase());
			return venue?.className || '';
		}
	}));
}

function highlightVenues() {
	const venueMap = new Map(VENUES_TO_HIGHLIGHT.map(venue => [venue.name.toLowerCase(), venue.className]));
	document.querySelectorAll('.concert-venue')
		.forEach(cell => {
			const className = venueMap.get(cell.textContent.trim()
				.toLowerCase());
			if (className) cell.classList.add(className);
		});
}
export function renderConcerts(concerts) {
	if (!Array.isArray(concerts) || !concerts.length) return;
	const tbody = document.querySelector('#concerts tbody');
	const template = document.getElementById('concert-row-template');
	if (!tbody || !template) return;
	const fragment = document.createDocumentFragment();
	concerts.forEach(concert => {
		const row = template.content.cloneNode(true);
		row.querySelector('.artist-headliner')
			.textContent = concert.Headliner || '';
		if (concert.Support) {
			row.querySelector('.artist-support-name')
				.textContent = concert.Support;
		}
		else {
			row.querySelector('.artist-support-group')
				?.remove();
		}
		row.querySelector('.concert-venue')
			.textContent = concert.Venue || '';
		row.querySelector('.concert-emoji')
			.textContent = concert['😃'] || '';
		const time = row.querySelector('.concert-year time');
		if (concert.Year && time) {
			time.dateTime = concert.Year;
			time.textContent = concert.Year;
		}
		else {
			time?.remove();
		}
		fragment.appendChild(row);
	});
	tbody.replaceChildren(fragment);
	updateElement('#concert-count', concerts.length);
	const {
		artists,
		venues
	} = countArtistsAndVenues(concerts);
	updateTopList('#top-artists', artists, 7);
	updateTopList('#top-venues', venues, 8);
	highlightVenues();
}