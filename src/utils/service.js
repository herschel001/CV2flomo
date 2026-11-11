import { sendToFlomo, formatContent, SendError } from './api.js';
import { initializeStorage, readSettings, normalizeStatistics } from './storage.js';
import { DEFAULT_SETTINGS, validateApiUrl, validateNote, validateRequestId, validateTabId, validateTags, validateSettings, parseBackup } from './validation.js';

export function createService({ chrome, fetchImpl = fetch, now = () => new Date() }) {
    let queue = Promise.resolve();
    let initialization;
    let rememberedStatistics;
    const rememberedReceipts = new Map();
    const serial = task => {
        const result = queue.then(async () => {
            if (!initialization) initialization = initializeStorage(chrome, now()).catch(() => {
                initialization = undefined;
                throw new Error('本机数据初始化失败，请重新加载扩展');
            });
            await initialization;
            return task();
        });
        queue = result.catch(() => {});
        return result;
    };
    async function statistics() {
        const stored = await chrome.storage.local.get(['statistics']);
        const value = normalizeStatistics(rememberedStatistics ?? stored.statistics, now());
        if (!rememberedStatistics && JSON.stringify(value) !== JSON.stringify(stored.statistics)) {
            await chrome.storage.local.set({ statistics: value });
        }
        return value;
    }
    async function receipts() {
        const stored = await chrome.storage.local.get(['sendReceipts']);
        const values = Array.isArray(stored.sendReceipts) ? stored.sendReceipts : [];
        return values.filter(x => x && typeof x.id === 'string');
    }
    async function send(data, overrideUrl) {
        const id = validateRequestId(data.requestId);
        const note = validateNote(data);
        const content = formatContent(note);
        if (content.length > 5000) throw new Error('整条笔记（含标签和网页信息）不能超过 5000 字');
        const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))), x => x.toString(16).padStart(2, '0')).join('');
        const remembered = rememberedReceipts.get(id);
        const entries = remembered ? [] : await receipts();
        const previous = remembered ?? entries.find(x => x.id === id);
        if (previous) {
            if (previous.fingerprint !== fingerprint) throw new Error('请求编号对应的内容已改变，请重新打开弹窗');
            if (previous.status === 'sent') {
                let counts;
                let warning = '';
                try { counts = await statistics(); } catch {
                    counts = normalizeStatistics(previous.statistics, now());
                    warning = '笔记已经发送，本机统计暂时不可用；请勿重复发送';
                }
                return { success: true, ...counts, remaining: Math.max(0, 100 - counts.dailyCount), warning };
            }
            return { success: false, uncertain: true, error: '上次发送结果无法确认，请先在 flomo 检查；确认未收到后再选择重新发送' };
        }
        const counts = await statistics();
        if (counts.dailyCount >= 100) throw new Error('今日发送次数已达上限（100条）');
        const stored = await chrome.storage.local.get(['apiUrl']);
        const apiUrl = validateApiUrl(overrideUrl ?? stored.apiUrl ?? '');
        const pending = { id, fingerprint, status: 'pending', createdAt: now().toISOString() };
        const updated = entries.filter(x => x.id !== id).slice(-199).concat(pending);
        // Persist intent before dispatch: after worker termination a retry cannot silently duplicate a note.
        await chrome.storage.local.set({ sendReceipts: updated });
        try {
            await sendToFlomo(apiUrl, note, { fetchImpl });
        } catch (error) {
            if (!(error instanceof SendError) || error.uncertain) {
                rememberedReceipts.set(id, pending);
                return { success: false, uncertain: true, error: error instanceof SendError ? error.message : '发送结果无法确认，请先检查 flomo' };
            }
            await chrome.storage.local.set({ sendReceipts: updated.filter(x => x.id !== id) });
            return { success: false, error: error.message };
        }
        const current = normalizeStatistics(counts, now());
        const next = { ...current, dailyCount: current.dailyCount + 1, totalSent: current.totalSent + 1, lastSentDate: now().toISOString() };
        const sent = { ...pending, status: 'sent', statistics: next };
        rememberedReceipts.set(id, sent);
        rememberedStatistics = next;
        let warning = '';
        try {
            await chrome.storage.local.set({ statistics: next, sendReceipts: updated.map(x => x.id === id ? sent : x) });
            rememberedStatistics = undefined;
        } catch {
            warning = '笔记已发送，但本机统计保存失败；请勿重复发送';
        }
        if (data.tabId !== undefined) {
            const key = `draft_${validateTabId(data.tabId)}`;
            try {
                const saved = await chrome.storage.local.get([key]);
                if (saved[key]?.requestId === id) await chrome.storage.local.remove(key);
            } catch { warning ||= '笔记已发送，但草稿清理失败；请勿重复发送'; }
        }
        return { success: true, ...next, remaining: Math.max(0, 100 - next.dailyCount), warning };
    }
    const handlers = {
        async getSettings() {
            const settings = await readSettings(chrome);
            const { apiUrl = '' } = await chrome.storage.local.get(['apiUrl']);
            return { success: true, settings, apiConfigured: Boolean(apiUrl) };
        },
        async getPrivateSettings() {
            const result = await handlers.getSettings();
            const { apiUrl = '' } = await chrome.storage.local.get(['apiUrl']);
            return { ...result, settings: { ...result.settings, apiUrl } };
        },
        async saveSettings(request) {
            const valid = validateSettings(request.settings, { includeApi: true });
            if (Object.hasOwn(valid, 'apiUrl')) {
                await chrome.storage.local.set({ apiUrl: valid.apiUrl });
                delete valid.apiUrl;
            }
            await chrome.storage.sync.set(valid);
            return { success: true };
        },
        async getStatistics() {
            const counts = await statistics();
            return { success: true, ...counts, remaining: Math.max(0, 100 - counts.dailyCount) };
        },
        async sendToFlomo(request) {
            validateTabId(request.data?.tabId);
            return send(request.data);
        },
        async testConnection(request) {
            return send({ requestId: request.requestId, tags: [], originalContent: 'Flomo Web Clipper 连接测试 ✓' }, validateApiUrl(request.apiUrl));
        },
        async saveDraft(request) {
            const { tabId, content } = request.data ?? {};
            const key = `draft_${validateTabId(tabId)}`;
            const requestId = validateRequestId(content?.requestId);
            const receipt = rememberedReceipts.get(requestId) ?? (await receipts()).find(x => x.id === requestId);
            if (receipt?.status === 'sent') return { success: true };
            await chrome.storage.local.set({ [key]: { ...validateNote(content, { draft: true }), requestId, timestamp: now().toISOString() } });
            return { success: true };
        },
        async getDraft(request) {
            const key = `draft_${validateTabId(request.tabId)}`;
            const stored = await chrome.storage.local.get([key]);
            let draft = stored[key] ?? null;
            if (draft?.requestId) {
                const receipt = rememberedReceipts.get(draft.requestId) ?? (await receipts()).find(x => x.id === draft.requestId);
                if (receipt?.status === 'sent') draft = null;
            }
            return { success: true, draft };
        },
        async saveTags(request) {
            await chrome.storage.sync.set({ tags: validateTags(request.tags) });
            return { success: true };
        },
        async exportData() {
            return { success: true, backup: { version: '2.0.0', exportDate: now().toISOString(), settings: await readSettings(chrome) } };
        },
        async importData(request) {
            await chrome.storage.sync.set(parseBackup(request.backup));
            return { success: true };
        },
        async resetSettings() {
            await chrome.storage.local.set({ apiUrl: '' });
            await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, commonTags: [] });
            return { success: true };
        },
        async clearData() {
            const local = await chrome.storage.local.get(null);
            // Retain delivery receipts and counters so clearing preferences cannot cause accidental resends.
            await chrome.storage.local.remove(Object.keys(local).filter(key => !['sendReceipts', 'statistics', 'schemaVersion'].includes(key)));
            await chrome.storage.sync.clear();
            return { success: true };
        }
    };
    return { handle(request) {
        if (!request || !Object.hasOwn(handlers, request.action)) return Promise.resolve({ success: false, error: '不支持的操作' });
        return serial(() => handlers[request.action](request)).catch(error => ({ success: false, error: error.message || '操作失败，请重试' }));
    } };
}
