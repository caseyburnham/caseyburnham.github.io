import {
  createCachedResponse,
  createErrorResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  rejectUnsupportedMethod,
  sampleItems
} from '../lib/discogs-utils.mjs';

const PAGE_SIZE = 100;
const RECORD_COUNT = 5;

const transformItem = (item) => ({
  artist: item.release.artist,
  title: item.release.title,
  cover_image: item.release.thumbnail,
  price: item.price.value.toFixed(2),
  url: item.uri,
  mediaType: getMediaType(item.release.formats)
});

export default async (request) => {
  const methodResponse = rejectUnsupportedMethod(request);
  if (methodResponse) return methodResponse;

  try {
    const { username, token } = getCredentials();
    const inventoryPath = `/users/${username}/inventory`;
    const firstPage = await fetchDiscogs(
      `${inventoryPath}?sort=listed&sort_order=desc&page=1&per_page=${PAGE_SIZE}`,
      token
    );

    if (firstPage.pagination.items === 0) {
      return createCachedResponse([]);
    }

    const itemCount = firstPage.pagination.items;
    const lastEligiblePage = Math.max(1, Math.floor((itemCount - RECORD_COUNT) / PAGE_SIZE) + 1);
    const randomPage = Math.floor(Math.random() * lastEligiblePage) + 1;
    const pageData = randomPage === 1
      ? firstPage
      : await fetchDiscogs(
        `${inventoryPath}?sort=listed&sort_order=desc&page=${randomPage}&per_page=${PAGE_SIZE}`,
        token
      );
    const inventory = sampleItems(pageData.listings, RECORD_COUNT).map(transformItem);
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
