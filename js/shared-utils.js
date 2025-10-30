/**
 * Shared Utilities
 * @file js/shared-utils.js
 */

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Format EXIF date object to ISO date string (YYYY-MM-DD)
 */
export function formatExifDate(dateObj) {
  if (!dateObj?.year || !dateObj?.month || !dateObj?.day) {
	return null;
  }
  
  const { year, month, day } = dateObj;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse EXIF date object to JavaScript Date
 */
export function parseExifDate(dateObj) {
  if (!dateObj) return null;
  
  try {
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
  } catch (error) {
	console.warn('Failed to parse date:', error);
	return null;
  }
}

// ============================================================================
// Elevation Utilities
// ============================================================================

/**
 * Convert meters to feet
 */
export function metersToFeet(meters) {
  return meters * 3.28084;
}

/**
 * Format elevation for display
 */
export function formatElevation(altitude, options = {}) {
  const { 
	showBoth = false, 
	unit = 'feet',
	locale = 'en-US' 
  } = options;
  
  if (!altitude || isNaN(altitude)) {
	return { feet: 'Unknown', meters: 'Unknown', display: 'Unknown' };
  }
  
  const feet = Math.round(metersToFeet(altitude));
  const meters = Math.round(altitude);
  
  const feetStr = feet.toLocaleString(locale);
  const metersStr = meters.toLocaleString(locale);
  
  let display;
  if (showBoth) {
	display = `${feetStr} ft (${metersStr} m)`;
  } else {
	display = unit === 'feet' ? `${feetStr} ft` : `${metersStr} m`;
  }
  
  return { feet: feetStr, meters: metersStr, display };
}

// ============================================================================
// EXIF Data Utilities
// ============================================================================

/**
 * Find EXIF data for an image source
 */
export function findExifData(imageSrc, exifDataset) {
  if (!exifDataset || Object.keys(exifDataset).length === 0) {
	return null;
  }
  
  try {
	const url = new URL(imageSrc, window.location.origin);
	const normalizedSrcPath = url.pathname.startsWith('/') 
	  ? url.pathname.substring(1) 
	  : url.pathname;
	
	const srcPathLower = normalizedSrcPath.toLowerCase();
	const srcFilename = normalizedSrcPath.split('/').pop().toLowerCase();
	const srcBaseFilename = srcFilename.split('.')[0];
	const srcExtension = srcFilename.split('.').pop();
	
	const candidates = [];
	for (const [key, data] of Object.entries(exifDataset)) {
	  const keyBase = key.split('/').pop().toLowerCase().split('.')[0];
	  if (keyBase === srcBaseFilename) {
		candidates.push({ key, data });
	  }
	}
	
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0].data;
	
	const exactMatch = candidates.find(c => c.key.toLowerCase() === srcPathLower);
	if (exactMatch) return exactMatch.data;
	
	const extensionMatch = candidates.find(c => {
	  const keyExtension = c.key.split('.').pop().toLowerCase();
	  return keyExtension === srcExtension;
	});
	if (extensionMatch) return extensionMatch.data;
	
	console.warn(`Multiple EXIF candidates found for "${srcBaseFilename}", using first match`);
	return candidates[0].data;
  } catch (error) {
	console.warn('Error finding EXIF data:', error);
	return null;
  }
}

/**
 * Normalize image path for EXIF lookup
 */
export function normalizeImagePath(path) {
  if (!path) return '';
  return path.replace(/^\/images\//, '');
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
	const later = () => {
	  clearTimeout(timeout);
	  func.apply(this, args);
	};
	clearTimeout(timeout);
	timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
	if (!inThrottle) {
	  func.apply(this, args);
	  inThrottle = true;
	  setTimeout(() => inThrottle = false, limit);
	}
  };
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Convert filename to readable title
 */
export function filenameToTitle(filename) {
  return filename
	.replace(/\.[^/.]+$/, '')
	.split(/[-_]/)
	.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
	.join(' ');
}

export default {
  formatExifDate,
  parseExifDate,
  metersToFeet,
  formatElevation,
  findExifData,
  normalizeImagePath,
  debounce,
  throttle,
  filenameToTitle
};