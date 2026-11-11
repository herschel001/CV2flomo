import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyPackage } from './scripts/verify-package.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const name of ['manifest.json', 'src', 'icons']) {
    cpSync(path.join(root, name), path.join(output, name), { recursive: true, filter: file => path.basename(file) !== '.DS_Store' });
}
verifyPackage(output);
console.log('构建完成：在 chrome://extensions/ 加载 dist/');
