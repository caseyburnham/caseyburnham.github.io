/**
 * EXIF data utilities
 */

/**
 * Parse EXIF date to JavaScript Date
 */
export function parseExifDate(dateObj) {
	if (!dateObj) return null;
	
	if (dateObj.year && dateObj.month && dateObj.day) {
		return new Date(
			dateObj.year,
			dateObj.month - 1,
			dateObj.day,
			dateObj.hour || 0,
			dateObj.minute || 0,
			dateObj.second || 0
		);
	}
	
	return new Date(dateObj.rawValue || dateObj);
}

/**
 * Format EXIF date to YYYY-MM-DD
 */
export function formatExifDate(input) {
	if (!input) return null;
	
	let date;
	if (input instanceof Date) {
		date = input;
	} else if (input.year && input.month && input.day) {
		const { year, month, day } = input;
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	} else {
		date = parseExifDate(input);
	}
	
	if (!date || isNaN(date.getTime())) return null;
	
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	
	return `${year}-${month}-${day}`;
}

/**
 * Format elevation for display
 */
export function formatElevation(altitudeMeters) {
	if (!altitudeMeters || isNaN(altitudeMeters)) {
		return { feet: 'Unknown', meters: 'Unknown', display: 'Unknown' };
	}
	
	const feet = Math.round(altitudeMeters * 3.28084);
	const meters = Math.round(altitudeMeters);
	
	return {
		feet: feet.toLocaleString(),
		meters: meters.toLocaleString(),
		display: `${feet.toLocaleString()} ft`
	};
}

/**
 * Find EXIF data for an image by matching filename
 */
export function findExifData(imageSrc, exifDataset) {
	if (!exifDataset || Object.keys(exifDataset).length === 0) return null;
	
	const url = new URL(imageSrc, window.location.origin);
	const path = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
	
	// Get just the filename without extension
	const srcFilename = path.split('/').pop().toLowerCase();
	const srcBase = srcFilename.split('.')[0];
	
	// Find all matching base filenames
	const candidates = Object.entries(exifDataset)
		.filter(([key]) => {
			const keyBase = key.split('/').pop().toLowerCase().split('.')[0];
			return keyBase === srcBase;
		});
	
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0][1];
	
	// If multiple matches, try exact path match first
	const exactMatch = candidates.find(([key]) => key.toLowerCase() === path.toLowerCase());
	if (exactMatch) return exactMatch[1];
	
	// Otherwise return first match
	return candidates[0][1];
}

/**
 * Normalize image path (remove /images/ prefix)
 */
export function normalizeImagePath(path) {
	if (!path) return '';
	return path.replace(/^\/images\//, '');
}