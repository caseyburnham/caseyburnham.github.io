import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import sorting from 'postcss-sorting';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssRoot = path.join(root, 'css');
const sorter = postcss([
	sorting({
		'properties-order': 'alphabetical'
	})
]);

async function findSourceFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(entries.map(async entry => {
		const location = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			return entry.name === 'dist' ? [] : findSourceFiles(location);
		}

		return entry.isFile() && entry.name.endsWith('.css') ? [location] : [];
	}));

	return files.flat();
}

const files = await findSourceFiles(cssRoot);
let changed = 0;

for (const file of files) {
	const source = await readFile(file, 'utf8');
	const result = await sorter.process(source, {
		from: file,
		map: false
	});

	if (result.css !== source) {
		await writeFile(file, result.css);
		changed += 1;
	}
}

console.log(`Sorted properties in ${changed} of ${files.length} CSS source files.`);
