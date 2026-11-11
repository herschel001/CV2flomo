import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const blockedDirectories = new Set(['node_modules', 'dist', '.codex', '.claude', '.agents', '.vscode', '.idea', 'memory', 'backups', 'backup', 'private', 'local-data', 'profiles', 'artifacts', 'coverage']);
const blockedFiles = new Set(['.DS_Store', '.npmrc', '.git-credentials', 'MEMORY.md', 'PROJECT_SUMMARY.md', 'REQUIREMENTS.md']);
const secretPatterns = [
    ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
    ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ['api-key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/],
    ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
    ['credential-webhook', /https:\/\/flomoapp\.com\/iwh\/[^/\s]+\/[a-fA-F0-9]{24,64}\//],
    ['personal-path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/]
];

export function inspectPublicationFile(filename, content) {
    const parts = filename.split('/');
    const basename = parts.at(-1);
    const issues = [];
    if (parts.slice(0, -1).some(part => blockedDirectories.has(part)) || blockedFiles.has(basename) ||
        (/^\.env(?:\.|$)/.test(basename) && basename !== '.env.example') ||
        /\.(?:pem|key|p8|p12|pfx|mobileprovision|crx)$/i.test(basename) ||
        /^flomo-web-clipper-backup-.*\.json$/.test(basename)) issues.push('private-or-generated-file');
    if (content.byteLength > 10 * 1024 * 1024) issues.push('file-over-10MiB');
    if (content.byteLength <= 10 * 1024 * 1024) {
        const text = content.toString('utf8');
        for (const [kind, pattern] of secretPatterns) if (pattern.test(text)) issues.push(kind);
    }
    return issues;
}

export function checkPublication() {
    const entries = execFileSync('git', ['ls-files', '--stage', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    if (!entries.length) throw new Error('没有已暂存的发布文件；请先执行 git add <明确路径>');
    let failures = 0;
    for (const entry of entries) {
        const tab = entry.indexOf('\t');
        const [mode, , stage] = entry.slice(0, tab).split(' ');
        const filename = entry.slice(tab + 1);
        if (stage !== '0') throw new Error('Git 索引有未解决冲突，请先处理');
        const content = execFileSync('git', ['show', `:${filename}`], { maxBuffer: 11 * 1024 * 1024 });
        const issues = inspectPublicationFile(filename, content);
        if (mode === '120000') issues.push('symlink-requires-review');
        for (const issue of issues) {
            console.error(`${issue}: ${filename}`);
            failures++;
        }
    }
    if (failures) throw new Error(`发布检查未通过：${failures} 项；未输出任何疑似凭据内容`);
    console.log(`发布检查通过：${entries.length} 个索引文件；未发现规则覆盖的凭据、本机路径或排除文件。仍需人工审查。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try { checkPublication(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
