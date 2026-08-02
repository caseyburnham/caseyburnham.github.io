/**
 * Map - Vector tiles with MapLibre GL
 */
import maplibregl from 'maplibre-gl';
import dataCache from '../utils/data-cache.js';
import {
	normalizeImagePath
}
from '../utils/exif-utils.js';
const MAP_STYLES = {
	dark: 'https://api.maptiler.com/maps/hybrid/style.json?key=oX3dSTTZ2fL2jX4ozJaM',
	light: 'https://api.maptiler.com/maps/outdoor-v2/style.json?key=oX3dSTTZ2fL2jX4ozJaM'
};
const MAP_LOAD_TIMEOUT_MS = 10000;
class ClimbingMap {
	#map = null;
	#mapContainer = null;
	#markerTemplate = null;
	#popupTemplate = null;
	#errorTemplate = null;
	constructor() {
		this.#mapContainer = document.getElementById('map');
		this.#markerTemplate = document.getElementById('map-marker-template');
		this.#popupTemplate = document.getElementById('map-popup-template');
		this.#errorTemplate = document.getElementById('map-error-template');
		const missing = [!this.#mapContainer && '#map', !this.#markerTemplate && '#map-marker-template', !this.#popupTemplate && '#map-popup-template', !this.#errorTemplate && '#map-error-template'].filter(Boolean);
		if (missing.length > 0) {
			throw new Error(`Missing map elements: ${missing.join(', ')}`);
		}
	}
	async init() {
		try {
			const [mountains, exifData] = await Promise.all([
				dataCache.fetch('/json/mountain-data.json'),
				dataCache.fetch('/json/exif-data.json')
			]);
			await this.#initMap();
			this.#addMarkers(mountains, exifData);
		}
		catch (error) {
			console.error('Map initialization failed:', error);
			this.#map?.remove();
			this.#map = null;
			this.#showError();
			throw error;
		}
	}
	#initMap() {
		const darkModeQuery = matchMedia('(prefers-color-scheme: dark)');
		this.#mapContainer.replaceChildren();
		this.#map = new maplibregl.Map({
			container: this.#mapContainer,
			style: this.#getStyleUrl(darkModeQuery.matches),
			center: [-105.7821, 39.5501],
			zoom: 6.5,
			minZoom: 2,
			maxZoom: 14,
			maxBounds: [
				[-109.5, 36.5],
				[-102.0, 41.5]
			],
			dragRotate: false,
			touchPitch: false,
			attributionControl: true
		});
		this.#map.addControl(new maplibregl.NavigationControl({
			showCompass: false,
			showZoom: true,
			visualizePitch: false
		}), 'top-left');
		return new Promise((resolve, reject) => {
			const handleThemeChange = event => {
				this.#map?.setStyle(this.#getStyleUrl(event.matches));
			};
			const cleanup = () => {
				clearTimeout(timeout);
				this.#map?.off('load', handleLoad);
				this.#map?.off('error', handleError);
			};
			const handleLoad = () => {
				cleanup();
				darkModeQuery.addEventListener('change', handleThemeChange);
				resolve();
			};
			const handleError = event => {
				cleanup();
				reject(event.error || new Error('MapLibre failed to initialize.'));
			};
			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error(`Map initialization timed out after ${MAP_LOAD_TIMEOUT_MS}ms.`));
			}, MAP_LOAD_TIMEOUT_MS);
			this.#map.on('load', handleLoad);
			this.#map.on('error', handleError);
		});
	}
	#getStyleUrl(isDarkMode) {
		return isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light;
	}
	#addMarkers(mountains, exifData) {
		if (!Array.isArray(mountains)) {
			throw new TypeError('Mountain data must be an array');
		}
		mountains.forEach(mountain => {
			if (!mountain.Image) return;
			const imagePath = normalizeImagePath(mountain.Image);
			const exif = exifData[imagePath];
			if (!exif?.gps) return;
			const lat = parseFloat(exif.gps.lat);
			const lon = parseFloat(exif.gps.lon);
			if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
				console.warn('Invalid GPS coordinates:', mountain.Peak, lat, lon);
				return;
			}
			const markerElement = this.#createMarkerElement();
			new maplibregl.Marker({
					element: markerElement
				})
				.setLngLat([lon, lat])
				.setPopup(new maplibregl.Popup({
						offset: 15,
						className: 'custom-popup'
					})
					.setDOMContent(this.#createPopupContent(mountain)))
				.addTo(this.#map);
			markerElement.ariaLabel = `Show details for ${mountain.Peak || 'mountain'}`;
		});
	}
	#createMarkerElement() {
		return this.#markerTemplate.content.firstElementChild.cloneNode(true);
	}
	#createPopupContent(mountain) {
		const content = this.#popupTemplate.content.firstElementChild.cloneNode(true);
		const elevation = content.querySelector('.popup-elevation');
		const date = content.querySelector('.popup-date');
		content.querySelector('.popup-title')
			.textContent = mountain.Peak || 'Unknown Peak';
		elevation.textContent = mountain.Elevation || 'N/A';
		elevation.value = mountain.Elevation?.replaceAll(',', '') || '';
		date.textContent = mountain.Date || 'N/A';
		if (mountain.Date) date.dateTime = mountain.Date;
		content.querySelector('.popup-range')
			.textContent = mountain.Range || 'N/A';
		return content;
	}
	#showError() {
		const error = this.#errorTemplate.content.cloneNode(true);
		this.#mapContainer.replaceChildren(error);
	}
}
export async function initMap() {
	await new ClimbingMap()
		.init();
}
