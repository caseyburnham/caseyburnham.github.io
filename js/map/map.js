/**
 * Map - Vector tiles with MapLibre GL
 */
import dataCache from '../utils/shared-data.js';
import { normalizeImagePath } from '../utils/exif-utils.js';

class ClimbingMap {
	#map = null;
	#markers = [];
	#mapContainer = null;
	
	constructor() {
		this.#mapContainer = document.getElementById('map');
		if (!this.#mapContainer) {
			throw new Error('Map container not found');
		}
	}

	async init() {
		try {
			const mountains = await dataCache.fetch('/json/mountain-data.json');
			const exifData = await dataCache.fetch('/json/exif-data.json');
			await this.#initMap();
			this.#addMarkers(mountains, exifData);
		} catch (error) {
			console.error('Map initialization failed:', error);
			this.#showError();
		}
	}

	#initMap() {
		const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const styleUrl = isDarkMode 
			? 'https://api.maptiler.com/maps/hybrid/style.json?key=oX3dSTTZ2fL2jX4ozJaM'
			: 'https://api.maptiler.com/maps/outdoor-v2/style.json?key=oX3dSTTZ2fL2jX4ozJaM';
			
			
	
		this.#map = new maplibregl.Map({
			container: 'map',
			style: styleUrl,
			center: [-105.7821, 39.5501],
			zoom: 6.5,
			minZoom: 2,
			maxZoom: 14,
			maxBounds: [[-109.5, 36.5], [-102.0, 41.5]],
			dragRotate: false,
			touchPitch: false,
			attributionControl: true
		});
		
		this.#map.addControl(
			new maplibregl.NavigationControl({
				showCompass: false,      // Show compass button
				showZoom: true,         // Show +/- zoom buttons
				visualizePitch: false   // Don't show pitch indicator
			}), 
			'top-left'
		);
		
		// Listen for theme changes
		const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
		darkModeQuery.addEventListener('change', (e) => {
			const newStyle = e.matches 
				? 'https://api.maptiler.com/maps/hybrid/style.json?key=oX3dSTTZ2fL2jX4ozJaM'
				: 'https://api.maptiler.com/maps/outdoor-v2/style.json?key=oX3dSTTZ2fL2jX4ozJaM';
			
			// Markers persist through style changes, no need to re-add
			this.#map.setStyle(newStyle);
		});
		
		return new Promise((resolve) => {
			this.#map.on('load', () => {
				resolve();
			});
		});
	}

	#addMarkers(mountains, exifData) {
		if (!Array.isArray(mountains)) {
			console.error('Mountains is not an array:', mountains);
			return;
		}
		
		let validMarkers = 0;
		let invalidMarkers = 0;

		mountains.forEach(mountain => {
			if (!mountain.Image) {
				invalidMarkers++;
				return;
			}

			// Get EXIF data for this mountain's image
			const imagePath = normalizeImagePath(mountain.Image);
			const exif = exifData[imagePath];

			if (!exif || !exif.gps) {
				invalidMarkers++;
				return;
			}

			const lat = parseFloat(exif.gps.lat);
			const lon = parseFloat(exif.gps.lon);

			if (isNaN(lat) || isNaN(lon)) {
				console.warn('Invalid GPS coordinates:', mountain.Peak, lat, lon);
				invalidMarkers++;
				return;
			}

			// Create marker element
			const el = document.createElement('div');
			el.className = 'map-marker';

			// Create popup content
			const popupContent = this.#createPopupContent(mountain);

			// Add marker with popup
			const marker = new maplibregl.Marker({ element: el })
				.setLngLat([lon, lat])
				.setPopup(
					new maplibregl.Popup({ 
						offset: 15,
						className: 'custom-popup'
					})
					.setHTML(popupContent)
				)
				.addTo(this.#map);

			this.#markers.push(marker);
			validMarkers++;
		});
	}

	#createPopupContent(mountain) {
		const title = mountain.Peak || 'Unknown Peak';
		const elevation = mountain.Elevation || 'N/A';
		const date = mountain.Date || 'N/A';
		const range = mountain.Range || 'N/A';

		return `
			<div class="popup-content">
				<div class="popup-title">${title}</div>
				<div class="popup-details">
					<div class="popup-elevation">${elevation} ft</div>
					<div class="popup-date">${date}</div>
					<div class="popup-range">${range} Range</div>
				</div>
			</div>
		`;
	}

	#showError() {
		this.#mapContainer.innerHTML = `
			<div class="error">
				<p>Unable to load map data</p>
			</div>
		`;
	}

	destroy() {
		this.#markers.forEach(marker => marker.remove());
		this.#markers = [];
		this.#map?.remove();
		this.#map = null;
	}
}

// Initialize
let climbingMap = null;

async function initMap() {
	try {
		climbingMap = new ClimbingMap();
		await climbingMap.init();
	} catch (error) {
		console.error('Failed to initialize map:', error);
	}
}

initMap();

// Cleanup
window.addEventListener('beforeunload', () => {
	climbingMap?.destroy();
});