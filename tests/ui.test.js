import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { configured, note } from './helpers.js';

globalThis.document = { addEventListener() {} };
const { FlomoPopup } = await import('../src/popup/popup.js');
const { OptionsManager } = await import('../src/options/options.js');
const { ErrorHandler, ErrorTypes } = await import('../src/utils/errorHandler.js');
const { cleanHtml } = await import('../src/utils/formatter.js');

function page(kind) {
    const dom = new JSDOM(fs.readFileSync(`src/${kind}/${kind}.html`, 'utf8'), { url: `https://example.invalid/${kind}.html` });
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    return dom;
}
const idle = () => new Promise(resolve => setImmediate(resolve));

test('popup preferences prevent autofill and autosave, and hide counts', async () => {
    const dom = page('popup');
    const h = await configured({ sync: { autoSaveDraft: false, autoFillPageInfo: false, showWordCount: false } });
    globalThis.chrome = h.chrome;
    const popup = new FlomoPopup();
    await popup.initialization;
    assert.equal(document.getElementById('pageUrl').textContent.trim(), '');
    assert.equal(document.getElementById('originalContent').value, '');
    assert.equal(document.getElementById('originalCharCount').hidden, true);
    document.getElementById('originalContent').value = '不要自动保存';
    document.getElementById('originalContent').dispatchEvent(new dom.window.Event('input'));
    await idle();
    assert.equal(h.data.local.draft_7, undefined);
    dom.window.close();
});

test('input dispatches an immediate draft that survives popup closure', async () => {
    const dom = page('popup');
    const h = await configured({ sync: { autoFillPageInfo: false } });
    globalThis.chrome = h.chrome;
    const popup = new FlomoPopup();
    await popup.initialization;
    const input = document.getElementById('originalContent');
    input.value = '最后一个字';
    input.dispatchEvent(new dom.window.Event('input'));
    dom.window.close();
    await idle();
    assert.equal(h.data.local.draft_7.originalContent, '最后一个字');
});

test('double send click dispatches once and does not resurrect the cleared draft', async () => {
    const dom = page('popup');
    const h = await configured({ sync: { autoFillPageInfo: false } });
    globalThis.chrome = h.chrome;
    const popup = new FlomoPopup();
    await popup.initialization;
    document.getElementById('originalContent').value = '只发一次';
    await Promise.all([popup.sendToFlomo(), popup.sendToFlomo()]);
    assert.equal(h.requests.length, 1);
    assert.ok(!JSON.parse(h.requests[0][1].body).content.includes('网页URL'));
    assert.equal(document.getElementById('originalContent').value, '');
    assert.equal(h.data.local.draft_7, undefined);
    dom.window.close();
});

test('failed pre-send draft save blocks dispatch and preserves form input', async () => {
    const dom = page('popup');
    const h = await configured({ sync: { autoFillPageInfo: false }, fail: (op, area, values) => op === 'set' && area === 'local' && Boolean(values.draft_7) });
    globalThis.chrome = h.chrome;
    const popup = new FlomoPopup();
    await popup.initialization;
    document.getElementById('originalContent').value = '保留内容';
    await popup.sendToFlomo();
    assert.equal(h.requests.length, 0);
    assert.equal(popup.uncertain, false);
    assert.equal(document.getElementById('originalContent').value, '保留内容');
    dom.window.close();
});

test('tags and legacy image names render as text without markup or image requests', () => {
    const dom = page('popup');
    const popup = Object.create(FlomoPopup.prototype);
    popup.tags = ['<img src=x>'];
    popup.isSending = false;
    popup.images = [{ name: '\"><img src=x>', data: 'data:image/png;base64,AAAA' }];
    popup.renderTags();
    popup.updateImagePreview();
    assert.equal(document.querySelectorAll('#tagsContainer img, #imagePreview img').length, 0);
    assert.ok(document.getElementById('tagsContainer').textContent.includes('<img src=x>'));
    assert.ok(document.getElementById('imagePreview').textContent.includes('保存原图'));
    dom.window.close();
});

test('common tags are usable suggestions, with normalization before duplicate check', async () => {
    const dom = page('popup');
    const h = await configured({ sync: { autoFillPageInfo: false, commonTags: ['读书'] } });
    globalThis.chrome = h.chrome;
    const popup = new FlomoPopup();
    await popup.initialization;
    document.querySelector('#commonTagSuggestions button').click();
    popup.addTag('#读书');
    assert.deepEqual(popup.tags, ['读书']);
    await idle();
    dom.window.close();
});

test('options tag rendering does not parse imported markup', () => {
    const dom = page('options');
    const manager = Object.create(OptionsManager.prototype);
    manager.settings = { commonTags: ['<img src=x>'] };
    manager.renderCommonTags();
    assert.equal(document.querySelector('#commonTagsContainer img'), null);
    assert.ok(document.getElementById('commonTagsContainer').textContent.includes('<img src=x>'));
    dom.window.close();
});

test('test connection requires explicit confirmation and never probes a fake HEAD endpoint', async () => {
    const dom = page('options');
    let calls = 0;
    const h = await configured();
    globalThis.chrome = h.chrome;
    globalThis.confirm = () => false;
    const manager = Object.create(OptionsManager.prototype);
    manager.settings = { apiUrl: h.data.local.apiUrl };
    manager.testing = false;
    manager.testRequestId = 'test-connection-ui-00001';
    const original = h.chrome.runtime.sendMessage;
    h.chrome.runtime.sendMessage = (...args) => { calls++; return original(...args); };
    await manager.testConnection();
    assert.equal(calls, 0);
    globalThis.confirm = () => true;
    await manager.testConnection();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0][1].method, 'POST');
    await manager.testConnection();
    assert.equal(h.requests.length, 1, 'repeat clicks reuse the receipt');
    dom.window.close();
});

test('error display escapes external text and HTML-to-text parsing stays inert', () => {
    const dom = page('popup');
    const handler = new ErrorHandler();
    handler.showErrorNotification({ title: '<img src=x>', message: '<script>bad</script>', solutions: ['<img src=x>'], details: '<img src=x>' });
    assert.equal(document.querySelector('.flomo-error-notification img'), null);
    assert.equal(document.querySelector('.flomo-error-notification script'), null);
    assert.equal(cleanHtml('<script>bad</script><p>正文</p><img src="https://evil.invalid/">'), '正文');
    dom.window.close();
});


test('an invalid legacy webhook can be loaded and corrected in options', async () => {
    const dom = page('options');
    const h = await configured({ local: { apiUrl: 'invalid-legacy-value' } });
    globalThis.chrome = h.chrome;
    const manager = Object.create(OptionsManager.prototype);
    await manager.loadSettings();
    assert.equal(document.getElementById('apiUrl').value, 'invalid-legacy-value');
    assert.equal(document.getElementById('testConnectionBtn').disabled, true);
    dom.window.close();
});
