/**
 * Shared Data Cache
 * @file js/shared-data.js
 * 
 * Centralized data loading to prevent multiple fetches of the same JSON files
 * Uses singleton pattern with promise caching
 */

class DataCache {
  #cache = new Map();
  #pendingRequests = new Map();
  
  /**
   * Fetch data with caching and deduplication
   * @param {string} url - URL to fetch
   * @returns {Promise<any>} Parsed JSON data
   */
  async fetch(url) {
	// Return cached data if available
	if (this.#cache.has(url)) {
	  return this.#cache.get(url);
	}
	
	// Return pending promise if request is already in flight
	if (this.#pendingRequests.has(url)) {
	  return this.#pendingRequests.get(url);
	}
	
	// Create new request
	const promise = this.#fetchAndCache(url);
	this.#pendingRequests.set(url, promise);
	
	try {
	  const data = await promise;
	  return data;
	} finally {
	  // Clean up pending request
	  this.#pendingRequests.delete(url);
	}
  }
  
  /**
   * Actually fetch and cache the data
   * @private
   */
  async #fetchAndCache(url) {
	try {
	  const response = await fetch(url);
	  
	  if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	  }
	  
	  const data = await response.json();
	  
	  // Cache the result
	  this.#cache.set(url, data);
	  
	  return data;
	} catch (error) {
	  console.error(`Failed to fetch ${url}:`, error);
	  throw error;
	}
  }
  
  /**
   * Check if data is cached
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  has(url) {
	return this.#cache.has(url);
  }
  
  /**
   * Get cached data without fetching
   * @param {string} url - URL to get
   * @returns {any|undefined}
   */
  get(url) {
	return this.#cache.get(url);
  }
  
  /**
   * Manually set cached data
   * @param {string} url - URL key
   * @param {any} data - Data to cache
   */
  set(url, data) {
	this.#cache.set(url, data);
  }
  
  /**
   * Clear specific cache entry or all cache
   * @param {string} [url] - Optional URL to clear, or clear all if omitted
   */
  clear(url) {
	if (url) {
	  this.#cache.delete(url);
	  this.#pendingRequests.delete(url);
	} else {
	  this.#cache.clear();
	  this.#pendingRequests.clear();
	}
  }
  
  /**
   * Preload data (useful for eager loading)
   * @param {string|string[]} urls - URL or array of URLs to preload
   */
  async preload(urls) {
	const urlArray = Array.isArray(urls) ? urls : [urls];
	await Promise.all(urlArray.map(url => this.fetch(url)));
  }
}

// Create singleton instance
const dataCache = new DataCache();

// Make it globally available
window.dataCache = dataCache;

// Export for ES modules
export default dataCache;