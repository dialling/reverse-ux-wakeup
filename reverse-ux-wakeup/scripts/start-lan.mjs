import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const syncProc = spawn(process.execPath, ['server/syncServer.mjs'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const webProc = spawn(process.execPath, [viteBin, '--host', '0.0.0.0'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

function cleanup() {
  syncProc.kill('SIGTERM');
  webProc.kill('SIGTERM');
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

webProc.on('exit', (code) => {
  syncProc.kill('SIGTERM');
  process.exit(code ?? 0);
});
