import { defineConfig } from '@playwright/test';

export default defineConfig({
	fullyParallel: true,
	outputDir: '../test-results',
	reporter: 'list',
	testDir: '../tests',
	use: {
		baseURL: 'http://127.0.0.1:4175',
		browserName: 'chromium',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	webServer: {
		command: 'npm run preview',
		reuseExistingServer: !process.env.CI,
		url: 'http://127.0.0.1:4175'
	}
});
