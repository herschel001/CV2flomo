import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(directory, item.name)) : [join(directory, item.name)]);
}
for (const file of ['build.js', 'webpack.config.js', ...files('src'), ...files('scripts'), ...files('tests')].filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
console.log('JavaScript 语法检查通过');
