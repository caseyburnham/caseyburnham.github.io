export const CONFIG = {
	urls: {
		productions: 'json/production-data.json',
		mountains: 'json/mountain-data.json',
		concerts: 'json/concert-data.json',
		exif: 'json/exif-data.json',
	},
	selectors: {
		productionsTable: '#productions tbody',
		mountainsTable: '#mountains tbody',
		concertsTable: '#concerts tbody',
		totalMountains: '#totalMountains',
		thirteeners: '#thirteeners',
		fourteeners: '#fourteeners',
		peakProgress: 'progress.peak-progress',
		concertCount: '#concert-count',
		topArtists: '#top-artists',
		topVenues: '#top-venues',
	},
	venuesToHighlight: [
		{ name: 'Red Rocks', className: 'venue--red-rocks' },
		{ name: 'Bluebird Theater', className: 'venue--bluebird' },
		{ name: 'Ogden Theater', className: 'venue--ogden' },
		{ name: 'Belly Up', className: 'venue--belly-up' },
		{ name: 'Summit Music Hall', className: 'venue--summit' },
		{ name: 'Fillmore Auditorium', className: 'venue--fillmore' },
		{ name: 'Ball Arena', className: 'venue--ball-arena' },
		{ name: 'Gothic Theater', className: 'venue--gothic' }
	],
	concertArtistExclusions: new Set(['et al.', 'decadence']),
};