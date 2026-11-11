import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const contentSource = fs.readFileSync('src/content/content.js', 'utf8');
test('content extraction preserves the page DOM and returns the selected text', () => {
    const dom = new JSDOM('<title>文章</title><body><style>body{color:red}</style><header>页头</header><nav>导航</nav><article>正文 <span>选区</span></article></body>', { url: 'https://example.invalid/' });
    let listener, calls = 0;
    const selection = dom.window.getSelection();
    const range = dom.window.document.createRange();
    range.selectNodeContents(dom.window.document.querySelector('span'));
    selection.addRange(range);
    const before = dom.window.document.documentElement.outerHTML;
    const context = vm.createContext({ document: dom.window.document, window: dom.window, chrome: { runtime: { id: 'test', onMessage: { addListener(fn) { listener = fn; calls++; } } } } });
    vm.runInContext(contentSource, context);
    vm.runInContext(contentSource, context);
    assert.equal(calls, 1, 'reinjection must not register duplicate listeners');
    let response;
    listener({ action: 'getPageInfo' }, { id: 'test' }, result => { response = result; });
    assert.equal(response.success, true);
    assert.equal(response.data.selectedText, '选区');
    assert.equal(response.data.content, '正文 选区');
    assert.equal(dom.window.document.documentElement.outerHTML, before);
    dom.window.close();
});

test('background restricts commands by exact extension page and sender id', async () => {
    let listener, dispatches = 0;
    const source = fs.readFileSync('src/background/background.js', 'utf8').replace(/^import .*;\n/, '');
    vm.runInNewContext(source, {
        createService: () => ({ handle: async () => { dispatches++; return { success: true }; } }),
        chrome: { runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener(fn) { listener = fn; } }, onInstalled: { addListener() {} } } }
    });
    for (const sender of [{ id: 'test', url: 'https://evil.invalid/' }, { id: 'other', url: 'chrome-extension://test/src/options/options.html' }]) {
        let response;
        assert.equal(listener({ action: 'clearData' }, sender, result => { response = result; }), false);
        assert.equal(response.success, false);
    }
    listener({ action: 'getPrivateSettings' }, { id: 'test', url: 'chrome-extension://test/src/popup/popup.html' }, () => {});
    assert.equal(dispatches, 0);
    await new Promise(resolve => listener({ action: 'getPrivateSettings' }, { id: 'test', url: 'chrome-extension://test/src/options/options.html', tab: { id: 1 } }, resolve));
    assert.equal(dispatches, 1);
});

test('manifest limits injection to activeTab and restricts network and inline scripts', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.json'));
    assert.equal(manifest.content_scripts, undefined);
    assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'scripting']);
    assert.equal(manifest.background.type, 'module');
    assert.ok(manifest.content_security_policy.extension_pages.includes('connect-src https://flomoapp.com;'));
    assert.ok(!manifest.content_security_policy.extension_pages.includes('unsafe-eval'));
});
