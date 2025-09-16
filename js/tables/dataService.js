// js/dataService.js
import { CONFIG } from './config.js';

export const dataService = {
  async fetchData(url) {
	try {
	  const response = await fetch(url);
	  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
	  return await response.json();
	} catch (error) {
	  console.error(`Error fetching ${url}:`, error);
	  return null; // Return null to indicate failure
	}
  },
  
  async getAllData() {
	const exifData = await this.fetchData(CONFIG.urls.exif) || {};
	
	const [productions, mountains, concerts] = await Promise.all([
	  this.fetchData(CONFIG.urls.productions),
	  this.fetchData(CONFIG.urls.mountains),
	  this.fetchData(CONFIG.urls.concerts)
	]);

	return { productions, mountains, concerts, exifData };
  }
};