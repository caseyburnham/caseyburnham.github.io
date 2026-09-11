/** Browser-level smoke coverage for the production build. */
import { expect, test } from '@playwright/test';

async function preparePage(page) {
	await page.route('**/api/discogs/**', route => route.fulfill({
		body: '[]',
		contentType: 'application/json',
		status: 200
	}));
	await page.route('https://api.maptiler.com/maps/**', route => route.fulfill({
		body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
		contentType: 'application/json',
		status: 200
	}));
}

function sortImagesNewestFirst(images) {
	return [...images].sort((a, b) => {
		const dateComparison = (b.dateCreated || '').localeCompare(a.dateCreated || '');
		return dateComparison || (a.id || '').localeCompare(b.id || '');
	});
}

async function expectGalleryLayout(page, galleryName) {
	const button = page.getByRole('button', { name: galleryName, exact: true });
	const galleryKey = await button.getAttribute('data-gallery');
	const images = await page.evaluate(async key => {
		const response = await fetch('/json/gallery-data.json');
		const galleries = await response.json();
		return galleries[key].images;
	}, galleryKey);
	const groups = Object.groupBy(images, image => image.layout);

	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');

	const newestImage = sortImagesNewestFirst(images)[0];
	await expect(page.locator(`#galleries .photo-thumb[data-photo-id="${newestImage.id}"]`)).toHaveCount(1);

	const rows = await page.locator('#galleries .photo-grid')
		.evaluateAll(elements => elements.map(row => ({
			ids: Array.from(row.querySelectorAll('.photo-thumb[data-photo-id]'), image => image.dataset.photoId),
			layout: row.classList.contains('landscape-row')
				? 'landscape'
				: row.classList.contains('portrait-row') ? 'portrait' : 'pano'
		})));

	for (const [layout, maxPerRow] of Object.entries({ landscape: 5, portrait: 6 })) {
		const expectedImages = sortImagesNewestFirst(groups[layout] || []);
		const layoutRows = rows.filter(row => row.layout === layout);

		expect(layoutRows).toHaveLength(Math.ceil(expectedImages.length / maxPerRow));
		expect(layoutRows.flatMap(row => row.ids)).toEqual(expectedImages.map(image => image.id));
		for (const row of layoutRows) {
			expect(row.ids.length).toBeGreaterThanOrEqual(Math.min(3, expectedImages.length));
			expect(row.ids.length).toBeLessThanOrEqual(maxPerRow);
		}
	}

	const panoRows = rows.filter(row => row.layout === 'pano');
	const expectedPanos = sortImagesNewestFirst(groups.pano || []);
	expect(panoRows).toHaveLength(expectedPanos.length);
	expect(panoRows.every(row => row.ids.length === 1)).toBe(true);
	expect(panoRows.flatMap(row => row.ids)).toEqual(expectedPanos.map(image => image.id));
}

test.beforeEach(async ({ page }) => {
	await preparePage(page);
});

test('renders the primary content and data tables', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Casey Burnham');
	await expect(page.locator('#productions-table tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#mountains tbody tr:not(.summary-row)')).not.toHaveCount(0);
	await expect(page.locator('#concerts tbody tr:not(.summary-row)')).not.toHaveCount(0);
	const rangeRidges = page.locator('#range-summary-row .range-ridge');
	await expect(rangeRidges).toHaveCount(8);
	const rangeSummary = await rangeRidges.evaluateAll(ridges => ridges.map(ridge => ({
		count: Number.parseInt(ridge.querySelector('.range-ridge-count').textContent, 10),
		isZero: ridge.classList.contains('range-ridge--zero'),
		name: ridge.querySelector('.range-ridge-name').textContent,
		points: ridge.querySelector('.range-ridge-line').getAttribute('points')
	})));
	expect(rangeSummary.every(range => range.name && Number.isInteger(range.count))).toBe(true);
	expect(rangeSummary.every(range => range.isZero === (range.count === 0))).toBe(true);
	expect(rangeSummary.every(range => Boolean(range.points) === (range.count > 0))).toBe(true);
	await expect(page.locator('#elevationChart')).toHaveCount(0);

	const hasHorizontalOverflow = await page.evaluate(() =>
		document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(hasHorizontalOverflow).toBe(false);
});

test('opens the mobile navigation', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');

	const toggle = page.getByRole('button', { name: 'Toggle navigation menu' });
	await toggle.click();

	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(page.locator('#nav-main')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(toggle).toBeFocused();
});

test('expands the desktop gallery navigation', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	const galleryData = await page.request.get('/json/gallery-data.json')
		.then(response => response.json());
	const galleryEntries = Object.entries(galleryData)
		.filter(([key]) => key !== '_config');
	const [targetKey, targetGallery] = galleryEntries
		.find(([key]) => key !== galleryData._config.defaultGallery);
	await page.goto('/');

	const galleryLink = page.locator('#nav-main > ul > li > a[href="#galleries"]');
	const panel = page.locator('#gallery-navigation');
	const headerTop = await page.locator('header')
		.evaluate(header => header.getBoundingClientRect().top);
	await galleryLink.focus();

	await expect(galleryLink).toHaveAttribute('aria-expanded', 'true');
	await expect(panel).toBeVisible();
	await expect(panel.locator('a')).toHaveCount(galleryEntries.length);
	await expect.poll(() => page.locator('header')
		.evaluate(header => header.getBoundingClientRect().top))
		.toBe(headerTop);
	await page.waitForTimeout(1200);
	const menuGeometry = await page.evaluate(() => {
		const mainList = document.querySelector('#nav-main > ul').getBoundingClientRect();
		const panel = document.querySelector('#gallery-navigation').getBoundingClientRect();
		const nav = document.querySelector('#nav-main').getBoundingClientRect();
		const finalLink = document.querySelector('#gallery-navigation > li:last-child > a').getBoundingClientRect();
		return {
			bottomClearance: nav.bottom - finalLink.bottom,
			dividerGap: panel.top - mainList.bottom
		};
	});
	expect(menuGeometry.bottomClearance).toBeGreaterThanOrEqual(8);
	expect(menuGeometry.dividerGap).toBeGreaterThanOrEqual(4);
	expect(menuGeometry.dividerGap).toBeLessThanOrEqual(16);
	const triggerBox = await galleryLink.boundingBox();
	const panelBox = await panel.boundingBox();
	await page.mouse.move(
		triggerBox.x + triggerBox.width / 2,
		(triggerBox.y + triggerBox.height + panelBox.y) / 2
	);
	await page.waitForTimeout(250);
	await expect(galleryLink).toHaveAttribute('aria-expanded', 'true');
	await expect(panel).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(galleryLink).toHaveAttribute('aria-expanded', 'false');
	await expect(panel).toBeHidden();
	await expect(galleryLink).toBeFocused();

	await page.mouse.move(0, 0);
	await page.waitForTimeout(250);
	await galleryLink.hover();
	await panel.getByRole('link', { name: targetGallery.name, exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`#galleries\\?gallery=${targetKey}$`));
	await expect(page.locator(`.gallery-btn[data-gallery="${targetKey}"]`))
		.toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => page.evaluate(() => {
		const sectionTop = document.querySelector('#galleries').getBoundingClientRect().top;
		const scrollPaddingTop = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
		return Math.abs(sectionTop - scrollPaddingTop);
	})).toBeLessThanOrEqual(2);

	const originalKey = galleryData._config.defaultGallery;
	await page.locator(`.gallery-btn[data-gallery="${originalKey}"]`).click();
	await galleryLink.hover();
	await expect(panel.locator(`a[data-gallery="${originalKey}"]`))
		.toHaveClass(/is-selected-gallery/);
});

test('highlights side-by-side table links together', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/');

	await page.locator('a[href="#mountains"]').evaluate(link => link.click());

	await expect(page.locator('a[href="#mountains"]')).toHaveClass(/is-current-section/);
	await expect(page.locator('a[href="#concerts"]')).toHaveClass(/is-current-section/);
	await expect(page.locator('#nav-main a[aria-current="location"]')).toHaveCount(1);
});

test('opens a summit photo before the gallery has loaded', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#mountains .camera-link').first()).toBeAttached();

	const dialog = page.locator('dialog.photo-dialog');
	await expect(dialog).toHaveCount(1);
	await page.locator('#mountains .camera-link').first().evaluate(button => button.click());

	await expect(dialog).toHaveAttribute('open', '');
	await expect(dialog.locator('.photo-title')).not.toBeEmpty();
});

test('hides the GPS row when a summit photo has no coordinates', async ({ page }) => {
	await page.goto('/');
	const button = page.locator('#mountains .camera-link[data-image="/images/summits/un-13738.jpeg"]');
	await expect(button).toBeAttached();
	await button.click();

	const dialog = page.locator('dialog.photo-dialog');
	await expect(dialog.locator('.gps')).toBeHidden();
	await expect(dialog.locator('.gps-link')).not.toHaveAttribute('href');
});

test('opens a shared summit photo link on a fresh page', async ({ page }) => {
	const summit = await page.request.get('/json/mountain-data.json')
		.then(response => response.json())
		.then(mountains => mountains.find(mountain => mountain.Image));
	const photo = summit.Image.split('/').at(-1).replace(/\.[^.]+$/, '');

	await page.goto(`/#mountains?photo=${photo}`);
	await expect(page.locator('dialog.photo-dialog')).toHaveAttribute('open', '');
	await expect(page.locator('dialog .photo-title')).toHaveText(summit.Peak);
});

test('keeps the summit viewer available when gallery loading fails', async ({ page }) => {
	await page.route('**/json/gallery-data.json', route => route.fulfill({
		body: JSON.stringify({ error: 'Unavailable' }),
		contentType: 'application/json',
		status: 503
	}));

	await page.goto('/');
	await page.locator('#galleries').scrollIntoViewIfNeeded();
	await expect(page.locator('#galleries')).toHaveAttribute('data-state', 'error');

	await page.locator('#mountains .camera-link').first().click();
	await expect(page.locator('dialog.photo-dialog')).toHaveAttribute('open', '');
});

test('loads a gallery and opens a photo dialog', async ({ page }) => {
	await page.goto('/');
	await page.locator('#galleries').scrollIntoViewIfNeeded();

	const thumbnail = page.locator('#galleries .photo-thumb').first();
	await expect(thumbnail).toBeVisible();
	await expect(thumbnail).toHaveAttribute('itemtype', 'https://schema.org/ImageObject');
	await expect(thumbnail.locator('[itemprop="contentUrl"]')).toHaveAttribute('href', /\/images\/galleries\//);
	await expect(thumbnail.locator('[itemprop="dateCreated"]')).toHaveAttribute('content', /^\d{4}-\d{2}-\d{2}$/);
	await expect(thumbnail.locator('[itemprop="copyrightNotice"]')).toHaveAttribute('content', /^© \d{4} Casey Burnham$/);
	await thumbnail.click();

	const dialog = page.locator('dialog.photo-dialog');
	const title = dialog.locator('.photo-title');
	const media = dialog.locator('.modal-media');
	await expect(dialog).toHaveAttribute('open', '');
	await expect(title).not.toBeEmpty();
	await expect(dialog.locator('.modal-image')).toHaveCount(2);
	await expect(dialog.locator('.modal-image.is-active')).toBeVisible();

	const firstTitle = await title.textContent();
	await page.keyboard.press('ArrowRight');
	await expect(title).not.toHaveText(firstTitle);
	await expect(dialog.locator('.modal-loading')).toBeHidden();

	const secondTitle = await title.textContent();
	await media.dispatchEvent('pointerdown', {
		clientX: 300,
		clientY: 200,
		pointerId: 1,
		pointerType: 'touch'
	});
	await media.dispatchEvent('pointerup', {
		clientX: 100,
		clientY: 205,
		pointerId: 1,
		pointerType: 'touch'
	});
	await expect(title).not.toHaveText(secondTitle);

	const thirdTitle = await title.textContent();
	await page.mouse.move(5, 5);
	await page.mouse.wheel(80, 0);
	await page.waitForTimeout(40);
	await page.mouse.wheel(18, 0);
	await page.waitForTimeout(40);
	await page.mouse.wheel(12, 0);
	await page.waitForTimeout(40);
	await page.mouse.wheel(6, 0);
	await expect(title).not.toHaveText(thirdTitle);

	const fourthTitle = await title.textContent();
	await page.waitForTimeout(40);
	await page.mouse.wheel(20, 0);
	await page.mouse.wheel(45, 0);
	await expect(title).not.toHaveText(fourthTitle);

	await dialog.getByRole('button', {
		name: 'Close photo viewer'
	}).click();
	await expect(dialog).not.toHaveAttribute('open', '');
	await page.waitForTimeout(350);
	await expect(dialog.locator('.modal-image[src]')).toHaveCount(0);
});

test('opens a shared gallery photo link on a fresh page', async ({ page }) => {
	const photo = await page.request.get('/json/gallery-data.json')
		.then(response => response.json())
		.then(data => {
			const [gallery, details] = Object.entries(data)
				.find(([key]) => key !== '_config');
			return {
				gallery,
				photo: details.images[0].id
			};
		});

	await page.goto(`/#galleries?gallery=${photo.gallery}&photo=${photo.photo}`);
	await expect(page.locator(`.gallery-btn[data-gallery="${photo.gallery}"]`))
		.toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('dialog.photo-dialog')).toHaveAttribute('open', '');
	await expect(page.locator('dialog .photo-title')).not.toBeEmpty();
});

test('updates a gallery link when switching collections and opening a photo', async ({ page }) => {
	await page.goto('/');
	await page.locator('#galleries').scrollIntoViewIfNeeded();
	const button = page.locator('.gallery-btn').nth(1);
	await button.click();
	const gallery = await button.getAttribute('data-gallery');
	await expect(page).toHaveURL(new RegExp(`#galleries\\?gallery=${gallery}`));
	await page.locator('#galleries .photo-thumb').first().click();
	await expect(page).toHaveURL(new RegExp(`#galleries\\?gallery=${gallery}&photo=`));
	await page.getByRole('button', {
		name: 'Close photo viewer'
	}).click();
	await expect(page).toHaveURL(new RegExp(`#galleries\\?gallery=${gallery}$`));
});

test('balances gallery rows while keeping each orientation newest-first', async ({ page }) => {
	await page.goto('/');
	await page.locator('#galleries').scrollIntoViewIfNeeded();

	for (const galleryName of ['Abstract', 'Live Sound', 'Prospecting', 'High Country']) {
		await expectGalleryLayout(page, galleryName);
	}
});

test('lazy-loads the map stylesheet, map, and markers', async ({ page }) => {
	await page.goto('/');
	const mapStylesheet = page.locator('link[rel="stylesheet"][href*="/assets/map-"]');

	await expect(mapStylesheet).toHaveCount(0);
	await page.locator('#map').scrollIntoViewIfNeeded();

	await expect(mapStylesheet).toHaveCount(1);
	await expect(page.locator('#map.maplibregl-map')).toBeVisible();
	await expect(page.locator('#map .map-marker').first()).toBeVisible();
});

test('shows an error when the map style cannot load', async ({ page }) => {
	await page.unroute('https://api.maptiler.com/maps/**');
	await page.route('https://api.maptiler.com/maps/**', route => route.fulfill({
		body: JSON.stringify({ error: 'Unavailable' }),
		contentType: 'application/json',
		status: 503
	}));

	await page.goto('/');
	await page.locator('#map').scrollIntoViewIfNeeded();

	await expect(page.locator('#map .error')).toHaveText('Unable to load map data');
});

test('keeps static tables and the default gallery when JSON requests fail', async ({ page }) => {
	await page.route('**/json/**', route => route.fulfill({ status: 503, body: '' }));
	await page.goto('/');
	await expect(page.locator('#productions-table tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#mountains .camera-link')).not.toHaveCount(0);
	await expect(page.locator('#concerts tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#galleries .photo-thumb').first()).toBeVisible();
});

test('resizes an open photo to the viewport', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	await page.locator('#mountains .camera-link').first().click();
	await expect(page.locator('.modal-image.is-active')).toBeVisible();
	const media = page.locator('.modal-media');
	await expect(page.locator('dialog figure')).toHaveCSS('scale', '1');
	const desktop = await media.boundingBox();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect.poll(async () => (await media.boundingBox()).width).toBeLessThanOrEqual(390);
	const mobile = await media.boundingBox();
	expect(mobile.x).toBeGreaterThanOrEqual(0);
	expect(mobile.x + mobile.width).toBeLessThanOrEqual(390);
	expect(mobile.height).toBeLessThanOrEqual(844 * 0.7 + 1);
	expect(mobile.width / mobile.height).toBeCloseTo(desktop.width / desktop.height, 2);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await expect.poll(async () => (await media.boundingBox()).width).toBeCloseTo(desktop.width, 0);
});

test('retries a failed gallery without reloading the page', async ({ page }) => {
	let unavailable = true;
	await page.route('**/json/gallery-data.json', route => unavailable
		? route.fulfill({ status: 503, body: '' })
		: route.continue());
	await page.goto('/');
	await page.locator('#galleries').scrollIntoViewIfNeeded();
	await expect(page.locator('#gallery-error')).toBeVisible();
	unavailable = false;
	await page.getByRole('button', { name: 'Try again', exact: true }).click();
	await expect(page.locator('#galleries .photo-thumb').first()).toBeVisible();
	await expect(page.locator('#gallery-error')).toBeHidden();
	await page.locator('#galleries .photo-thumb').first().click();
	await expect(page.locator('dialog')).toHaveAttribute('open', '');
});

test('opens the correct photo when traversing history across galleries', async ({ page }) => {
	const data = await page.request.get('/json/gallery-data.json').then(response => response.json());
	const routes = Object.entries(data).filter(([key]) => key !== '_config').slice(0, 2).map(([gallery, value]) => ({
		hash: `#galleries?gallery=${gallery}&photo=${value.images[0].id}`,
		title: value.images[0].title || value.images[0].alt
	}));
	await page.goto(`/${routes[0].hash}`);
	await expect(page.locator('dialog .photo-title')).toHaveText(routes[0].title);
	await page.evaluate(hash => { location.hash = hash; }, routes[1].hash);
	await expect(page.locator('dialog .photo-title')).toHaveText(routes[1].title);
	await page.goBack();
	await expect(page.locator('dialog .photo-title')).toHaveText(routes[0].title);
	await expect(page).toHaveURL(new RegExp(`photo=${new URLSearchParams(routes[0].hash.split('?')[1]).get('photo')}$`));
	await page.goForward();
	await expect(page.locator('dialog .photo-title')).toHaveText(routes[1].title);
});


test('reveals photo metadata when its link receives keyboard focus', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	await page.locator('#mountains .camera-link').first().click();
	const link = page.locator('dialog .gps-link');
	await expect(link).toHaveAttribute('href', /caltopo/);
	await page.mouse.move(0, 0);
	await link.focus();
	await expect(link).toBeFocused();
	await expect(page.locator('dialog figcaption')).toHaveCSS('opacity', '1');
	await expect(page.locator('dialog figcaption')).toHaveCSS('filter', 'blur(0px)');
});

test('opens details natively with keyboard and without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	await page.goto('http://127.0.0.1:4175/');
	await expect(page.locator('#nav-main')).toBeVisible();
	await expect(page.locator('#nav-main a[href="#skills"]')).toBeVisible();
	const details = page.locator('#skills details');
	await details.locator('summary').focus();
	await page.keyboard.press('Enter');
	await expect(details).toHaveAttribute('open', '');
	await expect(details.locator('article')).toBeVisible();
	await page.keyboard.press('Space');
	await expect(details).not.toHaveAttribute('open', '');
	await context.close();
});

test('keeps record nodes and keyboard focus when the shelf resizes', async ({ page }) => {
	const records = ['Vinyl', 'CD', 'Cassette', 'Vinyl', 'CD'].map((mediaType, index) => ({
		title: `Record ${index + 1}`, artist: 'Artist', mediaType, rating: 5,
		url: 'https://www.discogs.com/', cover_image: '/images/assets/png/vinyl-record.png', price: '12.00'
	}));
	await page.route('**/api/discogs/**', route => route.fulfill({ json: records }));
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	await page.locator('#now-playing').scrollIntoViewIfNeeded();
	const shelf = page.locator('#discogs-collection-wrapper');
	await expect(shelf.locator('.discogs-record:visible')).toHaveCount(5);
	const link = shelf.locator('.record-link').first();
	await page.mouse.move(0, 0);
	await link.focus();
	await expect(shelf.locator('.discogs-record').first()).toHaveCSS('z-index', '2');
	await expect.poll(() => shelf.locator('.album-media').first().evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeGreaterThan(0);
	await link.evaluate(el => { el.dataset.identityCheck = 'original'; });
	await page.setViewportSize({ width: 800, height: 1000 });
	await expect(shelf.locator('.discogs-record:visible')).toHaveCount(3);
	await expect(shelf.locator('.record-caption:visible')).toHaveCount(3);
	await expect(link).toBeFocused();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(shelf.locator('.discogs-record:visible')).toHaveCount(2);
	await expect(shelf.locator('.record-caption:visible')).toHaveCount(2);
	await expect(link).toHaveAttribute('data-identity-check', 'original');
	await expect(link).toBeFocused();
});

test('leaves explanatory popovers open until dismissed', async ({ page }) => {
	await page.goto('/');
	await page.locator('[popovertarget="ucd"]').click();
	await expect(page.locator('#ucd')).toBeVisible();
	await page.waitForTimeout(3200);
	await expect(page.locator('#ucd')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#ucd')).toBeHidden();
});


test('delivers portfolio content and working photo links without JavaScript', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	const requests = [];
	page.on('request', request => requests.push(request.url()));
	await page.goto('http://127.0.0.1:4175/');
	await expect(page.locator('#productions-table tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#concerts tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#mountains tbody tr')).not.toHaveCount(0);
	await expect(page.locator('#totalMountains')).toHaveText(/\d+/);
	await expect(page.locator('.range-ridgeline > li:not(.range-ridge--zero) .range-ridge-line[points=""]')).toHaveCount(0);
	await expect(page.locator('#gallery-navigation a')).toHaveCount(9);
	await expect(page.locator('.gallery-controls')).toBeHidden();
	const image = page.locator('#galleries .photo-thumb').first();
	await expect(image).toBeVisible();
	const href = await image.getAttribute('href');
	expect(href).toMatch(/^\/images\/galleries\//);
	expect(requests.some(url => url.includes('/json/'))).toBe(false);
	await image.click();
	await expect(page).toHaveURL(new URL(href, 'http://127.0.0.1:4175').href);
	await context.close();
});

test('loads smaller native image candidates and retains full photo links', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	const portrait = page.locator('.matte img');
	await expect.poll(() => portrait.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
	await expect.poll(() => portrait.evaluate(image => image.currentSrc)).toContain('/responsive/');
	const thumbnail = page.locator('#galleries .photo-thumb img').first();
	await thumbnail.scrollIntoViewIfNeeded();
	await expect.poll(() => thumbnail.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
	await expect.poll(() => thumbnail.evaluate(image => image.currentSrc)).toContain('/responsive/');
	await expect(page.locator('#galleries .photo-thumb').first()).not.toHaveAttribute('href', /thumbnails/);
	await expectGalleryLayout(page, 'High Country');
	const switchedThumbnail = page.locator('#galleries .photo-thumb img').first();
	await switchedThumbnail.scrollIntoViewIfNeeded();
	await expect.poll(() => switchedThumbnail.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
	await expect(switchedThumbnail).toHaveAttribute('srcset', /320w/);
});

test('retains record stacking through retraction and raises the latest activation', async ({ page }) => {
	const records = ['Vinyl', 'CD', 'Cassette'].map((mediaType, index) => ({
		title: `Record ${index + 1}`, artist: 'Artist', mediaType,
		url: 'https://www.discogs.com/', cover_image: '/images/assets/png/vinyl-record.png'
	}));
	await page.route('**/api/discogs/**', route => route.fulfill({ json: records }));
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto('/');
	for (const selector of ['#discogs-sleeve-container', '#discogs-inventory-sleeve-container']) {
		const shelf = page.locator(selector);
		await shelf.scrollIntoViewIfNeeded();
		const links = shelf.locator('.record-link');
		const sleeves = shelf.locator('.discogs-record');
		await links.first().hover();
		await sleeves.first().evaluate(async element => {
			await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
		});
		const raisedIndex = await sleeves.first().evaluate(element => getComputedStyle(element).zIndex);
		await page.mouse.move(0, 0);
		await expect(sleeves.first()).toHaveCSS('z-index', raisedIndex);
		await expect.poll(() => sleeves.first().locator('.album-media').evaluate(element =>
			new DOMMatrix(getComputedStyle(element).transform).m41)).toBeGreaterThan(0);
		// Move across siblings in both directions while previous discs are retracting.
		for (const index of [1, 0, 2]) {
			await links.nth(index).hover();
			const indexes = await sleeves.evaluateAll(elements => elements.map(element => Number(getComputedStyle(element).zIndex)));
			expect(indexes[index]).toBeGreaterThan(Math.max(...indexes.filter((_, other) => other !== index)));
		}
		await page.mouse.move(0, 0);
		await links.first().focus();
		const focusedIndex = await sleeves.first().evaluate(element => getComputedStyle(element).zIndex);
		await links.first().blur();
		await expect(sleeves.first()).toHaveCSS('z-index', focusedIndex);
		await sleeves.first().evaluate(async element => {
			await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
		});
		await expect(sleeves.first()).toHaveCSS('z-index', focusedIndex);
	}
});
