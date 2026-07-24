import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { context } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'js/dist');

await rm(output, { force: true, recursive: true });

const javascript = await context({
	absWorkingDir: root,
	bundle: true,
	chunkNames: 'chunks/chunk-[hash]',
	define: {
		__MAP_STYLESHEET_URL__: JSON.stringify('/css/dist/map.css')
	},
	entryNames: 'main',
	entryPoints: { main: 'js/js-imports.js' },
	format: 'esm',
	logLevel: 'info',
	outdir: 'js/dist',
	sourcemap: 'inline',
	splitting: true,
	target: ['es2022']
});

await javascript.watch();

const stylesheets = spawn(
	process.execPath,
	[path.join(root, 'scripts/watch-css.mjs')],
	{ cwd: root, stdio: 'inherit' }
);

let stopping = false;

async function stop(signal = 'SIGTERM') {
	if (stopping) return;
	stopping = true;
	stylesheets.kill(signal);
	await javascript.dispose();
}

const exitCode = await new Promise(resolve => {
	stylesheets.once('exit', code => {
		if (!stopping) {
			javascript.dispose().finally(() => resolve(code ?? 1));
		}
	});

	for (const signal of ['SIGINT', 'SIGTERM']) {
		process.once(signal, () => {
			stop(signal).finally(() => resolve(0));
		});
	}
});

process.exitCode = exitCode;
