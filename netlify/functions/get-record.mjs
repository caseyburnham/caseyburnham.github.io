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

const FOLDER_ID = '2166321';
const PAGE_SIZE = 100;
const RECORD_COUNT = 5;

const transformRecord = (release) => {
	const basic = release?.basic_information;
	const artist = basic?.artists?.[0]?.name;
	if (!artist || !basic?.title || !basic.id) return null;

	return {
		artist,
		title: basic.title,
		cover_image: basic.cover_image,
		rating: release.rating,
		url: `https://www.discogs.com/release/${basic.id}`,
		mediaType: getMediaType(basic.formats)
	};
};

export default async (request) => {
	const methodResponse = rejectUnsupportedMethod(request);
	if (methodResponse) return methodResponse;

	try {
		const { username, token } = getCredentials();
		const releasesPath = `/users/${username}/collection/folders/${FOLDER_ID}/releases`;
		const firstPage = parseDiscogsPage(await fetchDiscogs(
			`${releasesPath}?page=1&per_page=${PAGE_SIZE}`,
			token
		), 'releases');

		const randomPage = selectRandomPage(firstPage.pageCount);
		const pageData = randomPage === 1
			? firstPage
			: parseDiscogsPage(
				await fetchDiscogs(`${releasesPath}?page=${randomPage}&per_page=${PAGE_SIZE}`, token),
				'releases'
			);
		const validRecords = pageData.items.map(transformRecord).filter(Boolean);
		const records = sampleItems(validRecords, RECORD_COUNT);

		return createCachedResponse(records);
	} catch (error) {
		console.error('get-record error:', error);
		return createErrorResponse(error, 'Failed to fetch records');
	}
};

export const config = {
	path: '/api/discogs/records',
	method: 'GET',
	rateLimit: {
		windowLimit: 10,
		windowSize: 60,
		aggregateBy: ['ip', 'domain']
	}
};
