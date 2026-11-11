import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyPackage(directory) {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const entries = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page,
        'src/content/content.js', ...(manifest.content_scripts ?? []).flatMap(item => item.js), ...Object.values(manifest.icons)];
    for (const entry of entries) {
        if (!fs.existsSync(path.join(directory, entry))) throw new Error(`Missing extension entry: ${entry}`);
        if (entry.endsWith('.html')) {
            const html = fs.readFileSync(path.join(directory, entry), 'utf8');
            for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
                if (!fs.existsSync(path.resolve(directory, path.dirname(entry), match[1]))) throw new Error(`Missing page asset: ${match[1]}`);
            }
        }
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    verifyPackage(path.resolve(process.argv[2] ?? 'dist'));
    console.log('扩展入口和页面资源检查通过');
}
