import { spawn } from 'node:child_process';
import process from 'node:process';

const postcss = process.platform === 'win32'
	? 'node_modules\\.bin\\postcss.cmd'
	: 'node_modules/.bin/postcss';
const config = ['--watch', '--config', 'utility'];
const entries = [
	['css/main/_imports.css', '-o', 'css/dist/style.css'],
	['css/maps/_imports.css', '-o', 'css/dist/map.css']
];
const watchers = entries.map(args =>
	spawn(postcss, [...args, ...config], { stdio: 'inherit' })
);

let stopping = false;

function stop(signal = 'SIGTERM') {
	stopping = true;
	for (const watcher of watchers) {
		watcher.kill(signal);
	}
}

const exitCode = await new Promise(resolve => {
	for (const watcher of watchers) {
		watcher.addListener('exit', code => {
			if (stopping) return;

			stop();
			resolve(code ?? 1);
		});
	}

	process.once('SIGINT', () => {
		stop('SIGINT');
		resolve(0);
	});
	process.once('SIGTERM', () => {
		stop('SIGTERM');
		resolve(0);
	});
});

process.exitCode = exitCode;
