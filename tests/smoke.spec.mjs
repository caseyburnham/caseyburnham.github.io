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

async function expectGalleryShape(page, galleryName, marker, expected) {
	await page.getByRole('button', { name: galleryName, exact: true }).click();
	await expect(page.locator(`#galleries img[data-filename="${marker}"]`)).toHaveCount(1);
	const rowShapes = await page.locator('#galleries .photo-grid')
		.evaluateAll(elements => elements.map(row => ({
			count: row.querySelectorAll('.photo-thumb').length,
			layout: row.classList.contains('landscape-row')
				? 'landscape'
				: row.classList.contains('portrait-row') ? 'portrait' : 'pano'
		})));
	expect(rowShapes).toEqual(expected);
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
	await expectGalleryShape(page, 'Abstract', 'air-bubbles', [
		{ count: 5, layout: 'landscape' },
		{ count: 4, layout: 'portrait' },
		{ count: 5, layout: 'portrait' }
	]);

	for (const layout of ['landscape', 'portrait']) {
		const dates = await page.locator(`#galleries .${layout}-row [itemprop="dateCreated"]`)
			.evaluateAll(elements => elements.map(element => element.getAttribute('content')));
		expect(dates).toEqual([...dates].sort().reverse());
	}

	await expectGalleryShape(page, 'Live Sound', '100-gecs', [
		{ count: 4, layout: 'landscape' },
		{ count: 6, layout: 'portrait' },
		{ count: 4, layout: 'landscape' }
	]);
	await expectGalleryShape(page, 'Prospecting', 'alpine-tunnel', [
		{ count: 5, layout: 'landscape' },
		{ count: 5, layout: 'portrait' },
		{ count: 4, layout: 'landscape' },
		{ count: 3, layout: 'landscape' }
	]);
	await expectGalleryShape(page, 'High Country', 'above-the-clouds', [
		{ count: 5, layout: 'landscape' },
		{ count: 1, layout: 'pano' },
		{ count: 4, layout: 'landscape' },
		{ count: 1, layout: 'pano' },
		{ count: 5, layout: 'landscape' },
		{ count: 1, layout: 'pano' },
		{ count: 4, layout: 'portrait' },
		{ count: 1, layout: 'pano' },
		{ count: 3, layout: 'landscape' },
		{ count: 4, layout: 'portrait' }
	]);
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
