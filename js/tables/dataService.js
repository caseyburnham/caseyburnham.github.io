import { CONFIG } from './config.js';
import dataCache from '../shared-data.js';

export const dataService = {
	async fetchData(url) {
		try {
			return await dataCache.fetch(url);
		} catch (error) {
			console.error(`Error fetching ${url}:`, error);
			return null;
		}
	},

	async getAllData() {
		const [exifData, productions, mountains, concerts] = await Promise.all([
			this.fetchData(CONFIG.urls.exif),
			this.fetchData(CONFIG.urls.productions),
			this.fetchData(CONFIG.urls.mountains),
			this.fetchData(CONFIG.urls.concerts)
		]);

		return {
			productions,
			mountains,
			concerts,
			exifData: exifData || {}
		};
	}
};