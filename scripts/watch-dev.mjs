import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let building = false;
let pending = false;
let timer;
let child;

function rebuild() {
	pending = true;
	if (building) return;
	pending = false;
	building = true;
	child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });
	child.once('exit', code => {
		building = false;
		if (code) console.error('Build failed; the previous preview remains available.');
		if (pending) rebuild();
	});
}

function changed(filename) {
	if (!filename || /(^|\/)(dist|ORIGINALS|\.DS_Store)(\/|$)/.test(filename)) return;
	clearTimeout(timer);
	timer = setTimeout(rebuild, 150);
}

const watchers = ['css', 'js', 'shared', 'json', 'images', 'scripts', 'config'].map(directory =>
	watch(path.join(root, directory), { recursive: true }, (_, filename) => changed(filename)));
watchers.push(watch(root, (_, filename) => {
	if (['index.html', '_headers', 'robots.txt', 'sitemap.xml', 'package.json'].includes(filename)) changed(filename);
}));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => {
		clearTimeout(timer);
		pending = false;
		watchers.forEach(watcher => watcher.close());
		child?.kill(signal);
	});
}
rebuild();
