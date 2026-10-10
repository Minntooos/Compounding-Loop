// Build step: puts the demo snapshot next to the compiled server so it ships inside dist/.
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(root, 'dist', 'server'), { recursive: true });
await copyFile(path.join(root, 'demo', 'five-sites.json'), path.join(root, 'dist', 'server', 'five-sites.json'));
await copyFile(path.join(root, 'demo', 'this-repo.json'), path.join(root, 'dist', 'server', 'this-repo.json'));
