import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicationFile } from '../scripts/check-publication.js';

const inspect = (name, text = '') => inspectPublicationFile(name, Buffer.from(text));
test('publication rejects private and generated files but allows a placeholder environment example', () => {
    for (const file of ['node_modules/a.js', 'dist/manifest.json', '.env', '.env.local', 'key.pem', '.codex/state.json', 'memory/private.md', 'PROJECT_SUMMARY.md', 'flomo-web-clipper-backup-2026-11-11.json']) {
        assert.ok(inspect(file).includes('private-or-generated-file'), file);
    }
    assert.deepEqual(inspect('.env.example', 'API_TOKEN=YOUR_TOKEN'), []);
    assert.deepEqual(inspect('tests/helpers.js', 'TEST_TOKEN'), []);
});

test('publication catches common credentials without returning their values', () => {
    const token = 'ghp_' + 'A'.repeat(36);
    const issues = inspect('example.js', token);
    assert.deepEqual(issues, ['github-token']);
    assert.ok(!JSON.stringify(issues).includes(token));
    const webhook = ['https://flomoapp.com', 'iwh', 'FAKE_USER', 'a'.repeat(32), ''].join('/');
    assert.ok(inspect('README.md', webhook).includes('credential-webhook'));
    assert.deepEqual(inspect('README.md', 'https://flomoapp.com/iwh/YOUR_ID/YOUR_TOKEN/'), []);
});

test('publication rejects local user paths and oversized files', () => {
    const userPath = '/' + ['Users', 'private-user', 'notes'].join('/');
    assert.ok(inspect('file.js', userPath).includes('personal-path'));
    assert.ok(inspectPublicationFile('large.bin', Buffer.alloc(10 * 1024 * 1024 + 1)).includes('file-over-10MiB'));
});
