const {
  createErrorResponse,
  createResponse,
  fetchDiscogs,
  getCredentials,
  getMediaType,
  parseCount
} = require('./discogs-utils');

const transformItem = (item) => ({
  artist: item.release.artist,
  title: item.release.title,
  cover_image: item.release.thumbnail,
  price: item.price.value.toFixed(2),
  url: item.uri,
  mediaType: getMediaType(item.release.formats)
});

exports.handler = async (event) => {
  try {
    const { username, token } = getCredentials();
    const count = parseCount(event.queryStringParameters?.count, 5, 100);

    const paginationData = await fetchDiscogs(
      `/users/${username}/inventory?per_page=${count}`,
      token
    );

    if (paginationData.pagination.pages === 0) {
      return createResponse(200, []);
    }

    const randomPage = Math.floor(Math.random() * paginationData.pagination.pages) + 1;
    const inventoryData = await fetchDiscogs(
      `/users/${username}/inventory?sort=listed&sort_order=desc&page=${randomPage}&per_page=${count}`,
      token
    );

    const inventory = inventoryData.listings.map(transformItem);
    return createResponse(200, inventory);
  } catch (error) {
    console.error('get-inventory error:', error);
    return createErrorResponse(error, 'Failed to fetch inventory');
  }
};
