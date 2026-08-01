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
	await expect(page.locator(`#galleries img[data-filename="${newestImage.id}"]`)).toHaveCount(1);

	const rows = await page.locator('#galleries .photo-grid')
		.evaluateAll(elements => elements.map(row => ({
			ids: Array.from(row.querySelectorAll('img[data-filename]'), image => image.dataset.filename),
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
	await expect(page.locator('#nav-main')).toHaveClass(/is-open/);
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
