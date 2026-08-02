const DISCOGS_API_BASE = 'https://api.discogs.com';
const DISCOGS_TIMEOUT_MS = 8000;
const MEDIA_TYPES = new Set(['Vinyl', 'CD', 'Cassette']);
const PUBLIC_CACHE_CONTROL = [
	'public',
	'durable',
	'max-age=900',
	'stale-while-revalidate=86400'
].join(', ');

class DiscogsError extends Error {
	constructor(status, message, options) {
		super(message, options);
		this.name = 'DiscogsError';
		this.status = status;
	}
}

const getMediaType = (formats) => {
	if (!Array.isArray(formats)) return 'Vinyl';
	return formats.map(format => format.name).find(name => MEDIA_TYPES.has(name)) || 'Vinyl';
};

const fetchDiscogs = async (
	path,
	token,
	{ fetchImpl = fetch, timeoutMs = DISCOGS_TIMEOUT_MS } = {}
) => {
	let response;
	try {
		response = await fetchImpl(`${DISCOGS_API_BASE}${path}`, {
			headers: { Authorization: `Discogs token=${token}` },
			signal: AbortSignal.timeout(timeoutMs)
		});
	} catch (error) {
		const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
		throw new DiscogsError(
			timedOut ? 504 : 502,
			timedOut ? 'Discogs API request timed out' : 'Discogs API request failed',
			{ cause: error }
		);
	}

	if (!response.ok) {
		throw new DiscogsError(
			response.status,
			`Discogs API request failed: ${response.status} ${response.statusText}`
		);
	}

	try {
		const data = await response.json();
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			throw new TypeError('Discogs API returned a non-object response');
		}
		return data;
	} catch (error) {
		throw new DiscogsError(502, 'Discogs API returned invalid JSON', { cause: error });
	}
};

const getCredentials = () => {
	const { DISCOGS_USERNAME: username, DISCOGS_TOKEN: token } = process.env;

	if (!username || !token) {
		throw new DiscogsError(500, 'Missing Discogs credentials');
	}

	return { username, token };
};

const rejectUnsupportedMethod = (request) => {
	if (request.method === 'GET') return null;

	return createResponse(405, { error: 'Method not allowed' }, {
		Allow: 'GET',
		'Cache-Control': 'no-store'
	});
};

const sampleItems = (items, count) => {
	if (!Array.isArray(items) || !Number.isSafeInteger(count) || count <= 0) return [];

	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
	}

	return shuffled.slice(0, count);
};

const parseDiscogsPage = (data, itemKey) => {
	const items = data?.[itemKey];
	const pageCount = data?.pagination?.pages;
	const itemCount = data?.pagination?.items;

	if (
		!Array.isArray(items) ||
		!Number.isSafeInteger(pageCount) ||
		pageCount < 0 ||
		!Number.isSafeInteger(itemCount) ||
		itemCount < 0
	) {
		throw new DiscogsError(502, 'Discogs API returned an invalid page');
	}

	return { itemCount, items, pageCount };
};

const selectRandomPage = (pageCount, random = Math.random) => {
	const pages = Number.isSafeInteger(pageCount) && pageCount > 0 ? pageCount : 1;
	return Math.floor(random() * pages) + 1;
};

const createResponse = (status, body, headers = {}) => new Response(
	JSON.stringify(body),
	{
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers
		}
	}
);

const createCachedResponse = (body) => createResponse(200, body, {
	'Cache-Control': 'public, max-age=0, must-revalidate',
	'Netlify-CDN-Cache-Control': PUBLIC_CACHE_CONTROL
});

const createErrorResponse = (error, fallbackMessage) => {
	const statusCode = Number.isInteger(error.status) ? error.status : 500;
	return createResponse(statusCode, { error: fallbackMessage }, {
		'Cache-Control': 'no-store'
	});
};

export {
	createCachedResponse,
	createErrorResponse,
	fetchDiscogs,
	getCredentials,
	getMediaType,
	parseDiscogsPage,
	rejectUnsupportedMethod,
	selectRandomPage,
	sampleItems
};
