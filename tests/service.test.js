import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/utils/service.js';
import { sendToFlomo } from '../src/utils/api.js';
import { validateApiUrl, parseBackup, validateNote } from '../src/utils/validation.js';
import { createHarness, configured, API_URL, NOW, note } from './helpers.js';

const send = (h, data = note()) => h.service.handle({ action: 'sendToFlomo', data });
const save = (h, content = note()) => h.service.handle({ action: 'saveDraft', data: { tabId: 7, content } });

test('business rejection preserves draft and counts, and permits a genuine retry', async () => {
    let code = -1;
    const h = await configured({ fetchImpl: async () => ({ ok: true, json: async () => ({ code, message: API_URL }) }) });
    await save(h);
    const result = await send(h);
    assert.equal(result.success, false);
    assert.equal(h.data.local.statistics.dailyCount, 0);
    assert.ok(h.data.local.draft_7);
    assert.ok(!JSON.stringify(result).includes(API_URL));
    code = 0;
    assert.equal((await send(h)).success, true);
    assert.equal(h.requests.length, 2);
    assert.equal(h.data.local.draft_7, undefined);
});

test('successful retry with same request id never resends, including after worker restart', async () => {
    const h = await configured();
    await save(h);
    assert.equal((await send(h)).success, true);
    assert.equal((await send(h)).success, true);
    const restarted = createService({ chrome: h.chrome, fetchImpl: h.fetchMock, now: h.now });
    assert.equal((await restarted.handle({ action: 'sendToFlomo', data: note() })).success, true);
    assert.equal(h.requests.length, 1);
    assert.equal(h.data.local.statistics.dailyCount, 1);
    await save(h);
    assert.equal(h.data.local.draft_7, undefined, 'late autosave must not resurrect sent content');
});

test('network ambiguity remains blocked across worker restart without exposing webhook', async () => {
    const h = await configured({ fetchImpl: async () => { throw new Error(API_URL); } });
    await save(h);
    const response = await send(h);
    assert.equal(response.uncertain, true);
    assert.ok(!response.error.includes(API_URL));
    const restarted = createService({ chrome: h.chrome, fetchImpl: h.fetchMock, now: h.now });
    assert.equal((await restarted.handle({ action: 'sendToFlomo', data: note() })).uncertain, true);
    assert.equal(h.requests.length, 1);
    assert.ok(h.data.local.draft_7);
});

test('HTTP errors and invalid response bodies are not reported as success', async () => {
    for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => { throw new Error('bad JSON'); } }, { ok: true, json: async () => ({}) }]) {
        const h = await configured({ fetchImpl: async () => response });
        assert.equal((await send(h)).uncertain, true);
        assert.equal(h.data.local.statistics.dailyCount, 0);
    }
});

test('timeout aborts request and reports an uncertain result', async () => {
    await assert.rejects(sendToFlomo(API_URL, note(), {
        timeoutMs: 2,
        fetchImpl: async (_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))))
    }), error => error.uncertain === true);
});

test('post-send storage failure remains success and cannot lead to duplicate dispatch', async () => {
    const h = await configured({ fail: (op, name, value) => op === 'set' && name === 'local' && value.statistics?.dailyCount === 1 });
    await save(h);
    const response = await send(h);
    assert.equal(response.success, true);
    assert.ok(response.warning);
    assert.equal((await send(h)).success, true);
    assert.equal(h.requests.length, 1);
    const restarted = createService({ chrome: h.chrome, fetchImpl: h.fetchMock, now: h.now });
    assert.equal((await restarted.handle({ action: 'sendToFlomo', data: note() })).uncertain, true);
    assert.equal(h.requests.length, 1);
});

test('intent persistence failure prevents any network dispatch', async () => {
    const h = await configured({ fail: (op, name, value) => op === 'set' && name === 'local' && Boolean(value.sendReceipts) });
    assert.equal((await send(h)).success, false);
    assert.equal(h.requests.length, 0);
});

test('new local day resets both persisted date and count before sending', async () => {
    const h = await configured({ local: { statistics: { dailyCount: 100, totalSent: 105, lastResetDate: 'yesterday' } } });
    assert.equal(h.data.local.statistics.dailyCount, 0);
    assert.equal((await send(h)).dailyCount, 1);
    assert.equal(h.data.local.statistics.totalSent, 106);
});

test('concurrent sends serialize counts and enforce final available slot', async () => {
    let h = await configured();
    const responses = await Promise.all([send(h, note()), send(h, note({ requestId: 'test-request-id-00002' }))]);
    assert.ok(responses.every(r => r.success));
    assert.equal(h.data.local.statistics.dailyCount, 2);
    assert.equal(h.data.local.statistics.totalSent, 2);
    h = await configured({ local: { statistics: { dailyCount: 99, totalSent: 99, lastResetDate: NOW.toDateString() } } });
    const limited = await Promise.all([send(h), send(h, note({ requestId: 'test-request-id-00002' }))]);
    assert.equal(limited.filter(r => r.success).length, 1);
    assert.equal(h.requests.length, 1);
});

test('send crossing midnight is counted on the completion day', async () => {
    let date = new Date('2026-11-11T23:59:59');
    const h = await configured({ now: () => date, fetchImpl: async () => {
        date = new Date('2026-11-12T00:00:01');
        return { ok: true, json: async () => ({ code: 0 }) };
    } });
    const response = await send(h);
    assert.equal(response.lastResetDate, date.toDateString());
    assert.equal(response.dailyCount, 1);
});

test('migration moves webhook and statistics locally before removing cloud values', async () => {
    const h = createHarness({ sync: { apiUrl: API_URL, dailyCount: 3, totalSent: 10, lastResetDate: NOW.toDateString(), autoSaveDraft: false } });
    const result = await h.service.handle({ action: 'getSettings' });
    assert.equal(result.success, true);
    assert.equal(result.apiConfigured, true);
    assert.equal(result.settings.apiUrl, undefined);
    assert.equal(result.settings.autoSaveDraft, false);
    assert.equal(h.data.local.apiUrl, API_URL);
    assert.equal(h.data.local.statistics.dailyCount, 3);
    assert.equal(h.data.sync.apiUrl, undefined);
    assert.equal(h.data.sync.totalSent, undefined);
    assert.ok(h.changes.some(change => change.name === 'local' && change.accessLevel === 'TRUSTED_CONTEXTS'));
});

test('failed local migration preserves the original cloud credential', async () => {
    const h = createHarness({ sync: { apiUrl: API_URL }, fail: (op, area) => op === 'set' && area === 'local' });
    assert.equal((await h.service.handle({ action: 'getSettings' })).success, false);
    assert.equal(h.data.sync.apiUrl, API_URL);
});

test('saving stale or imported settings cannot overwrite delivery statistics or credentials', async () => {
    const h = await configured();
    await send(h);
    const settings = { autoSaveDraft: false, totalSent: 0, dailyCount: 0, lastSentDate: null };
    assert.equal((await h.service.handle({ action: 'saveSettings', settings })).success, true);
    assert.equal((await h.service.handle({ action: 'importData', backup: { version: '1.0.0', settings: { ...settings, apiUrl: 'https://evil.invalid/' } } })).success, true);
    assert.equal(h.data.local.statistics.totalSent, 1);
    assert.equal(h.data.local.apiUrl, API_URL);
    assert.deepEqual(Object.keys(h.data.sync), ['autoSaveDraft']);
});

test('backup has only whitelisted preferences and tags, with no private data', async () => {
    const h = await configured({ sync: { commonTags: ['读书'], sendHistory: [{ content: 'private' }] } });
    await save(h);
    const { backup } = await h.service.handle({ action: 'exportData' });
    assert.equal(backup.version, '2.0.0');
    assert.ok(!JSON.stringify(backup).includes(API_URL));
    assert.equal(backup.settings.sendHistory, undefined);
    assert.equal(backup.settings.draft_7, undefined);
    assert.equal(backup.settings.apiUrl, undefined);
});

test('invalid backup types and HTML tags are rejected before writing anything', async () => {
    const h = await configured();
    for (const settings of [{ commonTags: ['<img src=x>'] }, { commonTags: 'bad' }, { autoSaveDraft: 'false' }, { tags: Array(9).fill('a') }]) {
        const result = await h.service.handle({ action: 'importData', backup: { version: '2.0.0', settings } });
        assert.equal(result.success, false);
    }
    assert.throws(() => parseBackup({ version: 'unknown', settings: {} }));
    assert.equal(Object.keys(h.data.sync).length, 0);
});

test('webhooks reject lookalike hosts, credentials, redirects through URL parameters and HTTP', () => {
    assert.equal(validateApiUrl(API_URL), API_URL);
    for (const url of ['http://flomoapp.com/iwh/a/b/', 'https://flomoapp.com.evil.invalid/iwh/a/b/', 'https://user@flomoapp.com/iwh/a/b/', `${API_URL}?redirect=evil`, `${API_URL}#fragment`, 'https://flomoapp.com/iwh/a/%2e%2e/']) assert.throws(() => validateApiUrl(url));
});

test('legacy images and oversized notes are not silently sent as text-only', async () => {
    const h = await configured();
    const imageNote = note({ images: [{ name: 'image.png', data: 'data:image/png;base64,AAAA' }] });
    assert.equal((await send(h, imageNote)).success, false);
    assert.equal((await send(h, note({ originalContent: 'a'.repeat(5000), personalThoughts: 'extra' }))).success, false);
    assert.equal(h.requests.length, 0);
    assert.equal(validateNote(imageNote, { draft: true }).images.length, 1);
});

test('test note uses real business response and counts against the same limit', async () => {
    const h = await configured();
    const result = await h.service.handle({ action: 'testConnection', apiUrl: API_URL, requestId: 'test-connection-id-00001' });
    assert.equal(result.success, true);
    assert.equal(h.requests[0][1].method, 'POST');
    assert.equal(h.requests[0][1].redirect, 'error');
    assert.equal(h.data.local.statistics.dailyCount, 1);
});

test('reset and clear keep delivery protection while clearing private configuration', async () => {
    const h = await configured();
    await send(h);
    await save(h, note({ requestId: 'draft-request-id-0002' }));
    await h.service.handle({ action: 'resetSettings' });
    assert.equal(h.data.local.statistics.totalSent, 1);
    await h.service.handle({ action: 'clearData' });
    assert.equal(h.data.local.apiUrl, undefined);
    assert.equal(h.data.local.draft_7, undefined);
    assert.equal(h.data.local.sendReceipts.length, 1);
    assert.equal(h.data.local.statistics.totalSent, 1);
});


test('confirmed in-memory receipt remains successful if later storage reads fail', async () => {
    let unavailable = false;
    const h = await configured({ fail: (op, area) => unavailable && op === 'get' && area === 'local' });
    assert.equal((await send(h)).success, true);
    unavailable = true;
    const result = await send(h);
    assert.equal(result.success, true);
    assert.ok(result.warning);
    assert.equal(h.requests.length, 1);
});
