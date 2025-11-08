/**
 * Peak Climbing Map
 */
import dataCache from '../utils/shared-data.js';
import { parseExifDate, formatElevation } from '../utils/exif-utils.js';

class PeakMap {
	constructor() {
		this.map = null;
		this.peaks = [];
	}

	async init() {
		try {
			await this.loadPeaks();
			this.createMap();
			this.addMarkers();
		} catch (error) {
			this.showError(error.message);
		}
	}

	async loadPeaks() {
		const exifData = await dataCache.fetch('/json/exif-data.json');
		
		this.peaks = Object.entries(exifData)
			.filter(([filepath]) => filepath.startsWith('summits/'))
			.map(([filepath, exif]) => this.createPeak(filepath, exif))
			.filter(peak => peak !== null);

		if (this.peaks.length === 0) {
			throw new Error('No summit peaks found with GPS data');
		}
	}

	createPeak(filepath, exif) {
		// Validate GPS data exists
		if (!exif?.gps?.lat || !exif?.gps?.lon) return null;

		const lat = Number(exif.gps.lat);
		const lon = Number(exif.gps.lon);

		// Validate coordinates
		if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
			return null;
		}

		const filename = filepath.split('/').pop();
		if (!filename) return null;

		// Convert filename to title (e.g., "mount-elbert.jpg" → "Mount Elbert")
		const title = filename
			.replace(/\.[^/.]+$/, '')
			.split(/[-_]/)
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');

		return {
			title,
			filename,
			filepath,
			lat,
			lon,
			altitude: exif.gps.alt || null,
			date: parseExifDate(exif.date),
			coordinates: {
				lat: exif.gps.latDMS || `${lat.toFixed(6)}°`,
				lon: exif.gps.lonDMS || `${lon.toFixed(6)}°`
			}
		};
	}

	createMap() {
		const container = document.getElementById('map');
		if (!container) throw new Error('Map container not found');

		// Calculate center
		const avgLat = this.peaks.reduce((sum, p) => sum + p.lat, 0) / this.peaks.length;
		const avgLon = this.peaks.reduce((sum, p) => sum + p.lon, 0) / this.peaks.length;

		this.map = L.map('map', {
			center: [avgLat, avgLon],
			zoom: 12,
			zoomControl: true
		});

		// Add tile layer
		const apiKey = 'Q2YUsN8Bauugiv3dZ0gd';
		L.tileLayer(`https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${apiKey}`, {
			minZoom: 6,
			maxZoom: 12,
			attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
		}).addTo(this.map);
	}

	addMarkers() {
		const markerGroup = new L.featureGroup();

		this.peaks.forEach(peak => {
			const icon = L.divIcon({
				className: 'map-marker',
				html: '<div></div>',
				iconSize: [10, 10],
				iconAnchor: [5, 5]
			});

			const marker = L.marker([peak.lat, peak.lon], { icon });

			// Create popup content
			const elevation = formatElevation(peak.altitude);
			const date = peak.date ? peak.date.toLocaleDateString() : 'Unknown';
			
			const popup = `
				<div class="popup-content">
					<div class="popup-title">${peak.title}</div>
					<div class="popup-details">
						<div class="popup-date">${date}</div>
						<div class="popup-elevation">${elevation.feet} ft</div>
					</div>
				</div>
			`;

			marker.bindPopup(popup, {
				maxWidth: 300,
				className: 'custom-popup'
			});

			marker.addTo(this.map);
			markerGroup.addLayer(marker);
		});

		// Fit bounds to show all markers
		if (markerGroup.getLayers().length > 0) {
			this.map.fitBounds(markerGroup.getBounds(), { padding: [20, 20] });
		}
	}

	showError(message) {
		const container = document.getElementById('map');
		if (container) {
			container.innerHTML = `
				<div class="error" style="padding: 2rem; text-align: center;">
					<div style="font-size: 2rem; margin-bottom: 10px;">⚠️</div>
					<div><strong>Error:</strong> ${message}</div>
				</div>
			`;
		}
	}
}

// Initialize when Leaflet is loaded
import('/js/map/leaflet.js')
	.then(() => {
		const peakMap = new PeakMap();
		peakMap.init();
		window.peakMap = peakMap;
	})
	.catch(err => {
		console.error('Failed to load Leaflet:', err);
		const container = document.getElementById('map');
		if (container) {
			container.innerHTML = '<div class="error" style="padding: 2rem; text-align: center;"><strong>Error:</strong> Map library failed to load.</div>';
		}
	});