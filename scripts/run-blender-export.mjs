import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const blenderPath = 'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe';
const scriptPath = path.join(repoRoot, 'scripts', 'blender_build_mg7.py');

const child = spawn(blenderPath, ['-b', '-P', scriptPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
