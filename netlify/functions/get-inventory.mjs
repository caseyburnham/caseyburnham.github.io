import {
	createCachedResponse,
	createErrorResponse,
	fetchDiscogs,
	getCredentials,
	getMediaType,
	parseDiscogsPage,
	rejectUnsupportedMethod,
	selectRandomPage,
	sampleItems
} from '../lib/discogs-utils.mjs';

const PAGE_SIZE = 100;
const RECORD_COUNT = 5;

const transformItem = (item) => {
	const release = item?.release;
	const price = Number(item?.price?.value);
	if (!release?.artist || !release.title || !item?.uri || !Number.isFinite(price)) return null;

	return {
		artist: release.artist,
		title: release.title,
		cover_image: release.thumbnail,
		price: price.toFixed(2),
		url: item.uri,
		mediaType: getMediaType(release.formats)
	};
};

export default async (request) => {
	const methodResponse = rejectUnsupportedMethod(request);
	if (methodResponse) return methodResponse;

	try {
		const { username, token } = getCredentials();
		const inventoryPath = `/users/${username}/inventory`;
		const firstPage = parseDiscogsPage(await fetchDiscogs(
			`${inventoryPath}?sort=listed&sort_order=desc&page=1&per_page=${PAGE_SIZE}`,
			token
		), 'listings');

		if (firstPage.itemCount === 0) {
			return createCachedResponse([]);
		}

		const randomPage = selectRandomPage(firstPage.pageCount);
		const pageData = randomPage === 1
			? firstPage
			: parseDiscogsPage(
				await fetchDiscogs(
					`${inventoryPath}?sort=listed&sort_order=desc&page=${randomPage}&per_page=${PAGE_SIZE}`,
					token
				),
				'listings'
			);
		const validItems = pageData.items.map(transformItem).filter(Boolean);
		const inventory = sampleItems(validItems, RECORD_COUNT);
		return createCachedResponse(inventory);
	} catch (error) {
		console.error('get-inventory error:', error);
		return createErrorResponse(error, 'Failed to fetch inventory');
	}
};

export const config = {
	path: '/api/discogs/inventory',
	method: 'GET',
	rateLimit: {
		windowLimit: 10,
		windowSize: 60,
		aggregateBy: ['ip', 'domain']
	}
};
