import {
  createCachedResponse,
  createErrorResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  rejectUnsupportedMethod,
  sampleItems
} from '../lib/discogs-utils.mjs';

const FOLDER_ID = '2166321';
const PAGE_SIZE = 100;
const RECORD_COUNT = 5;

const transformRecord = (release) => {
  const basic = release.basic_information;
  return {
    artist: basic.artists[0].name,
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
    const firstPage = await fetchDiscogs(
      `${releasesPath}?page=1&per_page=${PAGE_SIZE}`,
      token
    );

    const itemCount = firstPage.pagination.items;
    const lastEligiblePage = Math.max(1, Math.floor((itemCount - RECORD_COUNT) / PAGE_SIZE) + 1);
    const randomPage = Math.floor(Math.random() * lastEligiblePage) + 1;
    const pageData = randomPage === 1
      ? firstPage
      : await fetchDiscogs(`${releasesPath}?page=${randomPage}&per_page=${PAGE_SIZE}`, token);
    const records = sampleItems(pageData.releases, RECORD_COUNT).map(transformRecord);

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
