import { createService } from '../src/utils/service.js';

export const API_URL = 'https://flomoapp.com/iwh/TEST_USER/TEST_TOKEN/';
export const NOW = new Date('2026-11-11T10:00:00+08:00');
export function note(overrides = {}) {
    return { requestId: 'test-request-id-00001', tabId: 7, tags: ['测试'], originalContent: '一条测试笔记', personalThoughts: '', pageTitle: '', pageUrl: '', images: [], ...overrides };
}
export function createHarness({ sync = {}, local = {}, fail, fetchImpl, now = () => new Date(NOW) } = {}) {
    const data = { sync: structuredClone(sync), local: structuredClone(local) };
    const changes = [];
    const requests = [];
    const listeners = [];
    function area(name) {
        return {
            async get(keys) {
                if (fail?.('get', name, keys)) throw new Error('模拟存储故障');
                if (keys === null) return structuredClone(data[name]);
                return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => Object.hasOwn(data[name], k)).map(k => [k, structuredClone(data[name][k])]));
            },
            async set(values) {
                if (fail?.('set', name, values)) throw new Error('模拟存储故障');
                const delta = {};
                for (const [key, value] of Object.entries(values)) {
                    delta[key] = { oldValue: structuredClone(data[name][key]), newValue: structuredClone(value) };
                    data[name][key] = structuredClone(value);
                }
                changes.push({ name, values: structuredClone(values) });
                for (const listener of listeners) queueMicrotask(() => listener(delta, name));
            },
            async remove(keys) {
                if (fail?.('remove', name, keys)) throw new Error('模拟存储故障');
                for (const key of Array.isArray(keys) ? keys : [keys]) delete data[name][key];
            },
            async clear() { data[name] = {}; },
            async setAccessLevel(value) { changes.push({ name, accessLevel: value.accessLevel }); }
        };
    }
    const chrome = {
        storage: { local: area('local'), sync: area('sync'), onChanged: { addListener(fn) { listeners.push(fn); } } },
        runtime: { id: 'test-extension', getURL: p => `chrome-extension://test-extension/${p}`, openOptionsPage() {} },
        tabs: { query: async () => [{ id: 7, title: '网页标题', url: 'https://example.invalid/article' }], sendMessage: async () => ({ success: true, data: { title: '网页标题', url: 'https://example.invalid/article', selectedText: '选中的文字' } }) },
        scripting: { executeScript: async () => {} }
    };
    const fetchMock = async (...args) => {
        requests.push(args);
        return fetchImpl ? fetchImpl(...args) : { ok: true, status: 200, json: async () => ({ code: 0 }) };
    };
    const service = createService({ chrome, fetchImpl: fetchMock, now });
    chrome.runtime.sendMessage = request => service.handle(structuredClone(request));
    return { chrome, data, changes, requests, service, fetchMock, now };
}
export async function configured(options = {}) {
    const harness = createHarness({ ...options, local: { apiUrl: API_URL, ...options.local } });
    const result = await harness.service.handle({ action: 'getStatistics' });
    if (!result.success) throw new Error('测试初始化失败');
    return harness;
}
